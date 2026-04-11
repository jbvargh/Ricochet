import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage, LLMProvider } from "@/lib/llm/types";

const MODEL = "claude-sonnet-4-6";

function toAnthropicInput(messages: ChatMessage[]): {
  system: string;
  msgs: Anthropic.MessageParam[];
} {
  const systemParts: string[] = [];
  const msgs: Anthropic.MessageParam[] = [];
  for (const m of messages) {
    if (m.role === "system") {
      systemParts.push(m.content);
      continue;
    }
    msgs.push({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    });
  }
  return { system: systemParts.join("\n\n"), msgs };
}

export function createClaudeProvider(): LLMProvider | null {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });

  return {
    name: "Anthropic Claude",
    async *stream(messages, temperature, signal) {
      const { system, msgs } = toAnthropicInput(messages);
      const stream = client.messages.stream(
        {
          model: MODEL,
          max_tokens: 8192,
          system,
          messages: msgs,
          temperature,
        },
        { signal },
      );
      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          yield event.delta.text;
        }
      }
    },
    async complete(messages, temperature, signal) {
      const { system, msgs } = toAnthropicInput(messages);
      const res = await client.messages.create(
        {
          model: MODEL,
          max_tokens: 8192,
          system,
          messages: msgs,
          temperature,
        },
        { signal },
      );
      const block = res.content.find((b) => b.type === "text");
      return block && block.type === "text" ? block.text : "";
    },
  };
}
