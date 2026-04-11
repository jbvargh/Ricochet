import OpenAI from "openai";
import type { LLMProvider } from "@/lib/llm/types";

/** Plan does not name a TerpAI model; override via TERPAI_MODEL (OpenAI-compatible id). */
function terpaiModel(): string {
  return process.env.TERPAI_MODEL?.trim() || "gpt-4o";
}

export function createTerpAIProvider(): LLMProvider | null {
  const apiKey = process.env.TERPAI_API_KEY?.trim();
  const baseURL = process.env.TERPAI_BASE_URL?.trim();
  if (!apiKey || !baseURL) return null;

  const client = new OpenAI({ apiKey, baseURL });
  const model = terpaiModel();

  return {
    name: "TerpAI",
    async *stream(messages, temperature, signal) {
      const stream = await client.chat.completions.create(
        {
          model,
          messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
          temperature,
          stream: true,
        },
        { signal },
      );
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) yield delta;
      }
    },
    async complete(messages, temperature, signal) {
      const res = await client.chat.completions.create(
        {
          model,
          messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
          temperature,
        },
        { signal },
      );
      return res.choices[0]?.message?.content ?? "";
    },
  };
}
