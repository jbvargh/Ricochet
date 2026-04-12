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
    <div className="border-neutral-800 bg-neutral-900/80 group mt-auto shrink-0 border-t px-2 py-3">
      <div className="flex items-start justify-between gap-1">
        <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
          Queued
        </p>
        <div className="flex shrink-0 gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
          <button
            type="button"
            aria-label="Edit queued message"
            onClick={() => void onEdit(text)}
            className="focus-visible:ring-amber-400 rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-amber-400 focus-visible:outline-none focus-visible:ring-2"
          >
            <Pencil className="size-3.5" strokeWidth={2} />
          </button>
          <button
            type="button"
            aria-label="Cancel queued message"
            onClick={() => void onCancel()}
            className="focus-visible:ring-amber-400 rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2"
          >
            <X className="size-3.5" strokeWidth={2} />
          </button>
        </div>
      </div>
      <p className="text-neutral-200 mt-1 line-clamp-3 text-[11px] leading-snug break-words">
        {text}
      </p>
      <p className="text-neutral-500 mt-2 text-[10px] leading-snug">
        Will appear after the current response.
      </p>
    </div>
  );
}
