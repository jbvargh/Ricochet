import Link from "next/link";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  /** When true, the accent segment uses the same color as surrounding copy. */
  muted?: boolean;
  /** Classes for the accent segment ("chet"); ignored when `muted` is true. Defaults to yellow. */
  accentClassName?: string;
};

export function RicochetWordmark({
  className,
  muted = false,
  accentClassName = "text-yellow-400",
}: Props) {
  return (
    <span className={cn("inline", className)}>
      Rico
      <span className={muted ? "text-inherit" : accentClassName}>chet</span>
    </span>
  );
}

const defaultBadge =
  "flex h-5 w-5 shrink-0 items-center justify-center bg-red-700 font-mono text-[9px] font-black text-white";

const defaultWordmark =
  "font-display shrink-0 text-sm font-black italic uppercase tracking-widest text-neutral-100";

export type RicochetHomeLinkProps = {
  className?: string;
  badgeClassName?: string;
  wordmarkClassName?: string;
};

/** R badge + Ricochet wordmark linking to home (`/`). */
export function RicochetHomeLink({
  className,
  badgeClassName = defaultBadge,
  wordmarkClassName = defaultWordmark,
}: RicochetHomeLinkProps) {
  return (
    <Link
      href="/"
      className={cn(
        "flex shrink-0 items-center gap-2 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600",
        className,
      )}
      aria-label="Ricochet home"
    >
      <span className={badgeClassName}>R</span>
      <RicochetWordmark className={wordmarkClassName} />
    </Link>
  );
}
