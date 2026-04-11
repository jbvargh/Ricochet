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
      className="focus-visible:ring-amber-400 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-neutral-300 transition-colors hover:bg-red-500/20 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2"
    >
      End session
    </button>
  );
}
