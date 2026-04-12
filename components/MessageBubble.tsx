"use client";

import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

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
        <div className="prose prose-invert prose-sm max-w-none text-neutral-100 text-sm leading-relaxed [&_ul]:my-1 [&_ul]:ml-4 [&_ul]:list-disc [&_ul]:space-y-0.5 [&_ol]:my-1 [&_ol]:ml-4 [&_ol]:list-decimal [&_ol]:space-y-0.5 [&_p]:mb-2 [&_p:last-child]:mb-0">
          <ReactMarkdown>{text}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
