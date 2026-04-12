"use client";

import { Pencil, X } from "lucide-react";

export function PendingMessageQueue({
  text,
  onCancel,
  onEdit,
}: {
  text: string;
  onCancel: () => void | Promise<void>;
  onEdit: (text: string) => void | Promise<void>;
}) {
  return (
    <div className="group shrink-0 rounded-sm border border-neutral-800 bg-neutral-900/80 px-3 py-2">
      <div className="flex items-start justify-between gap-1">
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-neutral-600">
          // Queued
        </p>
        <div className="flex shrink-0 gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
          <button
            type="button"
            aria-label="Edit queued message"
            onClick={() => void onEdit(text)}
            className="rounded-sm p-1 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
          >
            <Pencil className="size-3.5" strokeWidth={2} />
          </button>
          <button
            type="button"
            aria-label="Cancel queued message"
            onClick={() => void onCancel()}
            className="rounded-sm p-1 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
          >
            <X className="size-3.5" strokeWidth={2} />
          </button>
        </div>
      </div>
      <p className="text-neutral-200 mt-1 line-clamp-3 text-[11px] leading-snug break-words">
        {text}
      </p>
      <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.1em] text-neutral-700">
        Pending // after current response
      </p>
    </div>
  );
}
