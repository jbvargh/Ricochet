# Ricochet — Implementation Plan

> **Reader note (Cursor auto model):** Execute this plan **one phase at a time, in order**. Do not skip ahead. At the end of each phase, verify the "Definition of done" checklist before moving on. Every constant, path, and name in this document is a locked decision — do not substitute, rename, or "improve" them unless a later phase explicitly says to. If something in this plan conflicts with your instincts, trust the plan.

---

## 0. Product summary (context, do not implement)

Ricochet is an AI brainstorming tool built around a **two-agent debate**:

- **Visionary** — pitches bold, ambitious ideas without filtering for feasibility. Starts at peak ambition and decays toward grounded.
- **Critic** — stress-tests the Visionary's ideas. Starts at a balanced midpoint (neither fully constructive nor fully harsh) and decays toward harsher.

Both agents run under an **asymmetric simulated-annealing decay** on their stance. The user provides a topic and a target number of ideas `N` up front. The two agents debate, with Visionary always speaking first and strict alternation afterward. A **Judge LLM** periodically inspects the transcript and decides when both agents have converged on `N` shared candidate ideas. When that happens, the orchestrator pauses, surfaces the `N` candidates, and asks the user for feedback. When the user replies, both agents reset to **75% of their starting stance** and decay through another full cycle. The user may interject at any point mid-cycle without triggering a reset. The user can end the session either by clicking a stop button or by saying something that the Judge LLM classifies as "user is satisfied."

---

## 1. Locked global decisions

These are the single source of truth. Every phase below references them.

### 1.1 Stack

| Concern | Decision |
|---|---|
| Framework | Next.js 14+ App Router |
| Language | TypeScript (strict mode on) |
| Runtime | Node.js (default Next.js server runtime, **not** edge — SSE + long-lived orchestrator state requires Node) |
| Styling | Tailwind CSS + shadcn/ui components |
| Theme | Dark mode only (neutral-950 background, neutral-100 text) |
| Accent — Visionary | `amber-500` |
| Accent — Critic | `slate-400` |
| Accent — Judge / system | `emerald-400` |
| Package manager | `npm` |
| State persistence | **In-memory `Map` keyed by sessionId**, with optional **MongoDB** for durable sessions and dashboard history. |
| Transport (server → client) | **Server-Sent Events (SSE)**. Not WebSockets. |
| Transport (client → server) | Standard `fetch` POST for session creation, interjection, and end. |

### 1.2 LLM provider fallback chain

Providers are tried **in this exact order**, and the first one whose API key is present in environment variables is used for the entire session:

1. **TerpAI** — env var `TERPAI_API_KEY`, env var `TERPAI_BASE_URL` (TerpAI is an OpenAI-compatible endpoint hosted at the University of Maryland; assume OpenAI-compatible chat completions API shape)
2. **Anthropic Claude** — env var `ANTHROPIC_API_KEY`, model `claude-sonnet-4-6`
3. **Google Gemini** — env var `GEMINI_API_KEY`, model `gemini-2.0-flash`
4. **OpenAI** — env var `OPENAI_API_KEY`, model `gpt-4o`
5. **Groq** — env var `GROQ_API_KEY`, model `llama-3.3-70b-versatile`

Selection rule: on server startup, read env vars in the order above. The **first provider with a non-empty key is the only provider used** for that process's lifetime. Log the selected provider to stdout on boot. If none are present, the server must still boot but `/api/session` POST must return HTTP 503 with a JSON body `{ "error": "no LLM provider configured" }`.

All three agent roles (Visionary, Critic, Judge) use the **same selected provider** — do not mix.

### 1.3 Decay parameters (THE core mechanic — read carefully)

Both agents have a single scalar **stance value** in `[0, 1]`.

| Agent | Start | End | Meaning of 0 → 1 | Reset value |
|---|---|---|---|---|
| Visionary | `1.00` | `0.20` | 0 = grounded/pragmatic, 1 = peak ambition | `0.75` |
| Critic | `0.50` | `1.00` | 0 = fully constructive, 1 = fully harsh | `0.625` |

Note the asymmetry:
- Visionary's stance **decreases** over a cycle (from 1.00 down to 0.20).
- Critic's stance **increases** over a cycle (from 0.50 up to 1.00).
- On reset after user feedback, Visionary jumps **up** to `0.75` (ambitious but not reckless) and Critic jumps **up** to `0.625` (slightly past its balanced starting point — still mostly constructive but with a light skeptical edge). Both reset values represent "25% of the way along the decay path from start toward end," giving the new cycle headroom to build and decay naturally without snapping all the way back to the original extremes.
- **Do not** reset Critic to `0.375`. That would make it more constructive than its starting state, which inverts the intended behavior.

**Decay schedule:** linear, advancing once per **complete exchange** (one Visionary message + one Critic message = one exchange).

- Visionary step per exchange: `−0.08` (clamped at `0.20` floor)
- Critic step per exchange: `+0.05` (clamped at `1.00` ceiling)

These steps are calibrated so that an unconverged cycle naturally ends around 10 exchanges. **Decay does not advance on user interjection.**

