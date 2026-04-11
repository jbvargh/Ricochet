import OpenAI from "openai";
import type { LLMProvider } from "@/lib/llm/types";

const MODEL = "llama-3.3-70b-versatile";

export function createGroqProvider(): LLMProvider | null {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) return null;

  const client = new OpenAI({
    apiKey,
    baseURL: "https://api.groq.com/openai/v1",
  });

  return {
    name: "Groq",
    async *stream(messages, temperature, signal) {
      const stream = await client.chat.completions.create(
        {
          model: MODEL,
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
          model: MODEL,
          messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
          temperature,
        },
        { signal },
      );
      return res.choices[0]?.message?.content ?? "";
    },
  };
}
