"use client";

import type { JudgeResult } from "@/lib/session/types";

export function JudgePanel({
  open,
  history,
  onClose,
}: {
  open: boolean;
  history: Array<JudgeResult & { at: number }>;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close judge panel"
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
      />
      <aside className="border-neutral-800 bg-neutral-950 fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l shadow-2xl transition-transform duration-300 ease-out">
        <div className="border-neutral-800 flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-emerald-400 text-sm font-semibold">
            Judge notes
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm px-2 py-1 text-xs text-neutral-400 hover:text-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
          >
            Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <ul className="flex flex-col gap-4">
            {[...history].reverse().map((h, idx) => (
              <li
                key={`${h.at}-${idx}`}
                className="rounded-sm border border-neutral-800 bg-neutral-900/80 p-3 text-xs"
              >
                <div className="text-neutral-500 mb-2 flex flex-wrap items-center gap-2">
                  <time dateTime={new Date(h.at).toISOString()}>
                    {new Date(h.at).toLocaleTimeString()}
                  </time>
                  <span
                    className={
                      h.converged
                        ? "rounded-sm bg-emerald-500/20 px-2 py-0.5 text-emerald-400"
                        : "rounded-sm bg-neutral-800 px-2 py-0.5 text-neutral-400"
                    }
                  >
                    converged: {String(h.converged)}
                  </span>
                  <span
                    className={
                      h.userSatisfied
                        ? "rounded-sm bg-emerald-500/20 px-2 py-0.5 text-emerald-400"
                        : "rounded-sm bg-neutral-800 px-2 py-0.5 text-neutral-400"
                    }
                  >
                    userSatisfied: {String(h.userSatisfied)}
                  </span>
                </div>
                <p className="text-neutral-200 mb-3">{h.reason}</p>
                <ul className="flex flex-col gap-2">
                  {h.candidates.map((c, i) => (
                    <li key={`${c.title}-${i}`} className="text-neutral-400">
                      <span className="text-neutral-100 font-medium">
                        {c.title}
                      </span>
                      {" — "}
                      {c.summary}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </>
  );
}