### 1.4 Stance → prompt mapping

Decay primarily affects the agent's **system prompt** via a stance descriptor. It also applies a small sampling-temperature nudge so messages feel naturally varied. Use 5 buckets per agent.

**Visionary buckets** (by stance value):

| Stance range | Descriptor injected into system prompt | Sampling temp |
|---|---|---|
| `[0.85, 1.00]` | "reckless dreamer — propose wildly ambitious, almost absurd ideas; ignore feasibility completely" | `0.95` |
| `[0.65, 0.85)` | "bold visionary — propose ambitious, unconventional ideas; lightly acknowledge constraints" | `0.85` |
| `[0.45, 0.65)` | "balanced innovator — propose creative but plausible ideas; weigh upside against feasibility" | `0.75` |
| `[0.30, 0.45)` | "grounded strategist — prefer practical ideas with a small stretch element" | `0.65` |
| `[0.20, 0.30)` | "pragmatic refiner — focus on concrete, shippable ideas and refinements of existing candidates" | `0.55` |

**Critic buckets** (by stance value):

| Stance range | Descriptor injected into system prompt | Sampling temp |
|---|---|---|
| `[0.30, 0.45)` | "supportive coach — highlight strengths first; raise concerns gently and constructively" | `0.55` |
| `[0.45, 0.60)` | "balanced reviewer — weigh strengths and weaknesses evenly; ask probing questions" | `0.60` |
| `[0.60, 0.75)` | "skeptical analyst — focus on feasibility gaps, hidden assumptions, and tradeoffs" | `0.65` |
| `[0.75, 0.90)` | "hard critic — stress-test aggressively; surface failure modes and risks" | `0.70` |
| `[0.90, 1.00]` | "ruthless adversary — attack every weakness; demand the idea justify its existence" | `0.75` |

The Judge LLM always uses sampling temperature `0.20` and has its own fixed prompt (see §4.3).

### 1.5 Orchestration constants

| Constant | Value | Purpose |
|---|---|---|
| `MIN_EXCHANGES_BEFORE_JUDGE` | `3` | Judge is not invoked until at least 3 full exchanges have occurred in the current cycle. Prevents premature convergence. |
| `JUDGE_EVERY_N_EXCHANGES` | `1` | After the minimum is reached, Judge runs after every subsequent exchange. |
| `MAX_EXCHANGES_PER_CYCLE` | `50` | Hard ceiling only. The **user's End button is the real stop mechanism** — this cap exists solely to prevent a runaway process in the pathological case where convergence never happens. Never surface this cap in the UI or message the user about it; if it's ever hit, silently treat it as if the Judge declared convergence and move to `awaiting_user`. |
| `IDEA_COUNT_MIN` | `1` | Minimum value of user-supplied `N`. |
| `IDEA_COUNT_MAX` | `10` | Maximum value of user-supplied `N`. |
| `IDEA_COUNT_DEFAULT` | `3` | Pre-filled default in the topic form. |

### 1.6 All tunables live in one file

Every number, string descriptor, and bucket boundary in §1.3, §1.4, and §1.5 **must** be exported from a single module at [lib/config.ts](lib/config.ts). No other file may contain a hardcoded stance value, decay step, bucket boundary, descriptor string, sampling temperature, or orchestration constant. Every consumer imports from `lib/config.ts`. This lets the user retune the product by editing one file.

Required exports from `lib/config.ts`:

- `INITIAL_VISIONARY_STANCE`, `INITIAL_CRITIC_STANCE`
- `MIN_VISIONARY_STANCE`, `MAX_CRITIC_STANCE`
- `VISIONARY_DECAY_STEP`, `CRITIC_DECAY_STEP`
- `RESET_VISIONARY_STANCE`, `RESET_CRITIC_STANCE`
- `MIN_EXCHANGES_BEFORE_JUDGE`, `JUDGE_EVERY_N_EXCHANGES`, `MAX_EXCHANGES_PER_CYCLE`
- `IDEA_COUNT_MIN`, `IDEA_COUNT_MAX`, `IDEA_COUNT_DEFAULT`
- `JUDGE_TEMPERATURE` (`0.20`)
- `VISIONARY_BUCKETS` — array of `{ min: number; max: number; descriptor: string; temperature: number }` matching §1.4
- `CRITIC_BUCKETS` — same shape, matching §1.4

Add a one-line header comment to the file: `// All tunable knobs for Ricochet's debate behavior. Edit here, not anywhere else.`

---

## 2. File and folder layout

Create exactly these files. Do not create additional files unless a phase explicitly calls for them.

