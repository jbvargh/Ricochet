"use client";

import type { Stance } from "@/lib/session/types";
import {
  criticDescriptor,
  visionaryDescriptor,
} from "@/lib/session/decay";

export function StanceMeter({ stance }: { stance: Stance }) {
  const v = visionaryDescriptor(stance.visionary);
  const c = criticDescriptor(stance.critic);

  return (
    <div className="flex h-full flex-col gap-6 px-2 py-4">
      <div className="flex flex-1 flex-col items-center gap-2">
        <span className="text-amber-500 text-xs font-medium">Visionary</span>
        <div className="bg-neutral-800 flex h-40 w-8 overflow-hidden rounded-full border border-neutral-700">
          <div
            className="bg-amber-500 mt-auto w-full transition-all duration-300 ease-out"
            style={{ height: `${stance.visionary * 100}%` }}
          />
        </div>
        <p className="text-neutral-400 text-center text-[11px] leading-snug">
          {v.text}
        </p>
      </div>
      <div className="flex flex-1 flex-col items-center gap-2">
        <span className="text-slate-400 text-xs font-medium">Critic</span>
        <div className="bg-neutral-800 flex h-40 w-8 overflow-hidden rounded-full border border-neutral-700">
          <div
            className="bg-slate-400 mt-auto w-full transition-all duration-300 ease-out"
            style={{ height: `${stance.critic * 100}%` }}
          />
        </div>
        <p className="text-neutral-400 text-center text-[11px] leading-snug">
          {c.text}
        </p>
      </div>
    </div>
  );
}
