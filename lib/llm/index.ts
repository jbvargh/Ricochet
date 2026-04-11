import type { LLMProvider } from "@/lib/llm/types";
import { createClaudeProvider } from "@/lib/llm/providers/claude";
import { createGeminiProvider } from "@/lib/llm/providers/gemini";
import { createGroqProvider } from "@/lib/llm/providers/groq";
import { createOpenAIProvider } from "@/lib/llm/providers/openai";
import { createTerpAIProvider } from "@/lib/llm/providers/terpai";

let cached: LLMProvider | null | undefined;

const factories: Array<() => LLMProvider | null> = [
  createTerpAIProvider,
  createClaudeProvider,
  createGeminiProvider,
  createOpenAIProvider,
  createGroqProvider,
];

function selectProvider(): LLMProvider | null {
  for (const factory of factories) {
    const p = factory();
    if (p) {
      console.log(`[ricochet] selected LLM provider: ${p.name}`);
      return p;
    }
  }
  return null;
}

/** Returns the memoized provider, or null if no API key is configured. */
export function getProviderOrNull(): LLMProvider | null {
  if (cached !== undefined) return cached;
  cached = selectProvider();
  return cached;
}

/** Throws if no provider is configured (use in routes that require an LLM). */
export function getProvider(): LLMProvider {
  const p = getProviderOrNull();
  if (!p) {
    throw new Error("no LLM provider configured");
  }
  return p;
}
