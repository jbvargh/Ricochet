import {
  GoogleGenerativeAI,
  type Content,
  type Part,
} from "@google/generative-ai";
import type { ChatMessage, LLMProvider } from "@/lib/llm/types";

const MODEL = "gemini-2.0-flash";

function toGeminiContents(
  messages: ChatMessage[],
): { systemInstruction: string; contents: Content[] } {
  const systemParts: string[] = [];
  const contents: Content[] = [];
  for (const m of messages) {
    if (m.role === "system") {
      systemParts.push(m.content);
      continue;
    }
    const role = m.role === "assistant" ? "model" : "user";
    contents.push({
      role,
      parts: [{ text: m.content } satisfies Part],
    });
  }
  return { systemInstruction: systemParts.join("\n\n"), contents };
}

export function createGeminiProvider(): LLMProvider | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;

  return {
    name: "Google Gemini",
    async *stream(messages, temperature, signal) {
      const genAI = new GoogleGenerativeAI(apiKey);
      const { systemInstruction, contents } = toGeminiContents(messages);
      const model = genAI.getGenerativeModel({
        model: MODEL,
        systemInstruction,
        generationConfig: { temperature },
      });
      const result = await model.generateContentStream(
        { contents },
        { signal },
      );
      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) yield text;
      }
    },
    async complete(messages, temperature, signal) {
      const genAI = new GoogleGenerativeAI(apiKey);
      const { systemInstruction, contents } = toGeminiContents(messages);
      const model = genAI.getGenerativeModel({
        model: MODEL,
        systemInstruction,
        generationConfig: { temperature },
      });
      const result = await model.generateContent(
        { contents },
        { signal },
      );
      return result.response.text();
    },
  };
}
