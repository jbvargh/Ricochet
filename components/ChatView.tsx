"use client";

import type { Turn } from "@/lib/session/types";
import { MessageBubble } from "@/components/MessageBubble";
import { useEffect, useRef, useState } from "react";

export function ChatView({
  turns,
  streaming,
}: {
  turns: Turn[];
  streaming: { agent: "visionary" | "critic"; text: string } | null;
}) {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    if (nearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      setTimeout(() => setShowNew(false), 0);
    } else {
      setTimeout(() => setShowNew(true), 0);
    }
  }, [turns.length]);

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
            el.scrollHeight - el.scrollTop - el.clientHeight < 200;
          if (nearBottom) setShowNew(false);
        }}
      >
        <div className="mx-auto flex max-w-[720px] flex-col gap-6">
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
