"use client";

import type { SessionState } from "@/lib/session/types";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

export function InterjectBox({
  sessionId,
  sessionState,
  disabled,
  inputLocked,
  onQueued,
  onSuccessfulSend,
  composeSeed,
  onComposeSeedApplied,
  queueSlot,
  actionEnd,
}: {
  sessionId: string;
  sessionState: SessionState;
  disabled: boolean;
  inputLocked: boolean;
  onQueued: (text: string) => void;
  /** Called after a message is accepted by the server (e.g. auto-resume after queue edit). */
  onSuccessfulSend?: () => void;
  composeSeed: { id: number; text: string } | null;
  onComposeSeedApplied: () => void;
  /** Renders above the composer (e.g. pending message queue). */
  queueSlot?: ReactNode;
  /** Renders to the right of Send (e.g. pause). */
  actionEnd?: ReactNode;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const awaiting = sessionState === "awaiting_user";
  const blocked = disabled || sending || inputLocked;

  useEffect(() => {
    if (!composeSeed) return;
    setText(composeSeed.text);
    onComposeSeedApplied();
  }, [composeSeed, onComposeSeedApplied]);

  async function send() {
    const trimmed = text.trim();
    if (!trimmed || sending || disabled || inputLocked) return;
    setSending(true);
    try {
      const res = await fetch(`/api/session/${sessionId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: trimmed,
          isFeedback: awaiting,
        }),
      });
      if (res.ok) {
        setText("");
        onQueued(trimmed);
        onSuccessfulSend?.();
      }
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
    <div className="sticky bottom-0 z-20 shrink-0 border-t border-neutral-800 bg-neutral-950/95 px-4 py-2 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-2">
        {queueSlot}
        <div className="flex items-end gap-2">
          <textarea
            rows={1}
            value={text}
            disabled={blocked}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={
              inputLocked
                ? "Your message is queued…"
                : awaiting
                  ? "The agents are waiting for your thoughts…"
                  : "Interject or narrow the discussion…"
            }
            className="min-h-10 max-h-32 min-w-0 flex-1 resize-none rounded-sm border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={blocked}
            className="shrink-0 border border-neutral-700 bg-neutral-800 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.15em] text-neutral-200 transition-colors hover:bg-neutral-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
          >
            {awaiting ? "Send feedback" : "Send"}
          </button>
          {actionEnd ? (
            <div className="flex shrink-0 flex-col justify-end">{actionEnd}</div>
          ) : null}
        </div>
        <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-neutral-600">
          Interject // focus, redirect, or end when satisfied
        </p>
      </div>
    </div>
  );
}
