# Readable Debate UX — Implementation Plan

> **Reader note (Cursor Auto model):** Execute this plan **one phase at a time, in order**. Every constant, path, class name, and prompt string in this document is a locked decision — do not substitute, rename, or "improve" them. If something conflicts with your instincts, trust the plan. When in doubt, re-read this file.

---

## Context

TerpSpark's AI debate currently has two UX problems:
1. **Agent responses are too long and dense** — the prompts enforce "2-4 short paragraphs" with no bullet points, making responses hard to scan during a fast-moving debate.
2. **Text appears too fast** — LLM tokens stream directly to the UI at generation speed, which is faster than anyone can read. This makes the debate feel robotic and overwhelming.

This plan fixes both problems: shorter/scannable responses, word-by-word display at human reading speed (~250 WPM), a natural pause between agent turns, and a pause/resume button so users can catch up.

---

## Phase 1: Shorter Prompts + Bullet Points

Two files need one line changed each. Both are in the `Rules:` section of the system prompt.

### 1.1 `lib/agents/visionary.ts` — line 17

**Find this exact string:**
```
- Respond in 2–4 short paragraphs. No bullet lists, no headers, no markdown formatting. Write in flowing prose as if speaking aloud in a meeting.
```

**Replace with:**
```
- Keep responses to 100–150 words. You may use short bullet points to list ideas or trade-offs. No headers, no bold, no other markdown. Keep it concise and scannable — like quick remarks in a meeting, not a monologue.
```

### 1.2 `lib/agents/critic.ts` — line 17

**Find this exact string:**
```
- Respond in 2–4 short paragraphs. No bullet lists, no headers, no markdown formatting. Write in flowing prose as if speaking aloud in a meeting.
```

**Replace with:**
```
- Keep responses to 100–150 words. You may use short bullet points to list critiques or trade-offs. No headers, no bold, no other markdown. Keep it concise and scannable — like quick remarks in a meeting, not a monologue.
```

---

## Phase 2: Bullet Point Rendering in MessageBubble

**File:** `components/MessageBubble.tsx`

Currently the message text is rendered with `whitespace-pre-wrap` which preserves line breaks but does not render bullet points as lists. Since agents can now use `- item` style bullets, we need minimal parsing.

**Do NOT install a markdown library.** Instead, add a helper function inside `MessageBubble.tsx` that detects lines starting with `- ` and renders them as `<li>` elements.

### 2.1 Add this helper function above the `MessageBubble` component:

```tsx
function renderText(text: string): React.ReactNode {
  const lines = text.split("\n");
  const result: React.ReactNode[] = [];
  let bulletBuffer: string[] = [];

  function flushBullets() {
    if (bulletBuffer.length > 0) {
      result.push(
        <ul key={`ul-${result.length}`} className="my-1 ml-4 list-disc space-y-0.5">
          {bulletBuffer.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>,
      );
      bulletBuffer = [];
    }
  }

  for (const line of lines) {
    const match = line.match(/^[-•]\s+(.*)/);
    if (match) {
      bulletBuffer.push(match[1]);
    } else {
      flushBullets();
      if (line.trim() === "") {
        result.push(<br key={`br-${result.length}`} />);
      } else {
        result.push(
          <span key={`t-${result.length}`}>
            {line}
            {"\n"}
          </span>,
        );
      }
    }
  }
  flushBullets();
  return <>{result}</>;
}
```

### 2.2 Update the text rendering div (currently line 54):

**Find:**
```tsx
<div className="text-neutral-100 whitespace-pre-wrap text-sm leading-relaxed">
  {text}
</div>
```

**Replace with:**
```tsx
<div className="text-neutral-100 whitespace-pre-wrap text-sm leading-relaxed">
  {renderText(text)}
</div>
```

---

## Phase 3: Word Throttle Hook (core feature)

**New file:** `hooks/useWordThrottle.ts`

This hook sits between the reducer (which accumulates raw SSE tokens at full LLM speed) and the UI (which should display words at 250 WPM). The hook does NOT modify the reducer — it reads `streaming` from state and produces a throttled version.

### 3.1 Why a hook and not the reducer?