```
ricochet/
├── README.md                              (already exists — leave alone)
├── PLAN.md                                (this file)
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
├── .env.local.example
├── app/
│   ├── layout.tsx                         (root layout, dark mode, font)
│   ├── globals.css                        (tailwind directives + theme tokens)
│   ├── page.tsx                           (landing: topic form)
│   ├── session/
│   │   └── [id]/
│   │       └── page.tsx                   (debate view)
│   └── api/
│       └── session/
│           ├── route.ts                   (POST — create session)
│           └── [id]/
│               ├── stream/route.ts        (GET — SSE stream)
│               ├── message/route.ts       (POST — user interjection / feedback)
│               └── end/route.ts           (POST — end session)
├── lib/
│   ├── llm/
│   │   ├── index.ts                       (provider selection + unified interface)
│   │   ├── types.ts                       (ChatMessage, LLMProvider interface)
│   │   └── providers/
│   │       ├── terpai.ts
│   │       ├── claude.ts
│   │       ├── gemini.ts
│   │       ├── openai.ts
│   │       └── groq.ts
│   ├── agents/
│   │   ├── visionary.ts                   (system prompt builder + run fn)
│   │   ├── critic.ts                      (system prompt builder + run fn)
│   │   └── judge.ts                       (system prompt + run fn + result parser)
│   ├── session/
│   │   ├── types.ts                       (Session, Turn, Stance, State enum)
│   │   ├── store.ts                       (in-memory Map + getters/setters)
│   │   ├── decay.ts                       (stance math, bucket lookup — imports from lib/config.ts)
│   │   └── orchestrator.ts                (the main loop — see §5)
│   ├── config.ts                          (ALL tunables — see §1.6)
│   └── sse.ts                             (SSE event encoder helpers)
└── components/
    ├── TopicForm.tsx                      (landing form)
    ├── ChatView.tsx                       (scrolling message feed)
    ├── MessageBubble.tsx                  (single message render)
    ├── StanceMeter.tsx                    (sidebar stance visualization)
    ├── InterjectBox.tsx                   (bottom input area)
    ├── CandidatePanel.tsx                 (panel when paused — shows N candidates)
    ├── JudgePanel.tsx                     (hidden-by-default overlay — shows judge's latest thoughts)
    └── EndButton.tsx                      (header stop button)
```

---

## 3. Data model (describe, do not implement yet)

Define these TypeScript shapes in [lib/session/types.ts](lib/session/types.ts):

- **`AgentId`** — string literal union: `"visionary" | "critic" | "judge" | "user" | "system"`.
- **`Turn`** — `{ id: string; agent: AgentId; text: string; createdAt: number; stanceAtTurn?: number }`. `stanceAtTurn` is recorded for visionary/critic turns only.
- **`Stance`** — `{ visionary: number; critic: number }`.
- **`SessionState`** — string literal union: `"idle" | "running" | "awaiting_user" | "ended"`.
- **`CandidateIdea`** — `{ title: string; summary: string }`.
- **`Session`** — `{ id: string; topic: string; ideaCount: number; createdAt: number; state: SessionState; stance: Stance; turns: Turn[]; exchangesInCycle: number; pendingInterjection: string | null; lastCandidates: CandidateIdea[] | null; }`.

All timestamps are `Date.now()` millis. All ids are `crypto.randomUUID()`.

---

## 4. Agent prompts (locked wording — use verbatim)

### 4.1 Visionary system prompt template

```
You are the Visionary, one of two AI agents in a real-time brainstorming debate about the topic: "{TOPIC}".

Your role: propose ideas for the topic. Your current stance is: {VISIONARY_DESCRIPTOR}.

You are in a live conversation with two separate entities:
1. The Critic — another AI agent who will stress-test your ideas. Treat the Critic as a distinct voice, not as yourself.
2. The user — a human who may interject at any time to steer the conversation, narrow the discussion to a specific idea or direction, or end the session. The user's word is final. When the user asks you to focus on a particular idea, sub-topic, or direction, you must narrow your subsequent proposals to that scope and stay there until the user broadens it again.

Rules:
- You and the Critic are converging on exactly {N} strong ideas. Track the ideas already on the table and refine or replace them as the debate progresses.
- Respond in 2–4 short paragraphs. No bullet lists, no headers, no markdown formatting. Write in flowing prose as if speaking aloud in a meeting.
- Make it clear when you are responding to a specific point the other speaker raised, but do NOT address them by the name "Critic" or "Visionary." Keep it natural — use phrases like "that's a fair concern," "I hear the pushback," "to build on what was just said," etc.
- Never break character. Never mention that you are an AI, a prompt, or a stance value. Never refer to "the debate," "this exercise," or "the system."
- Do not apologize, do not hedge excessively, do not ask the user questions unprompted. The user will interject on their own when they have something to say.
- If the user has just interjected, acknowledge their point in your first sentence and let it shape your next idea.
```

Replace `{TOPIC}`, `{VISIONARY_DESCRIPTOR}`, `{N}` at call time. `{VISIONARY_DESCRIPTOR}` comes from §1.4.

### 4.2 Critic system prompt template

