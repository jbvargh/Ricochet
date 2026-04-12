import Link from "next/link";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  /** When true, "Spark" uses the same color as surrounding copy (e.g. grey body text). */
  muted?: boolean;
  /** Classes for the "Spark" segment; ignored when `muted` is true. Defaults to yellow. */
  sparkClassName?: string;
};

export function TerpSparkWordmark({
  className,
  muted = false,
  sparkClassName = "text-yellow-400",
}: Props) {
  return (
    <span className={cn("inline", className)}>
      Terp
      <span className={muted ? "text-inherit" : sparkClassName}>Spark</span>
    </span>
  );
}

const defaultTBox =
  "flex h-5 w-5 shrink-0 items-center justify-center bg-red-700 font-mono text-[9px] font-black text-white";

const defaultWordmark =
  "font-display shrink-0 text-sm font-black italic uppercase tracking-widest text-neutral-100";

export type TerpSparkHomeLinkProps = {
  className?: string;
  tBoxClassName?: string;
  wordmarkClassName?: string;
};

/** T badge + TerpSpark wordmark linking to home (`/`). */
export function TerpSparkHomeLink({
  className,
  tBoxClassName = defaultTBox,
  wordmarkClassName = defaultWordmark,
}: TerpSparkHomeLinkProps) {
  return (
    <Link
      href="/"
      className={cn(
        "flex shrink-0 items-center gap-2 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600",
        className,
      )}
      aria-label="TerpSpark home"
    >
      <span className={tBoxClassName}>T</span>
      <TerpSparkWordmark className={wordmarkClassName} />
    </Link>
  );
}
