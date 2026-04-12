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