Reducers must be pure and synchronous — they cannot run timers. The throttle requires `setInterval`. So the hook wraps the reducer's output.

### 3.2 How it works

**Two-text model:**
- The reducer's `streaming.text` = full text received from SSE (grows at LLM speed)
- The hook's `displayedText` = text shown to user (grows word-by-word at 250 WPM)

The hook splits `streaming.text` by whitespace into a word array, and `displayedWordCount` controls how many words are shown. A `setInterval(240)` (240ms = 250 WPM) increments `displayedWordCount` by 1 each tick.

### 3.3 The "drain" problem

The server sends `agent_complete` when the LLM finishes generating. The reducer immediately sets `streaming = null` and pushes the full text to `turns[]`. But the throttled display may only be on word 15 of 40.

**Solution:** When `streaming` goes from non-null to null, the hook captures the remaining words in a "drain buffer" ref and keeps ticking. The completed turn should NOT appear in `turns[]` until the drain finishes — so the `agent_complete` dispatch is deferred (see Phase 4).

### 3.4 Inter-agent pause

When the hook detects a change in `streaming.agent` (visionary → critic or vice versa), it:
1. Sets an `interAgentDelay` flag = true
2. Starts a `setTimeout(1500)` (1.5 second pause)
3. Returns `throttledStreaming = null` during the delay (no streaming bubble shown)
4. After timeout, clears the flag and resets `displayedWordCount` to 0

### 3.5 Full implementation

```ts
"use client";

import type { SessionState, Turn } from "@/lib/session/types";
import { useCallback, useEffect, useRef, useState } from "react";

const MS_PER_WORD = 240; // 250 WPM
const INTER_AGENT_DELAY_MS = 1500;

type StreamingInput = { agent: "visionary" | "critic"; text: string } | null;
type ThrottledOutput = { agent: "visionary" | "critic"; displayedText: string } | null;

type DrainBuffer = {
  agent: "visionary" | "critic";
  words: string[];
};

export function useWordThrottle(
  streaming: StreamingInput,
  sessionState: SessionState,
  onDrainComplete: () => void,
): {
  throttledStreaming: ThrottledOutput;
  isPaused: boolean;
  togglePause: () => void;
} {
  const [displayedWordCount, setDisplayedWordCount] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [interAgentDelay, setInterAgentDelay] = useState(false);

  const drainRef = useRef<DrainBuffer | null>(null);
  const prevAgentRef = useRef<string | null>(null);
  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDrainCompleteRef = useRef(onDrainComplete);
  onDrainCompleteRef.current = onDrainComplete;

  // Detect agent switch → trigger inter-agent delay
  useEffect(() => {
    if (!streaming) return;
    const prevAgent = prevAgentRef.current;
    prevAgentRef.current = streaming.agent;

    if (prevAgent !== null && prevAgent !== streaming.agent) {
      // Agent switched — start inter-agent delay
      setInterAgentDelay(true);
      setDisplayedWordCount(0);
      delayTimerRef.current = setTimeout(() => {
        setInterAgentDelay(false);
        delayTimerRef.current = null;
      }, INTER_AGENT_DELAY_MS);
    }
  }, [streaming?.agent]);

  // Detect streaming → null transition (agent_complete arrived, start drain)
  useEffect(() => {
    if (streaming === null && prevAgentRef.current !== null) {
      // streaming just went null — but we might still be displaying words
      // The drain buffer is set in the interval effect below
    }
  }, [streaming]);

  // When streaming goes null and we have undisplayed words, capture drain buffer
  const prevStreamingRef = useRef(streaming);
  useEffect(() => {
    const prev = prevStreamingRef.current;
    prevStreamingRef.current = streaming;

    if (prev && !streaming) {
      // streaming just went null
      const words = prev.text.split(/\s+/).filter(Boolean);
      if (displayedWordCount < words.length) {
        // Still have words to show — enter drain mode
        drainRef.current = { agent: prev.agent, words };
      } else {
        // All words already displayed — complete immediately
        drainRef.current = null;
        onDrainCompleteRef.current();
      }
    }
  }, [streaming, displayedWordCount]);

  // Reset word count when new streaming starts (and no inter-agent delay)
  useEffect(() => {
    if (streaming && !interAgentDelay) {
      // Only reset if this is genuinely new (not a continuation)
      const prev = prevStreamingRef.current;
      if (!prev || prev.agent !== streaming.agent) {
        setDisplayedWordCount(0);
      }
    }
  }, [streaming?.agent, interAgentDelay]);

  // Main word-tick interval
  useEffect(() => {
    if (isPaused || interAgentDelay) return;

    // Determine what we're ticking through
    let targetWords: string[] | null = null;

    if (streaming) {
      targetWords = streaming.text.split(/\s+/).filter(Boolean);
    } else if (drainRef.current) {
      targetWords = drainRef.current.words;
    }

    if (!targetWords || displayedWordCount >= targetWords.length) {
      // Check if drain is complete
      if (!streaming && drainRef.current && targetWords && displayedWordCount >= targetWords.length) {
        drainRef.current = null;
        onDrainCompleteRef.current();
      }
      return;
    }

    const interval = setInterval(() => {
      setDisplayedWordCount((prev) => prev + 1);
    }, MS_PER_WORD);

    return () => clearInterval(interval);
  }, [isPaused, interAgentDelay, streaming, displayedWordCount]);

  // Fast-forward on session end
  useEffect(() => {
    if (sessionState === "ended") {
      if (drainRef.current) {
        setDisplayedWordCount(drainRef.current.words.length);
        drainRef.current = null;
        onDrainCompleteRef.current();
      }
      setIsPaused(false);
      if (delayTimerRef.current) {
        clearTimeout(delayTimerRef.current);
        delayTimerRef.current = null;
      }
      setInterAgentDelay(false);
    }
  }, [sessionState]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
    };
  }, []);

  const togglePause = useCallback(() => setIsPaused((p) => !p), []);

  // Build output
  let throttledStreaming: ThrottledOutput = null;

  if (interAgentDelay) {
    throttledStreaming = null;
  } else if (streaming) {
    const words = streaming.text.split(/\s+/).filter(Boolean);
    const shown = words.slice(0, displayedWordCount).join(" ");
    if (shown) {
      throttledStreaming = { agent: streaming.agent, displayedText: shown };
    }
  } else if (drainRef.current) {
    const words = drainRef.current.words;
    const shown = words.slice(0, displayedWordCount).join(" ");
    if (shown) {
      throttledStreaming = { agent: drainRef.current.agent, displayedText: shown };
    }
  }

  return { throttledStreaming, isPaused, togglePause };
}
```

