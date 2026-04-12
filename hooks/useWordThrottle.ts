"use client";

import type { SessionState } from "@/lib/session/types";
import { useCallback, useEffect, useRef, useState } from "react";

/** How often the tick runs (ms). Lower = smoother updates. */
const TICK_MS = 100;
/** Words revealed per tick. Tune with `TICK_MS` for effective WPM. */
const WORDS_PER_TICK = 1;

type StreamingInput = { agent: "visionary" | "critic"; text: string } | null;
type ThrottledOutput = {
  agent: "visionary" | "critic";
  displayedText: string;
} | null;

type DrainBuffer = {
  agent: "visionary" | "critic";
  words: string[];
};

export function useWordThrottle(
  streaming: StreamingInput,
  sessionState: SessionState,
  /** True after `agent_complete` SSE — the model has finished; text will not grow further. */
  streamFinished: boolean,
  onDrainComplete: () => void,
): {
  throttledStreaming: ThrottledOutput;
  isPaused: boolean;
  togglePause: () => void;
} {
  const [displayedWordCount, setDisplayedWordCount] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const drainRef = useRef<DrainBuffer | null>(null);
  const onDrainCompleteRef = useRef(onDrainComplete);
  onDrainCompleteRef.current = onDrainComplete;

  const streamingRef = useRef(streaming);
  const streamFinishedRef = useRef(streamFinished);
  const isPausedRef = useRef(isPaused);

  streamingRef.current = streaming;
  streamFinishedRef.current = streamFinished;
  isPausedRef.current = isPaused;

  const prevStreamingRef = useRef(streaming);

  // When `streaming` becomes null, capture drain buffer if words remain
  useEffect(() => {
    const prev = prevStreamingRef.current;
    prevStreamingRef.current = streaming;

    if (prev && !streaming) {
      const words = prev.text.split(/\s+/).filter(Boolean);
      if (displayedWordCount < words.length) {
        drainRef.current = { agent: prev.agent, words };
      } else {
        drainRef.current = null;
      }
    }
  }, [streaming, displayedWordCount]);

  // Reset word count when a new streaming bubble starts after `null`
  const hadStreamingRef = useRef(false);
  useEffect(() => {
    if (streaming && !hadStreamingRef.current) {
      setDisplayedWordCount(0);
    }
    hadStreamingRef.current = Boolean(streaming);
  }, [streaming]);

  // Stable tick — does not restart when tokens append to `streaming`
  useEffect(() => {
    const id = setInterval(() => {
      if (isPausedRef.current) return;

      let words: string[];
      if (drainRef.current) {
        words = drainRef.current.words;
      } else {
        const s = streamingRef.current;
        if (!s) return;
        words = s.text.split(/\s+/).filter(Boolean);
      }

      if (words.length === 0) return;

      setDisplayedWordCount((prev) => {
        if (prev >= words.length) return prev;
        return Math.min(prev + WORDS_PER_TICK, words.length);
      });
    }, TICK_MS);

    return () => clearInterval(id);
  }, []);

  // Finish current turn when caught up and `agent_complete` has been received
  useEffect(() => {
    if (isPaused) return;
    if (!streaming || !streamFinished) return;
    const words = streaming.text.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      onDrainCompleteRef.current();
      return;
    }
    if (displayedWordCount >= words.length) {
      onDrainCompleteRef.current();
    }
  }, [streaming, displayedWordCount, streamFinished, isPaused]);

  // Drain buffer finished (streaming was cleared externally, e.g. end session)
  useEffect(() => {
    if (!drainRef.current) return;
    const words = drainRef.current.words;
    if (displayedWordCount >= words.length) {
      drainRef.current = null;
      onDrainCompleteRef.current();
    }
  }, [displayedWordCount]);

  // Fast-forward on session end
  useEffect(() => {
    if (sessionState === "ended") {
      if (drainRef.current) {
        setDisplayedWordCount(drainRef.current.words.length);
        drainRef.current = null;
        onDrainCompleteRef.current();
      }
      setIsPaused(false);
    }
  }, [sessionState]);

  const togglePause = useCallback(() => setIsPaused((p) => !p), []);

  let throttledStreaming: ThrottledOutput = null;

  if (streaming) {
    const words = streaming.text.split(/\s+/).filter(Boolean);
    const shown = words.slice(0, displayedWordCount).join(" ");
    if (shown) {
      throttledStreaming = {
        agent: streaming.agent,
        displayedText: shown,
      };
    }
  } else if (drainRef.current) {
    const words = drainRef.current.words;
    const shown = words.slice(0, displayedWordCount).join(" ");
    if (shown) {
      throttledStreaming = {
        agent: drainRef.current.agent,
        displayedText: shown,
      };
    }
  }

  return { throttledStreaming, isPaused, togglePause };
}
