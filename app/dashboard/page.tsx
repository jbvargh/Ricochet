"use client";

import { PageExitNav } from "@/components/PageExitNav";
import { TerpSparkWordmark } from "@/components/TerpSparkWordmark";
import {
  type DashboardSession,
  getDashboardSessions,
  removeDashboardSession,
} from "@/lib/dashboard/storage";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StateBadge({ state, hasResolved }: { state: DashboardSession["state"]; hasResolved: boolean }) {
  if (state === "ended" && hasResolved) {
    return (
      <span className="border border-emerald-700/60 bg-emerald-950/60 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-emerald-400">
        Resolved
      </span>
    );
  }
  if (state === "ended") {
    return (
      <span className="border border-neutral-700 bg-neutral-800 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-neutral-400">
        Ended
      </span>
    );
  }
  if (state === "awaiting_user") {
    return (
      <span className="border border-yellow-600/60 bg-yellow-950/60 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-yellow-400">
        Awaiting
      </span>
    );
  }
  return (
    <span className="border border-blue-700/60 bg-blue-950/60 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-blue-400">
      Active
    </span>
  );
}

function SessionCard({
  session,
  index,
  onOpen,
  onRemove,
}: {
  session: DashboardSession;
  index: number;
  onOpen: () => void;
  onRemove: (e: React.MouseEvent) => void;
}) {
  const hasResolved =
    session.state === "ended" &&
    Array.isArray(session.lastCandidates) &&
    session.lastCandidates.length > 0;

  const refId = `REF_${String(index + 1).padStart(3, "0")}`;

  return (
    <div
      className="group relative flex cursor-pointer flex-col gap-3 border border-neutral-800 bg-neutral-900 p-5 transition-colors hover:border-neutral-600 hover:bg-neutral-800/70"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpen(); }}
    >
      {/* Card header row */}
      <div className="flex items-start justify-between gap-2">
        <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-neutral-600">
          {refId}
        </p>
        <div className="flex items-center gap-2">
          <StateBadge state={session.state} hasResolved={hasResolved} />
          <button
            type="button"
            aria-label="Remove session"
            onClick={onRemove}
            className="p-1 text-neutral-700 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Topic */}
      <p className="text-sm font-semibold leading-snug text-neutral-100">
        {session.topic}
      </p>

      {/* Candidates or turn count */}
      {hasResolved && session.lastCandidates ? (
        <div className="flex flex-col gap-1">
          <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-neutral-600">
            Top ideas
          </p>
          <ul className="flex flex-col gap-0.5">
            {session.lastCandidates.slice(0, 2).map((c, i) => (
              <li key={i} className="truncate text-xs text-neutral-400">
                · {c.title}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-neutral-600">
          {session.turnCount > 0
            ? `${session.turnCount} turn${session.turnCount !== 1 ? "s" : ""}`
            : "Just started"}
        </p>
      )}

      {/* Footer */}
      <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-neutral-700">
        Updated: {formatDate(session.createdAt)}
      </p>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<DashboardSession[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [meRes, list] = await Promise.all([
        fetch("/api/auth/me", { credentials: "include", cache: "no-store" }),
        getDashboardSessions(),
      ]);
      if (cancelled) return;
      if (meRes.ok) {
        const data = (await meRes.json()) as { email?: string };
        setUserEmail(data.email ?? null);
      }
      setSessions(list);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSignOut() {
    await fetch("/api/auth/session", {
      method: "DELETE",
      credentials: "include",
    });
    try {
      await signOut(getFirebaseAuth());
    } catch {
      /* ignore */
    }
    router.push("/");
  }

  function handleRemove(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    void (async () => {
      await removeDashboardSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    })();
  }

  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Header */}
      <header className="flex h-[56px] shrink-0 items-center justify-between border-b border-neutral-800 px-6">
        <div className="flex items-center gap-3">
          <PageExitNav />
          <span className="flex h-5 w-5 items-center justify-center bg-red-700 text-[9px] font-black text-white">
            T
          </span>
          <TerpSparkWordmark className="font-display text-sm font-black italic uppercase tracking-widest text-neutral-100" />
          <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-neutral-600">
            // Sessions
          </span>
        </div>
        <div className="flex items-center gap-4">
          {userEmail ? (
            <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-neutral-600">
              {userEmail}
            </span>
          ) : null}
          <button
            type="button"
            onClick={handleSignOut}
            className="border border-neutral-700 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.15em] text-neutral-400 transition-colors hover:border-red-700 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        {/* Page heading with breadcrumb */}
        <div className="mb-8">
          <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.25em] text-red-600">
            Archive / Sessions
          </p>
          <div className="flex items-end justify-between gap-4">
            <h1 className="font-display text-4xl font-black uppercase tracking-tight text-neutral-100">
              Your Sessions
            </h1>
            <button
              type="button"
              onClick={() => router.push("/dashboard/new")}
              className="shrink-0 border border-dashed border-red-700/70 px-5 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-red-500 transition-colors hover:bg-red-950/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
            >
              + New_idea
            </button>
          </div>
        </div>

        {sessions.length === 0 ? (
          <div className="flex flex-col items-center gap-6 border border-dashed border-neutral-800 py-24 text-center">
            <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-neutral-600">
              No_sessions_found
            </p>
            <p className="max-w-xs text-sm leading-relaxed text-neutral-500">
              Start a new idea and it will appear here.
            </p>
            <button
              type="button"
              onClick={() => router.push("/dashboard/new")}
              className="border border-red-700 bg-red-700 px-6 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-white transition-colors hover:bg-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
            >
              Initialize_first_session
            </button>
          </div>
        ) : (
          <div className="grid gap-px border border-neutral-800 bg-neutral-800 sm:grid-cols-2 lg:grid-cols-3">
            {sessions.map((s, i) => (
              <SessionCard
                key={s.id}
                session={s}
                index={i}
                onOpen={() => router.push(`/session/${s.id}`)}
                onRemove={(e) => handleRemove(s.id, e)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