---

## Phase 4: Wire Up the Hook in Session Page

**File:** `app/session/[id]/page.tsx`

### 4.1 Import the hook

Add at the top of the file:
```ts
import { useWordThrottle } from "@/hooks/useWordThrottle";
```

Also add `useRef` to the React import (it already imports `useEffect, useReducer` — add `useRef`).

### 4.2 Add a pending-complete ref

Inside `SessionPage()`, after the `useReducer` line (currently line 174):

```ts
const pendingCompleteRef = useRef<Action | null>(null);
```

### 4.3 Defer `agent_complete` dispatch

**Find the `agent_complete` event listener (lines 204-216):**
```ts
es.addEventListener("agent_complete", (ev) => {
  const data = JSON.parse((ev as MessageEvent).data) as {
    agent: "visionary" | "critic";
    text: string;
    stance: Stance;
  };
  dispatch({
    type: "complete",
    agent: data.agent,
    text: data.text,
    stance: data.stance,
  });
});
```

**Replace with:**
```ts
es.addEventListener("agent_complete", (ev) => {
  const data = JSON.parse((ev as MessageEvent).data) as {
    agent: "visionary" | "critic";
    text: string;
    stance: Stance;
  };
  pendingCompleteRef.current = {
    type: "complete",
    agent: data.agent,
    text: data.text,
    stance: data.stance,
  };
});
```

The dispatch is now deferred — it happens when the throttle hook calls `onDrainComplete`.

### 4.4 Call the hook

After the `useReducer` and `pendingCompleteRef` lines, add:

```ts
const { throttledStreaming, isPaused, togglePause } = useWordThrottle(
  state.streaming,
  state.sessionState,
  () => {
    if (pendingCompleteRef.current) {
      dispatch(pendingCompleteRef.current);
      pendingCompleteRef.current = null;
    }
  },
);
```

