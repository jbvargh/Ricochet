import type { ChatMessage } from "@/lib/llm/types";
import type { Turn } from "@/lib/session/types";

/** Recent turns kept verbatim for Visionary/Critic (3 exchanges = 6 turns). */
export const AGENT_TRANSCRIPT_WINDOW_TURNS = 6;

const SNIPPET_MAX = 60;

function truncateSnippet(text: string): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= SNIPPET_MAX) return t;
  return `${t.slice(0, SNIPPET_MAX - 1)}…`;
}

function summarizeEarlierTurns(earlier: Turn[]): string {
  const parts = earlier.map(
    (t) => `[${t.agent.toUpperCase()}]: ${truncateSnippet(t.text)}`,
  );
  return `[Earlier discussion (summarized): ${parts.join(" | ")}]`;
}

function turnsToVisionaryChat(turns: Turn[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const t of turns) {
    if (t.agent === "visionary") {
      out.push({ role: "assistant", content: t.text });
    } else {
      out.push({
        role: "user",
        content: `[${t.agent.toUpperCase()}]: ${t.text}`,
      });
    }
  }
  return out;
}

function turnsToCriticChat(turns: Turn[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const t of turns) {
    if (t.agent === "critic") {
      out.push({ role: "assistant", content: t.text });
    } else {
      out.push({
        role: "user",
        content: `[${t.agent.toUpperCase()}]: ${t.text}`,
      });
    }
  }
  return out;
}

/**
 * Caps input size for the Visionary: full recent turns plus a truncated summary
 * of older turns (no extra LLM call).
 */
export function windowedTurnsToVisionaryMessages(turns: Turn[]): ChatMessage[] {
  if (turns.length <= AGENT_TRANSCRIPT_WINDOW_TURNS) {
    return turnsToVisionaryChat(turns);
  }
  const earlier = turns.slice(0, -AGENT_TRANSCRIPT_WINDOW_TURNS);
  const recent = turns.slice(-AGENT_TRANSCRIPT_WINDOW_TURNS);
  const summary: ChatMessage = {
    role: "user",
    content: summarizeEarlierTurns(earlier),
  };
  return [summary, ...turnsToVisionaryChat(recent)];
}

/**
 * Same as windowedTurnsToVisionaryMessages but from the Critic's assistant/user roles.
 */
export function windowedTurnsToCriticMessages(turns: Turn[]): ChatMessage[] {
  if (turns.length <= AGENT_TRANSCRIPT_WINDOW_TURNS) {
    return turnsToCriticChat(turns);
  }
  const earlier = turns.slice(0, -AGENT_TRANSCRIPT_WINDOW_TURNS);
  const recent = turns.slice(-AGENT_TRANSCRIPT_WINDOW_TURNS);
  const summary: ChatMessage = {
    role: "user",
    content: summarizeEarlierTurns(earlier),
  };
  return [summary, ...turnsToCriticChat(recent)];
}
