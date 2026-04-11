"use client";

import type { CandidateIdea } from "@/lib/session/types";

export function CandidatePanel({
  candidates,
  ideaCount,
}: {
  candidates: CandidateIdea[];
  ideaCount: number;
}) {
  return (
    <div className="border-amber-500/30 bg-neutral-900/90 mx-auto mb-4 max-w-[720px] rounded-xl border p-4 shadow-lg backdrop-blur">
      <h3 className="text-neutral-100 mb-1 text-sm font-semibold">
        {ideaCount} candidate ideas
      </h3>
      <p className="text-neutral-400 mb-4 text-xs">
        The agents paused here. Share feedback below to start another cycle,
        or end the session when you are satisfied.
      </p>
      <ul className="flex flex-col gap-3">
        {candidates.map((c, i) => (
          <li
            key={`${c.title}-${i}`}
            className="border-neutral-800 rounded-lg border bg-neutral-950/60 p-3"
          >
            <div className="text-neutral-100 text-sm font-medium">{c.title}</div>
            <div className="text-neutral-400 mt-1 text-xs">{c.summary}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