### 4.5 Pass throttled streaming to ChatView

**Find (line 320):**
```tsx
<ChatView turns={state.turns} streaming={state.streaming} />
```

**Replace with:**
```tsx
<ChatView
  turns={state.turns}
  streaming={
    throttledStreaming
      ? { agent: throttledStreaming.agent, text: throttledStreaming.displayedText }
      : null
  }
/>
```

This maps `displayedText` back to the existing `text` prop so ChatView's interface does not change.

### 4.6 Add Pause/Resume button to header

**Find the header buttons area (lines 294-305):**
```tsx
<div className="ml-auto flex items-center gap-2">
  <button
    type="button"
    onClick={() => dispatch({ type: "toggle_judge" })}
    className="focus-visible:ring-amber-400 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2"
  >
    {state.judgePanelOpen
      ? "Hide judge's thoughts"
      : "Show judge's thoughts"}
  </button>
  <EndButton sessionId={id} />
</div>
```

**Replace with:**
```tsx
<div className="ml-auto flex items-center gap-2">
  {state.sessionState === "running" ? (
    <button
      type="button"
      onClick={togglePause}
      className="focus-visible:ring-amber-400 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2"
    >
      {isPaused ? "Resume" : "Pause"}
    </button>
  ) : null}
  <button
    type="button"
    onClick={() => dispatch({ type: "toggle_judge" })}
    className="focus-visible:ring-amber-400 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2"
  >
    {state.judgePanelOpen
      ? "Hide judge's thoughts"
      : "Show judge's thoughts"}
  </button>
  <EndButton sessionId={id} />
</div>
```

The Pause/Resume button only appears when the session is running. It disappears when the session ends or is awaiting user feedback.

---

## Phase 5: Auto-Scroll Fix in ChatView

**File:** `components/ChatView.tsx`

The auto-scroll `useEffect` currently triggers on `[turns.length]`. With throttled streaming, words appear incrementally, so auto-scroll should also trigger as the streaming text updates.

**Find (line 29):**
```ts
}, [turns.length]);
```

**Replace with:**
```ts
}, [turns.length, streaming?.text]);
```

This makes auto-scroll fire as each word appears during throttled display. Since `streaming` is now the throttled text (updating every 240ms), this won't cause excessive re-renders.

---

## Phase 6: Verify

1. Run `npm run build` — verify no TypeScript errors.
2. Start the dev server with `npm run dev`.
3. Create a new session with a topic.
4. **Verify shorter responses:** Agent responses should be ~100-150 words, may include bullet points.
5. **Verify word-by-word display:** Words should appear one at a time at a readable pace (~4 words/second), not all at once.
6. **Verify inter-agent pause:** After the Visionary finishes displaying, there should be a ~1.5 second gap before the Critic's words start appearing.
7. **Verify Pause button:** Click "Pause" — words should stop appearing. Click "Resume" — words should resume at normal speed (not dump all at once).
8. **Verify auto-scroll:** Chat should scroll down as new words appear.
9. **Verify End session:** Clicking end while words are still appearing should fast-forward remaining words and end cleanly.
10. **Verify bullet points:** If an agent uses `- item` format, it should render as a proper bulleted list, not raw text.

---

## Files Changed (summary)

| File | Change Type | What |
|---|---|---|
| `lib/agents/visionary.ts` | Edit line 17 | Shorter prompt, allow bullets |
| `lib/agents/critic.ts` | Edit line 17 | Shorter prompt, allow bullets |
| `components/MessageBubble.tsx` | Edit | Add `renderText()` helper for bullet rendering |
| `hooks/useWordThrottle.ts` | **New file** | Word throttle hook with pause/resume + inter-agent delay |
| `app/session/[id]/page.tsx` | Edit | Wire up hook, defer complete dispatch, add Pause button |
| `components/ChatView.tsx` | Edit line 29 | Add `streaming?.text` to auto-scroll dependency |

**Files NOT changed:** `lib/session/orchestrator.ts`, `lib/sse.ts`, any API routes, `components/EndButton.tsx`. All throttling is client-side only.
