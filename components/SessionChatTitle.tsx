"use client";

import { Pencil } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const TITLE_MAX = 120;

export function SessionChatTitle({
  title,
  onSave,
  disabled,
}: {
  title: string;
  onSave: (title: string) => void;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const skipBlurSaveRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(title);
  }, [title, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function save() {
    const t = draft.trim();
    if (t) onSave(t);
    setEditing(false);
  }

  function cancel() {
    setDraft(title);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex min-w-0 max-w-[min(50vw,360px)] flex-1 items-center">
        <input
          ref={inputRef}
          value={draft}
          maxLength={TITLE_MAX}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (skipBlurSaveRef.current) return;
            save();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              skipBlurSaveRef.current = true;
              cancel();
              queueMicrotask(() => {
                skipBlurSaveRef.current = false;
              });
            }
          }}
          aria-label="Chat title"
          className="min-w-0 flex-1 rounded-sm border border-neutral-600 bg-neutral-900 px-2 py-1 text-sm text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
        />
      </div>
    );
  }

  const show = title.trim() || "…";

  return (
    <div className="group flex min-w-0 max-w-[min(50vw,360px)] flex-1 items-center gap-1">
      <span
        className="text-neutral-300 truncate text-sm"
        title={title.trim() ? title : undefined}
      >
        {show}
      </span>
      {!disabled ? (
        <button
          type="button"
          aria-label="Rename chat"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setEditing(true)}
          className="shrink-0 rounded-sm p-1 text-neutral-500 opacity-100 transition-opacity hover:bg-neutral-800 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 md:opacity-0 md:group-hover:opacity-100"
        >
          <Pencil className="size-3.5" strokeWidth={2} />
        </button>
      ) : null}
    </div>
  );
}
