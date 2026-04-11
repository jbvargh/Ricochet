import { createSSEReadableStream } from "@/lib/sse";
import { runOrchestrator } from "@/lib/session/orchestrator";
import {
  clearSessionAbort,
  getSession,
  releaseOrchestratorLock,
  setSessionAbort,
  tryAcquireOrchestratorLock,
} from "@/lib/session/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const session = getSession(id);
  if (!session) {
    return new Response("Not found", { status: 404 });
  }

  if (!tryAcquireOrchestratorLock(id)) {
    return new Response("Stream already active", { status: 409 });
  }

  const ac = new AbortController();
  setSessionAbort(id, ac);
  request.signal.addEventListener("abort", () => ac.abort());

  const stream = createSSEReadableStream(
    runOrchestrator(id, ac.signal),
    ac.signal,
    () => {
      releaseOrchestratorLock(id);
      clearSessionAbort(id);
    },
  );

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
