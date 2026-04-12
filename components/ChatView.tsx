"use client";

import type { Turn } from "@/lib/session/types";
import { MessageBubble } from "@/components/MessageBubble";
import { useEffect, useRef, useState } from "react";

const NEAR_BOTTOM_PX = 200;

export function ChatView({
  turns,
  streaming,
}: {
  turns: Turn[];
  streaming: { agent: "visionary" | "critic"; text: string } | null;
}) {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const streamingRef = useRef(streaming);
  streamingRef.current = streaming;
  const syncScrollAffordanceRef = useRef<() => void>(() => {});
  const [showNew, setShowNew] = useState(false);

  syncScrollAffordanceRef.current = () => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    if (nearBottom) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          bottomRef.current?.scrollIntoView({
            behavior:
              streamingRef.current != null ? "auto" : "smooth",
          });
        });
      });
      setTimeout(() => setShowNew(false), 0);
    } else {
      setTimeout(() => setShowNew(true), 0);
    }
  };

  useEffect(() => {
    syncScrollAffordanceRef.current();
  }, [turns.length, streaming?.text]);

  useEffect(() => {
    const col = contentRef.current;
    if (!col) return;
    const ro = new ResizeObserver(() => {
      syncScrollAffordanceRef.current();
    });
    ro.observe(col);
    return () => ro.disconnect();
  }, []);

  function scrollToBottom() {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowNew(false);
  }

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        className="h-full overflow-y-auto px-4 py-4"
        onScroll={() => {
          const el = scrollRef.current;
          if (!el) return;
          const nearBottom =
            el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
          if (nearBottom) setShowNew(false);
        }}
      >
        <div
          ref={contentRef}
          className="mx-auto flex max-w-[720px] flex-col gap-6"
        >
          {turns.map((t) =>
            t.agent === "visionary" ||
            t.agent === "critic" ||
            t.agent === "user" ? (
              <MessageBubble
                key={t.id}
                agent={t.agent}
                text={t.text}
              />
            ) : null,
          )}
          {streaming ? (
            <MessageBubble
              agent={streaming.agent}
              text={streaming.text}
              animate={false}
            />
          ) : null}
          <div ref={bottomRef} />
        </div>
      </div>
      {showNew ? (
        <button
          type="button"
          onClick={scrollToBottom}
          className="focus-visible:ring-amber-400 absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full border border-neutral-700 bg-neutral-900 px-4 py-1.5 text-xs text-neutral-200 shadow-lg transition-colors hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2"
        >
          New messages ↓
        </button>
      ) : null}
    </div>
  );
}