```
You are the Critic, one of two AI agents in a real-time brainstorming debate about the topic: "{TOPIC}".

Your role: stress-test the other agent's ideas and help converge on the strongest candidates. Your current stance is: {CRITIC_DESCRIPTOR}.

You are in a live conversation with two separate entities:
1. The Visionary — another AI agent who proposes ideas. Treat the Visionary as a distinct voice, not as yourself.
2. The user — a human who may interject at any time to steer the conversation, narrow the discussion to a specific idea or direction, or end the session. The user's word is final. When the user asks you to focus on a particular idea, sub-topic, or direction, you must narrow your subsequent critiques to that scope and stay there until the user broadens it again.

Rules:
- You and the Visionary are converging on exactly {N} strong ideas. When you believe an idea is strong enough to be one of the final {N}, say so explicitly using the phrase "I'd lock in" followed by a short label for the idea.
- Respond in 2–4 short paragraphs. No bullet lists, no headers, no markdown formatting. Write in flowing prose as if speaking aloud in a meeting.
- Make it clear when you are responding to a specific point the other speaker raised, but do NOT address them by the name "Visionary" or "Critic." Keep it natural — use phrases like "the pitch we just heard," "that last idea," "I'll push back on the framing," etc.
- Never break character. Never mention that you are an AI, a prompt, or a stance value. Never refer to "the debate," "this exercise," or "the system."
- Do not apologize, do not ask the user questions unprompted. The user will interject on their own when they have something to say.
- If the user has just interjected, acknowledge their point in your first sentence and let it shape your next critique.
```

### 4.3 Judge system prompt (fixed — no templating besides topic and N)

**Visibility rule:** The Judge is **invisible to the user by default**. The Judge never appears in the main chat feed. Judge output is stored on the session and only rendered when the user explicitly opens the [JudgePanel.tsx](components/JudgePanel.tsx) via a "Show judge's thoughts" button in the session header. When closed, no indication of the Judge's existence is shown — no avatar, no banner, no badge.


```
You are the Judge, a silent arbiter observing a brainstorming debate between two agents (Visionary and Critic) about the topic: "{TOPIC}". The goal is for them to converge on exactly {N} strong candidate ideas.

You will be given the full transcript of the debate so far. Analyze it and decide whether the two agents have genuinely converged on {N} shared candidate ideas. Convergence requires BOTH of the following:
1. At least {N} distinct ideas are present in the transcript that BOTH agents have spoken positively about (the Critic has said something affirming or "lock in"-style about each, and the Visionary has proposed or reinforced each).
2. The most recent 2 exchanges are not proposing fundamentally new ideas — they are refining or agreeing on existing ones.

Respond ONLY with valid JSON matching this exact shape, with no prose before or after:
{
  "converged": boolean,
  "reason": string,
  "candidates": [{ "title": string, "summary": string }],
  "userSatisfied": boolean
}

Fields:
- "converged": true if and only if both conditions above are met.
- "reason": one sentence explaining your decision.
- "candidates": if converged is true, list exactly {N} candidates. Otherwise list your current best guess at the top candidates so far (may be fewer than {N}). Each summary is one sentence.
- "userSatisfied": true if and only if the most recent user message in the transcript expresses clear satisfaction or a desire to end the session (e.g. "I like this", "that's perfect", "we're done", "let's go with that"). Otherwise false. If there is no user message yet, this is false.
```

The Judge's response **must** be parsed as JSON. If parsing fails, retry the Judge call once with an appended system message `"Your previous response was not valid JSON. Respond with valid JSON only."`. If it fails again, treat the result as `{ converged: false, candidates: [], userSatisfied: false, reason: "judge parse failure" }` and continue the cycle.

---

## 5. Orchestrator behavior (the hardest part — read twice)

The orchestrator lives in [lib/session/orchestrator.ts](lib/session/orchestrator.ts) and is invoked from the SSE stream route. There is **one orchestrator instance per session**, stored alongside the session in the in-memory store. It exposes an async generator that the SSE route consumes and forwards as events.

### 5.1 State machine

```
idle ──start──▶ running ──judge says converged──▶ awaiting_user ──user responds──▶ running
                  │                                                                      │
                  │                                                                      │
                  └──user says "I'm done" OR user clicks end ──────────────────▶ ended ◀─┘
```

### 5.2 Main loop pseudocode (describe, do not code yet)

