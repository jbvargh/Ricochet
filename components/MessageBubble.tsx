"use client";

import { cn } from "@/lib/utils";

export type BubbleAgent = "visionary" | "critic" | "user";

const labels: Record<BubbleAgent, string> = {
  visionary: "Visionary",
  critic: "Critic",
  user: "You",
};

const avatars: Record<BubbleAgent, string> = {
  visionary: "V",
  critic: "C",
  user: "U",
};

const avatarStyles: Record<BubbleAgent, string> = {
  visionary: "bg-amber-500/20 text-amber-500 border-amber-500/40",
  critic: "bg-slate-500/20 text-slate-400 border-slate-400/40",
  user: "bg-neutral-700 text-neutral-200 border-neutral-600",
};

export function MessageBubble({
  agent,
  text,
  animate = true,
}: {
  agent: BubbleAgent;
  text: string;
  animate?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex max-w-[720px] gap-3",
        animate && "ricochet-bubble-in",
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
          avatarStyles[agent] ?? "bg-neutral-800 text-neutral-200",
        )}
        aria-hidden
      >
        {avatars[agent] ?? "?"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-neutral-400 mb-1 text-xs font-medium uppercase tracking-wide">
          {labels[agent] ?? agent}
        </div>
        <div className="text-neutral-100 whitespace-pre-wrap text-sm leading-relaxed">
          {text}
        </div>
      </div>
    </div>
  );
}
