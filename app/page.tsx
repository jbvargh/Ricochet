import { TerpSparkWordmark } from "@/components/TerpSparkWordmark";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-950">
      {/* Nav bar */}
      <header className="flex h-[56px] shrink-0 items-center justify-between border-b border-neutral-800 px-8">
        <TerpSparkWordmark className="font-display text-sm font-black italic uppercase tracking-widest text-neutral-100" />
        <div className="flex items-center gap-4">
          <Link
            href="/login?mode=signup"
            className="text-xs font-bold uppercase tracking-widest text-neutral-400 transition-colors hover:text-red-500"
          >
            Sign up
          </Link>
          <Link
            href="/login"
            className="text-xs font-bold uppercase tracking-widest text-neutral-400 transition-colors hover:text-red-500"
          >
            Sign in →
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Left — text */}
        <div className="flex flex-1 flex-col justify-center px-8 py-20 lg:px-16 lg:py-0">
          {/* System label */}
          <p className="mb-8 font-mono text-[10px] font-medium uppercase tracking-[0.25em] text-red-600">
            <TerpSparkWordmark className="font-mono" /> // Debate Engine // v1.0
          </p>

          {/* Hero headline */}
          <h1 className="font-display font-black uppercase leading-none text-neutral-100">
            <span className="block text-[clamp(3.5rem,8vw,7rem)] tracking-tight">
              Two agents.
            </span>
            <span className="block text-[clamp(3.5rem,8vw,7rem)] tracking-tight">
              One idea.
            </span>
            <span className="block text-[clamp(3.5rem,8vw,7rem)] italic tracking-tight text-red-600">
              <TerpSparkWordmark />
              .
            </span>
          </h1>

          {/* Tagline */}
          <p className="mt-8 max-w-sm text-sm leading-relaxed text-neutral-400">
            <TerpSparkWordmark muted /> pairs a visionary with a critic: bold ideas meet
            rigorous stress-testing until both agents converge on the strongest version of
            your thinking.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href="/dashboard/new"
              className="border border-red-700 bg-red-700 px-8 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-red-600"
            >
              Get started
            </Link>
            <Link
              href="/login"
              className="border border-dashed border-neutral-600 px-8 py-3 text-xs font-bold uppercase tracking-widest text-neutral-400 transition-colors hover:border-red-700 hover:text-red-500"
            >
              Sign in
            </Link>
            <Link
              href="/login?mode=signup"
              className="border border-dashed border-neutral-600 px-8 py-3 text-xs font-bold uppercase tracking-widest text-neutral-400 transition-colors hover:border-red-700 hover:text-red-500"
            >
              Sign up
            </Link>
          </div>
        </div>

        {/* Right — feature tiles or decorative */}
        <div className="flex w-full flex-col justify-center gap-px border-t border-neutral-800 lg:w-[360px] lg:border-l lg:border-t-0">
          {[
            {
              tag: "01 // Propose",
              label: "Visionary",
              labelClass: "text-yellow-400",
              desc: "Pitches the most ambitious interpretation of your idea — unrestrained, forward-looking.",
            },
            {
              tag: "02 // Challenge",
              label: "Critic",
              labelClass: "text-red-500",
              desc: "Stress-tests every claim, surfaces blind spots, and demands rigour.",
            },
            {
              tag: "03 // Converge",
              label: "Resolution",
              labelClass: "text-neutral-100",
              desc: "Both agents lock on the strongest candidates — ready for you to act on.",
            },
          ].map(({ tag, label, labelClass, desc }) => (
            <div
              key={label}
              className="flex flex-col gap-2 border-b border-neutral-800 px-8 py-7 last:border-b-0"
            >
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-neutral-600">
                {tag}
              </p>
              <p
                className={`font-display text-lg font-black uppercase tracking-wide ${labelClass}`}
              >
                {label}
              </p>
              <p className="text-xs leading-relaxed text-neutral-500">{desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer strip */}
      <footer className="flex h-10 shrink-0 items-center border-t border-neutral-800 px-8">
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-neutral-700">
          <TerpSparkWordmark className="font-mono" muted /> // Debate Engine // No account needed to start
        </p>
      </footer>
    </div>
  );
}