```
loop:
  if session.state == "ended": break
  if session.state == "awaiting_user":
    await pendingInterjection signal
    on signal:
      append user turn
      reset session.stance to { visionary: RESET_VISIONARY_STANCE, critic: RESET_CRITIC_STANCE }  // 0.75 and 0.625
      reset exchangesInCycle to 0
      set state to "running"
      emit "resumed" event
      continue

  # Visionary turn
  build visionary messages (system prompt with current descriptor, then all prior turns rendered as user/assistant messages — see §5.3)
  stream visionary response from LLM, emitting "agent_token" events per chunk
  append visionary turn with stanceAtTurn = session.stance.visionary
  emit "agent_complete" for visionary

  # Check for pending interjection between agent turns (DO NOT interrupt mid-message)
  if session.pendingInterjection is non-null:
    append user turn with the interjection text
    clear pendingInterjection
    emit "user_message" event
    # no stance change, no exchange increment — continue to critic

  # Critic turn
  build critic messages similarly
  stream critic response, emit tokens
  append critic turn with stanceAtTurn = session.stance.critic
  emit "agent_complete" for critic

  # Same interjection check between critic and next visionary
  if session.pendingInterjection is non-null:
    append user turn, clear, emit, no stance change

  # Advance decay (all constants imported from lib/config.ts)
  session.stance.visionary = max(MIN_VISIONARY_STANCE, session.stance.visionary - VISIONARY_DECAY_STEP)
  session.stance.critic    = min(MAX_CRITIC_STANCE,    session.stance.critic    + CRITIC_DECAY_STEP)
  session.exchangesInCycle += 1
  emit "stance_update" event with new stance

  # Judge check
  if session.exchangesInCycle >= MIN_EXCHANGES_BEFORE_JUDGE:
    judgeResult = run judge on full transcript
    emit "judge_result" event
    if judgeResult.userSatisfied == true:
      session.state = "ended"
      emit "ended" event
      break
    if judgeResult.converged == true OR session.exchangesInCycle >= MAX_EXCHANGES_PER_CYCLE:
      session.lastCandidates = judgeResult.candidates
      session.state = "awaiting_user"
      emit "paused" event with candidates
      continue  # will block on pendingInterjection at top of loop
```

### 5.3 How to render transcript as LLM messages

Each agent's LLM call receives:

1. A `system` message with that agent's system prompt (built from §4.1 or §4.2 with the current descriptor).
2. For each prior `Turn` in `session.turns`:
   - If the turn's agent matches the **current** agent, render it as `{ role: "assistant", content: turn.text }`.
   - Otherwise (the other agent, or the user), render it as `{ role: "user", content: "[" + turn.agent.toUpperCase() + "]: " + turn.text }`.

This way each agent sees its own prior output as its own assistant turns, and sees everything else as user turns with a clear speaker label. The Judge sees **everything** as user turns labeled the same way, preceded by its own fixed system prompt.

### 5.4 Interjection handling

- Client POSTs to `/api/session/[id]/message` with `{ text: string, isFeedback: boolean }`.
- The route looks up the session in the store and sets `session.pendingInterjection = text`.
- If `session.state == "awaiting_user"`, it also wakes the orchestrator (resolve the pending promise the loop is blocked on).
- If `session.state == "running"`, the orchestrator will pick up the interjection at the next between-turn check (§5.2).
- The `isFeedback` flag is only meaningful when `state == "awaiting_user"`; in that case it triggers the 75% reset. When `state == "running"`, the flag is ignored and no reset occurs.

### 5.5 Ending the session

Two paths:
1. **User clicks End button** → POST `/api/session/[id]/end` → orchestrator sets state to `"ended"`, emits `"ended"` event, closes SSE.
2. **Natural language detection** → Judge LLM returns `userSatisfied: true` → same effect.

In both cases, before closing the SSE, emit one final `"ended"` event with the current `lastCandidates` (if any) as the final result payload.

---

## 6. SSE event protocol (locked)

Every SSE event has the form `event: <type>\ndata: <json>\n\n`. Event types:

| `event:` | `data:` JSON shape | When emitted |
|---|---|---|
| `session_init` | `{ sessionId, topic, ideaCount, stance }` | Immediately on SSE connect |
| `agent_token` | `{ agent: "visionary"\|"critic", delta: string }` | For each streaming chunk from an agent LLM call |
| `agent_complete` | `{ agent, text, stance }` | After an agent finishes streaming |
| `user_message` | `{ text }` | When an interjection is appended mid-cycle |
| `stance_update` | `{ stance: { visionary, critic } }` | After each exchange's decay step |
| `judge_result` | `{ converged, reason, candidates, userSatisfied }` | After each Judge invocation |
| `paused` | `{ candidates }` | When orchestrator transitions to `awaiting_user` |
| `resumed` | `{ stance }` | After user feedback is processed and a new cycle begins |
| `ended` | `{ finalCandidates }` | On session end |
| `error` | `{ message }` | On unrecoverable error; SSE is then closed |

---

## 7. UI specification

### 7.1 Landing page — [app/page.tsx](app/page.tsx)

A single centered card on a `bg-neutral-950` full-viewport background. Card is `bg-neutral-900 border border-neutral-800 rounded-2xl p-8 max-w-xl w-full shadow-2xl`.

Contents:
- Product wordmark "Ricochet" in a large display font, `text-neutral-100`.
- One-line tagline "Two agents debate your idea until they agree" in `text-neutral-400`.
- Form (component [TopicForm.tsx](components/TopicForm.tsx)):
  - Label "Topic", large `textarea`, 2 rows, autofocus, placeholder "What should we brainstorm about?", required.
  - Label "How many ideas should they converge on?", `number` input, min 1, max 10, default 3.
  - Submit button "Start debating" — full-width, `bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold`.
- On submit: POST to `/api/session` with `{ topic, ideaCount }`, receive `{ sessionId }`, navigate to `/session/[id]`.

### 7.2 Session page — [app/session/[id]/page.tsx](app/session/[id]/page.tsx)

Full-viewport layout:

