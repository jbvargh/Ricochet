import { getContextPrompt } from "@/lib/context/umd";
import { getProvider } from "@/lib/llm";
import type { ChatMessage } from "@/lib/llm/types";
import { JUDGE_TEMPERATURE } from "@/lib/config";
import type {
  CandidateIdea,
  JudgeResult,
  Session,
  Turn,
} from "@/lib/session/types";

const JUDGE_PROMPT = `You are the Judge, a silent arbiter observing a brainstorming debate between two agents (Visionary and Critic) about the topic: "{TOPIC}". The goal is for them to converge on exactly {N} strong candidate ideas.

You will be given the full transcript of the debate so far. Analyze it and decide whether the two agents have genuinely converged on {N} shared candidate ideas. Convergence requires BOTH of the following:
1. At least {N} distinct ideas are present in the transcript that BOTH agents have spoken positively about (the Critic has said something affirming or "lock in"-style about each, and the Visionary has proposed or reinforced each).
2. The most recent 2 exchanges are not proposing fundamentally new ideas — they are refining or agreeing on existing ones.

Respond ONLY with valid JSON matching this exact shape, with no prose before or after:
{
  "converged": boolean,
  "reason": string,
  "candidates": [{ "title": string, "summary": string }],
  "userSatisfied": boolean
}

Fields:
- "converged": true if and only if both conditions above are met.
- "reason": one sentence explaining your decision.
- "candidates": if converged is true, list exactly {N} candidates. Otherwise list your current best guess at the top candidates so far (may be fewer than {N}). Each summary is one sentence.
- "userSatisfied": true if and only if the most recent user message in the transcript expresses clear satisfaction or a desire to end the session (e.g. "I like this", "that's perfect", "we're done", "let's go with that"). Otherwise false. If there is no user message yet, this is false.`;

function transcriptForJudge(turns: Turn[]): string {
  return turns
    .map((t) => `[${t.agent.toUpperCase()}]: ${t.text}`)
    .join("\n\n");
}

function buildJudgeMessages(session: Session): ChatMessage[] {
  const system = JUDGE_PROMPT.replace("{TOPIC}", session.topic).replace(
    /{N}/g,
    String(session.ideaCount),
  );
  const contextPrompt = getContextPrompt(session.contextType);
  const systemWithContext = contextPrompt
    ? system + "\n\n--- UMD CONTEXT ---\n" + contextPrompt
    : system;
  const body = transcriptForJudge(session.turns);
  return [
    { role: "system", content: systemWithContext },
    { role: "user", content: body },
  ];
}

function extractJsonObject(raw: string): string {
  const trimmed = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(trimmed);
  if (fence?.[1]) return fence[1].trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

function parseJudgeResult(raw: string): JudgeResult | null {
  try {
    const parsed = JSON.parse(extractJsonObject(raw)) as {
      converged?: boolean;
      reason?: string;
      candidates?: CandidateIdea[];
      userSatisfied?: boolean;
    };
    return {
      converged: Boolean(parsed.converged),
      reason: typeof parsed.reason === "string" ? parsed.reason : "",
      candidates: Array.isArray(parsed.candidates) ? parsed.candidates : [],
      userSatisfied: Boolean(parsed.userSatisfied),
    };
  } catch {
    return null;
  }
}

const RETRY_SYSTEM =
  "Your previous response was not valid JSON. Respond with valid JSON only.";

export async function runJudge(
  session: Session,
  signal?: AbortSignal,
): Promise<JudgeResult> {
  const provider = getProvider();
  let messages = buildJudgeMessages(session);
  let raw = await provider.complete(messages, JUDGE_TEMPERATURE, signal);
  let result = parseJudgeResult(raw);
  if (result) return result;

  messages = [
    ...messages,
    { role: "system", content: RETRY_SYSTEM },
  ];
  raw = await provider.complete(messages, JUDGE_TEMPERATURE, signal);
  result = parseJudgeResult(raw);
  if (result) return result;

  return {
    converged: false,
    reason: "judge parse failure",
    candidates: [],
    userSatisfied: false,
  };
}
