"use client";

import type { Stance } from "@/lib/session/types";
import {
  criticDescriptor,
  visionaryDescriptor,
} from "@/lib/session/decay";

function HorizontalMeterRow({
  label,
  labelClass,
  hint,
  fillClass,
  fillPct,
  descriptor,
}: {
  label: string;
  labelClass: string;
  hint: string;
  fillClass: string;
  fillPct: number;
  descriptor: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className={`text-xs font-medium ${labelClass}`}>{label}</span>
      <p className="text-[10px] leading-snug text-neutral-500">{hint}</p>
      <div className="flex items-center gap-2">
        <span className="w-7 shrink-0 text-[9px] text-neutral-500">Low</span>
        <div className="bg-neutral-800 flex h-2.5 min-w-0 flex-1 overflow-hidden rounded-full border border-neutral-700">
          <div
            className={`${fillClass} h-full rounded-full transition-all duration-300 ease-out`}
            style={{ width: `${fillPct * 100}%` }}
          />
        </div>
        <span className="w-7 shrink-0 text-right text-[9px] text-neutral-500">
          High
        </span>
      </div>
      <p className="text-[11px] leading-snug text-neutral-400">{descriptor}</p>
    </div>
  );
}

export function StanceMeter({ stance }: { stance: Stance }) {
  const v = visionaryDescriptor(stance.visionary);
  const c = criticDescriptor(stance.critic);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-2 py-3">
      <HorizontalMeterRow
        label="Visionary"
        labelClass="text-amber-500"
        hint="Fuller bar = more ambitious; emptier = more modest."
        fillClass="bg-amber-500"
        fillPct={stance.visionary}
        descriptor={v.text}
      />
      <HorizontalMeterRow
        label="Critic"
        labelClass="text-slate-400"
        hint="Fuller bar = more critical; emptier = gentler."
        fillClass="bg-slate-400"
        fillPct={stance.critic}
        descriptor={c.text}
      />
    </div>
  );
}