```
┌────────────────────────────────────────────────────────────────────┐
│  Header (60px): "Ricochet" · topic · [judge toggle] · [End button] │
├────────────────────────────────────────────┬───────────────────────┤
│                                            │              │
│   ChatView (scrolling message feed)        │  StanceMeter          │
│                                            │   sidebar             │
│                                            │   (240px)             │
│                                            │                       │
├────────────────────────────────────────────┴───────────────────────┤
│  InterjectBox (bottom, sticky, 72px)                               │
└────────────────────────────────────────────────────────────────────┘

JudgePanel slides in from the right on top of the sidebar when opened.
```

- Open an `EventSource` to `/api/session/[id]/stream` on mount.
- Maintain React state: `turns: Turn[]`, `stance: Stance`, `state: SessionState`, `candidates: CandidateIdea[] | null`, `judgeHistory: JudgeResult[]`, `judgePanelOpen: boolean` (default `false`).
- On `agent_token`: append delta to the in-progress assistant message bubble (or create one if this is the first token of a new turn).
- On `agent_complete`: finalize the bubble.
- On `stance_update`: update the stance meter with a smooth 300ms transition.
- On `paused`: show [CandidatePanel.tsx](components/CandidatePanel.tsx) as an inline card at the bottom of the chat feed (not a modal — keep the transcript visible). Panel shows the `N` candidates and prompts the user for feedback. User response goes through the same InterjectBox but with `isFeedback: true`.
- On `resumed`: dismiss the candidate panel.
- On `ended`: freeze the input, show a final summary card with `finalCandidates`.

**[MessageBubble.tsx](components/MessageBubble.tsx):** avatar circle on the left showing "V" (amber), "C" (slate), or "U" (neutral). Name label on top row — use the labels "Visionary", "Critic", and "You" respectively. Message text as flowing paragraphs. Max width 720px centered. Font: Inter or system sans. **The Judge is never rendered as a message bubble.** The Judge has no avatar, no label in the main feed, and no presence anywhere on the session page except inside [JudgePanel.tsx](components/JudgePanel.tsx).

**[JudgePanel.tsx](components/JudgePanel.tsx):** a slide-in panel from the right side of the viewport, hidden by default. Toggled by a small button in the session header labeled "Show judge's thoughts" (when closed) / "Hide judge's thoughts" (when open). The button uses neutral styling — do NOT use the emerald accent in the button itself, only inside the panel. The panel displays a reverse-chronological list of every `judge_result` event received so far. For each entry show: a timestamp, the `converged` and `userSatisfied` booleans as colored pills (emerald for true, neutral for false), the `reason` string, and the current `candidates` list with titles and summaries. When the panel is closed, there must be no visible indication of the latest judge result — no badge, no count, nothing. First-time users should not know the Judge exists unless they deliberately open the panel.

**[StanceMeter.tsx](components/StanceMeter.tsx):** two vertical bars, one labeled "Visionary" (amber), one "Critic" (slate). Each bar shows the current stance as a fill level. Also show the textual descriptor from the current bucket (§1.4) underneath each bar, in small `text-neutral-400` text. Transition with `transition-all duration-300 ease-out`.

**[InterjectBox.tsx](components/InterjectBox.tsx):** sticky bottom input. Single-line textarea that grows to max 4 rows. Submit on Enter (Shift+Enter for newline). Submit button "Send" on the right. When `state == "awaiting_user"`, the placeholder changes to "The agents are waiting for your thoughts…" and the button says "Send feedback". Otherwise placeholder is "Interject or narrow the discussion…" and button says "Send". A helper hint in small `text-neutral-500` text beneath the box reads: "Interject anytime. Tell them to focus on a specific idea, shift direction, or end the session when you're satisfied."

**[EndButton.tsx](components/EndButton.tsx):** in the header, `bg-neutral-800 hover:bg-red-500/20 hover:text-red-400 text-neutral-300 border border-neutral-700 rounded-lg px-3 py-1.5 text-sm`. Label "End session". Confirms with a native `confirm()` before POSTing to `/api/session/[id]/end`.

### 7.3 Visual polish requirements (mandatory — this is the demo)

- Every animated transition uses `ease-out` over `200–300ms`.
- Message bubbles fade+slide in from the bottom (16px translate) over 200ms.
- Token streaming should visibly type out — do not buffer and dump.
- Use `font-feature-settings: "cv11", "ss01"` on body text if the font supports it (Inter does).
- Respect `prefers-reduced-motion: reduce` — disable fade/slide when set.
- Every interactive element has a visible focus ring (`focus-visible:ring-2 focus-visible:ring-amber-400`).
- Loading state on the landing-page submit button while the session is being created (spinner + "Starting debate…").
- No emoji anywhere in the UI.

---

## 8. Execution phases

Do each phase fully before starting the next. At the end of each phase, run `npm run build` and fix any type or lint errors before continuing.

### Phase 1 — Bootstrap

