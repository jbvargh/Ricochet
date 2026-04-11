export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LLMProvider = {
  name: string;
  stream: (
    messages: ChatMessage[],
    temperature: number,
    signal?: AbortSignal,
  ) => AsyncIterable<string>;
  complete: (
    messages: ChatMessage[],
    temperature: number,
    signal?: AbortSignal,
  ) => Promise<string>;
};
