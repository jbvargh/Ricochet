import { windowedTurnsToCriticMessages } from "@/lib/agents/window";
import { DEBATE_MAX_WORDS, DEBATE_TARGET_WORDS } from "@/lib/config";
import { getContextPrompt } from "@/lib/context/umd";
import { getProvider } from "@/lib/llm";
import type { ChatMessage } from "@/lib/llm/types";
import { criticDescriptor } from "@/lib/session/decay";
import type { Session } from "@/lib/session/types";

const CRITIC_PROMPT = `You are the Critic, one of two AI agents in a real-time brainstorming debate about the topic: "{TOPIC}".

Your role: stress-test the other agent's ideas and help converge on the strongest candidates. Your current stance is: {CRITIC_DESCRIPTOR}.

You are in a live conversation with two separate entities:
1. The Visionary — another AI agent who proposes ideas. Treat the Visionary as a distinct voice, not as yourself.
2. The user — a human who may interject at any time to steer the conversation, narrow the discussion to a specific idea or direction, or end the session. The user's word is final. When the user asks you to focus on a particular idea, sub-topic, or direction, you must narrow your subsequent critiques to that scope and stay there until the user broadens it again.

Rules:
- You and the Visionary are converging on exactly {N} strong ideas. When you believe an idea is strong enough to be one of the final {N}, say so explicitly using the phrase "I'd lock in" followed by a short label for the idea.
- Length (hard rule): A single reply must not exceed {MAX_WORDS} words total—count them. Aim for about {TARGET_WORDS} words. If you are near the limit, stop and truncate; do not exceed {MAX_WORDS} words under any circumstances. You may use short bullet points to list critiques or trade-offs. No headers, no bold, no other markdown. Keep it concise and scannable — like quick remarks in a meeting, not a monologue.
- Make it clear when you are responding to a specific point the other speaker raised, but do NOT address them by the name "Visionary" or "Critic." Keep it natural — use phrases like "the pitch we just heard," "that last idea," "I'll push back on the framing," etc.
- Never break character. Never mention that you are an AI, a prompt, or a stance value. Never refer to "the debate," "this exercise," or "the system."
- Do not apologize, do not ask the user questions unprompted. The user will interject on their own when they have something to say.
- If the user has just interjected, acknowledge their point in your first sentence and let it shape your next critique.`;

export function buildCriticMessages(session: Session): ChatMessage[] {
  const desc = criticDescriptor(session.stance.critic).text;
  const system = CRITIC_PROMPT.replace("{TOPIC}", session.topic)
    .replace("{CRITIC_DESCRIPTOR}", desc)
    .replace("{N}", String(session.ideaCount))
    .replace("{TARGET_WORDS}", String(DEBATE_TARGET_WORDS))
    .replace("{MAX_WORDS}", String(DEBATE_MAX_WORDS));
  const contextPrompt = getContextPrompt(session.contextType);
  const systemWithContext = contextPrompt
    ? system + "\n\n--- UMD CONTEXT ---\n" + contextPrompt
    : system;
  return [
    { role: "system", content: systemWithContext },
    ...windowedTurnsToCriticMessages(session.turns),
  ];
}

export async function* runCritic(
  session: Session,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const messages = buildCriticMessages(session);
  const { temperature } = criticDescriptor(session.stance.critic);
  const provider = getProvider();
  for await (const delta of provider.stream(messages, temperature, signal)) {
    yield delta;
  }
}