- [ ] `npx create-next-app@latest . --typescript --tailwind --app --src-dir=false --import-alias "@/*"` (note: install into the current directory; do not create a subfolder)
- [ ] Install: `shadcn-ui`, `lucide-react` (icons), `@anthropic-ai/sdk`, `@google/generative-ai`, `openai`, `groq-sdk`
- [ ] Initialize shadcn/ui with `npx shadcn-ui@latest init` — choose New York style, neutral base color, CSS variables yes
- [ ] Create `.env.local.example` listing all five provider env vars with empty values
- [ ] Set `app/layout.tsx` to apply `className="dark bg-neutral-950 text-neutral-100"` on the `<html>` element and load Inter via `next/font/google`
- [ ] Replace `app/page.tsx` with a placeholder that just renders "Ricochet" centered — full landing form comes in Phase 6

**Definition of done:** `npm run dev` starts, browser shows dark-mode "Ricochet" text, no console errors.

### Phase 2 — LLM provider abstraction

- [ ] Create [lib/llm/types.ts](lib/llm/types.ts) with `ChatMessage` (`{ role: "system" | "user" | "assistant", content: string }`) and `LLMProvider` interface (`name: string; stream(messages, temperature): AsyncIterable<string>; complete(messages, temperature): Promise<string>`).
- [ ] Implement each of the 5 providers under [lib/llm/providers/](lib/llm/providers/). Each exports a factory that returns `LLMProvider | null` (returns null if its env var is missing). TerpAI uses the OpenAI SDK pointed at `TERPAI_BASE_URL`.
- [ ] Implement [lib/llm/index.ts](lib/llm/index.ts): on first call, try each provider factory in the §1.2 order, return the first non-null, memoize the result. Log `"[ricochet] selected LLM provider: <name>"` to stdout on selection. Expose `getProvider(): LLMProvider`.
- [ ] Provider `stream` must yield string deltas (just the new text chunk) as they arrive. `complete` returns the full concatenated response.

**Definition of done:** Write a scratch script (delete after) that calls `getProvider().complete([{role:"user", content:"say hi"}], 0.5)` and prints the result. Confirm it works end-to-end with whichever key you have.

### Phase 3 — Config, session store, and decay math

- [ ] Create [lib/config.ts](lib/config.ts) per §1.6. Export every constant and bucket array listed there. Add the header comment. This file is the **only** place any of these values may be written; every later phase must import from here.
- [ ] Create [lib/session/types.ts](lib/session/types.ts) per §3.
- [ ] Create [lib/session/store.ts](lib/session/store.ts): a module-level `Map<string, Session>`, plus `createSession(topic, ideaCount)`, `getSession(id)`, `updateSession(id, mutator)`. Also expose a per-session `EventEmitter`-style bus so the SSE route can subscribe.
- [ ] Create [lib/session/decay.ts](lib/session/decay.ts) with pure functions **that import every constant from `lib/config.ts`**:
  - `applyDecayStep(stance): Stance` — advances one exchange using `VISIONARY_DECAY_STEP`, `CRITIC_DECAY_STEP`, `MIN_VISIONARY_STANCE`, `MAX_CRITIC_STANCE`
  - `resetStance(): Stance` — returns `{ visionary: RESET_VISIONARY_STANCE, critic: RESET_CRITIC_STANCE }` (0.75 and 0.625)
  - `initialStance(): Stance` — returns `{ visionary: INITIAL_VISIONARY_STANCE, critic: INITIAL_CRITIC_STANCE }`
  - `visionaryDescriptor(v: number): { text: string; temperature: number }` — linear scan of `VISIONARY_BUCKETS` from `lib/config.ts`
  - `criticDescriptor(c: number): { text: string; temperature: number }` — linear scan of `CRITIC_BUCKETS` from `lib/config.ts`

**Definition of done:** No runtime — just `npm run build` passes.

### Phase 4 — Agent and judge modules

- [ ] Create [lib/agents/visionary.ts](lib/agents/visionary.ts): exports `buildVisionaryMessages(session, currentAgent="visionary")` returning `ChatMessage[]` per §5.3, and `runVisionary(session)` which streams via `getProvider().stream(...)` and yields deltas.
- [ ] Create [lib/agents/critic.ts](lib/agents/critic.ts): symmetric to visionary.
- [ ] Create [lib/agents/judge.ts](lib/agents/judge.ts): exports `runJudge(session): Promise<{ converged, reason, candidates, userSatisfied }>`. Uses `getProvider().complete(...)` at temperature `0.20`, parses JSON with retry-once logic per §4.3.

**Definition of done:** Each module builds. No orchestration yet.

### Phase 5 — Orchestrator and SSE plumbing

