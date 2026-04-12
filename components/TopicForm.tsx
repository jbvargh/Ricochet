"use client";

import { ContextSelect } from "@/components/ContextSelect";
import { IDEA_COUNT_DEFAULT, IDEA_COUNT_MAX, IDEA_COUNT_MIN } from "@/lib/config";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function TopicForm() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [contextType, setContextType] = useState<string | null>(null);
  const [ideaCount, setIdeaCount] = useState(IDEA_COUNT_DEFAULT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, ideaCount, contextType }),
      });
      if (res.status === 503) {
        setError("No LLM provider is configured on the server.");
        return;
      }
      if (!res.ok) {
        setError("Could not start a session. Try again.");
        return;
      }
      const data = (await res.json()) as { sessionId?: string };
      if (!data.sessionId) {
        setError("Invalid response from server.");
        return;
      }
      router.push(`/session/${data.sessionId}`);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="topic" className="text-sm font-medium text-neutral-300">
          Topic
        </label>
        <textarea
          id="topic"
          name="topic"
          rows={2}
          required
          autoFocus
          placeholder="What should we brainstorm about?"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="focus-visible:ring-amber-400 w-full resize-y rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2"
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-neutral-300">
          UMD Context (optional)
        </label>
        <ContextSelect value={contextType} onChange={setContextType} />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="ideaCount" className="text-sm font-medium text-neutral-300">
          How many ideas should they converge on?
        </label>
        <input
          id="ideaCount"
          name="ideaCount"
          type="number"
          min={IDEA_COUNT_MIN}
          max={IDEA_COUNT_MAX}
          value={ideaCount}
          onChange={(e) => setIdeaCount(Number(e.target.value))}
          className="focus-visible:ring-amber-400 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 focus-visible:outline-none focus-visible:ring-2"
        />
      </div>
      {error ? (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={loading}
        className="focus-visible:ring-amber-400 w-full rounded-lg bg-amber-500 py-3 font-semibold text-neutral-950 transition-colors hover:bg-amber-400 disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2"
      >
        {loading ? (
          <span className="inline-flex items-center justify-center gap-2">
            <span
              className="inline-block size-4 animate-spin rounded-full border-2 border-neutral-950 border-t-transparent"
              aria-hidden
            />
            Starting debate…
          </span>
        ) : (
          "Start debating"
        )}
      </button>
    </form>
  );
}
