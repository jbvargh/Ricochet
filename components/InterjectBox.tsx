"use client";

import type { SessionState } from "@/lib/session/types";
import { useState } from "react";

export function InterjectBox({
  sessionId,
  sessionState,
  disabled,
}: {
  sessionId: string;
  sessionState: SessionState;
  disabled: boolean;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const awaiting = sessionState === "awaiting_user";

  async function send() {
    const trimmed = text.trim();
    if (!trimmed || sending || disabled) return;
    setSending(true);
    try {
      await fetch(`/api/session/${sessionId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: trimmed,
          isFeedback: awaiting,
        }),
      });
      setText("");
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <div className="border-neutral-800 bg-neutral-950/95 sticky bottom-0 z-20 flex h-[72px] shrink-0 items-center border-t px-4 py-2 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-1">
        <div className="flex gap-2">
          <textarea
            rows={1}
            value={text}
            disabled={disabled || sending}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={
              awaiting
                ? "The agents are waiting for your thoughts…"
                : "Interject or narrow the discussion…"
            }
            className="focus-visible:ring-amber-400 max-h-32 min-h-10 flex-1 resize-none rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={disabled || sending}
            className="focus-visible:ring-amber-400 shrink-0 rounded-lg bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2"
          >
            {awaiting ? "Send feedback" : "Send"}
          </button>
        </div>
        <p className="text-neutral-500 text-[11px] leading-snug">
          Interject anytime. Tell them to focus on a specific idea, shift
          direction, or end the session when you&apos;re satisfied.
        </p>
      </div>
    </div>
  );
}