- [ ] Create [lib/sse.ts](lib/sse.ts) with `encodeSSE(event, data): Uint8Array` and a small helper to build a `ReadableStream` from an async generator.
- [ ] Create [lib/session/orchestrator.ts](lib/session/orchestrator.ts) as an **async generator function** `runOrchestrator(sessionId): AsyncGenerator<SSEEvent>`. Implements the loop in §5.2 exactly, yielding SSE event objects at every point marked "emit X" in the pseudocode. Uses the session store bus to `await` on `pendingInterjection` when paused.
- [ ] Create [app/api/session/route.ts](app/api/session/route.ts): POST handler. Validates `topic` is non-empty string and `ideaCount` is integer in `[1, 10]`. Calls `createSession`. Returns `{ sessionId }`. Returns 503 if no provider is configured.
- [ ] Create [app/api/session/[id]/stream/route.ts](app/api/session/[id]/stream/route.ts): GET handler, `runtime = "nodejs"`, `dynamic = "force-dynamic"`. Returns a `Response` whose body is a `ReadableStream` built from `runOrchestrator(id)` piped through `encodeSSE`. Sets headers `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, `Connection: keep-alive`.
- [ ] Create [app/api/session/[id]/message/route.ts](app/api/session/[id]/message/route.ts): POST handler. Reads `{ text, isFeedback }`, looks up session, sets `pendingInterjection`, emits the wake signal on the bus if `awaiting_user`. Returns 204.
- [ ] Create [app/api/session/[id]/end/route.ts](app/api/session/[id]/end/route.ts): POST handler. Sets session state to `"ended"`, emits wake signal so the orchestrator can exit cleanly. Returns 204.

**Definition of done:** Manually test by running `npm run dev`, POSTing to `/api/session` with curl, then `curl -N` on the stream endpoint, watching events flow. Visionary speaks, Critic responds, decay advances, Judge is eventually called. Kill the stream and confirm no server errors.

### Phase 6 — UI

- [ ] Build [components/TopicForm.tsx](components/TopicForm.tsx) per §7.1.
- [ ] Replace [app/page.tsx](app/page.tsx) with the landing page using the form.
- [ ] Build [app/session/[id]/page.tsx](app/session/[id]/page.tsx) with the layout in §7.2. Use a `useEffect` to open the `EventSource` and a `useReducer` to accumulate state from events.
- [ ] Build [components/ChatView.tsx](components/ChatView.tsx), [components/MessageBubble.tsx](components/MessageBubble.tsx), [components/StanceMeter.tsx](components/StanceMeter.tsx), [components/InterjectBox.tsx](components/InterjectBox.tsx), [components/CandidatePanel.tsx](components/CandidatePanel.tsx), [components/JudgePanel.tsx](components/JudgePanel.tsx), [components/EndButton.tsx](components/EndButton.tsx) per §7.2 and §7.3.
- [ ] Confirm the Judge is **invisible by default**: the main chat feed must contain zero Judge bubbles, banners, badges, or mentions. The only way to see Judge output is to click "Show judge's thoughts" in the header.
- [ ] Wire `InterjectBox` submission to POST `/api/session/[id]/message`. Wire `EndButton` to POST `/api/session/[id]/end`.
- [ ] Implement auto-scroll: when a new message bubble finalizes, scroll the chat feed to the bottom unless the user has scrolled up more than 200px (in which case show a "New messages ↓" pill that scrolls on click).

**Definition of done:** Full happy path works in a browser: enter topic, start, watch Visionary and Critic stream, see stance meters decay, see a Judge pause with candidates, type feedback, watch new cycle begin with reset stances, click end, see final summary.

### Phase 7 — Polish and manual QA pass

- [ ] Walk through every item in §7.3 and fix anything that doesn't match.
- [ ] Verify behavior under each failure mode:
  - No API keys present → 503 on session create
  - LLM error mid-stream → surface as `error` SSE event, session goes to `ended`, UI shows a banner
  - Judge returns malformed JSON twice → cycle continues with fallback result
  - User interjects mid-cycle → appears in transcript, no stance reset
  - User interjects during `awaiting_user` → stance resets to 75%
  - User types "perfect, let's go with that" during awaiting_user → Judge flags `userSatisfied: true` → session ends
  - User types "focus only on the second idea" mid-cycle → both agents narrow subsequent turns to that idea and stay narrowed until told otherwise
  - Opening and closing the "Show judge's thoughts" panel shows the full judge history; closing it leaves zero visible trace of the Judge
- [ ] Confirm no emoji in the rendered UI.
- [ ] Confirm dark mode is consistent everywhere (no white flashes).
- [ ] `npm run build` passes with zero warnings.

**Definition of done:** You would be comfortable demoing this on stage.

---

## 9. Explicitly out of scope for this plan

Do **not** implement any of the following. They are either future work or user-confirmed non-goals:

- MongoDB persistence for cross-request session reload and dashboard (see `lib/mongodb/client.ts`)
- Multi-user auth or accounts
- Session history or listing past sessions
- Export (PDF / markdown) of results
- Mobile-specific layouts beyond basic responsive stacking
- Editing the Visionary/Critic/Judge prompt templates from the UI
- Tuning the 75% reset value or decay steps from the UI
- Any form of analytics, telemetry, or logging beyond the single provider-selection stdout line
- Tests (no unit, integration, or e2e tests in the MVP — verify manually per phase definitions of done)

---

## 10. When something is unclear

If during execution you encounter an ambiguity not resolved by this document, **stop and ask** rather than guessing. Do not invent new files, new constants, new UI elements, or new event types. This plan is the contract.
