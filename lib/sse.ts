export type SSEPayload = {
  event: string;
  data: unknown;
};

export function encodeSSE(event: string, data: unknown): Uint8Array {
  const json = JSON.stringify(data);
  const text = `event: ${event}\ndata: ${json}\n\n`;
  return new TextEncoder().encode(text);
}

export function createSSEReadableStream(
  events: AsyncIterable<SSEPayload>,
  signal?: AbortSignal,
  onDone?: () => void,
): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of events) {
          if (signal?.aborted) break;
          controller.enqueue(encodeSSE(chunk.event, chunk.data));
        }
        controller.close();
      } catch (e) {
        controller.error(e);
      } finally {
        onDone?.();
      }
    },
  });
}
