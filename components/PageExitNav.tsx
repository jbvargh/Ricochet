"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";

const linkClass =
  "font-mono text-[9px] uppercase tracking-[0.15em] text-neutral-500 transition-colors hover:text-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600";

type PageExitNavProps = {
  className?: string;
};

/**
 * Exit to the marketing home page. Omit on `/` (landing).
 */
export function PageExitNav({ className }: PageExitNavProps) {
  return (
    <nav
      className={cn(
        "flex shrink-0 items-center border-r border-neutral-800 pr-3",
        className,
      )}
      aria-label="Exit navigation"
    >
      <Link href="/" className={linkClass}>
        ← Home
      </Link>
    </nav>
  );
}
