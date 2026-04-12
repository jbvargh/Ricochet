"use client";

export function EndButton({ sessionId }: { sessionId: string }) {
  async function onEnd() {
    if (!confirm("End this session?")) return;
    await fetch(`/api/session/${sessionId}/end`, { method: "POST" });
  }

  return (
    <button
      type="button"
      onClick={() => void onEnd()}
      className="border border-neutral-700 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-neutral-400 transition-colors hover:border-red-700 hover:bg-red-950/20 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
    >
      End_session
    </button>
  );
}
