import { createSSEReadableStream, type SSEPayload } from "@/lib/sse";
import { runOrchestrator } from "@/lib/session/orchestrator";
import type { Turn } from "@/lib/session/types";
import {
  clearSessionAbort,
  getSession,
  loadSessionFromCosmos,
  releaseOrchestratorLock,
  resolveDisplayReady,
  resolveFeedback,
  setSessionAbort,
  tryAcquireOrchestratorLock,
} from "@/lib/session/store";
import { getSessionFromCookies } from "@/lib/auth/session-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function* withHistory(
  turns: Turn[],
  orchestrator: AsyncGenerator<SSEPayload>,
): AsyncGenerator<SSEPayload> {
  if (turns.length > 0) {
    yield { event: "history", data: { turns } };
  }
  yield* orchestrator;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  let session = getSession(id);
  if (!session) {
    const user = await getSessionFromCookies();
    session = await loadSessionFromCosmos(id, user?.uid) ?? undefined;
  }
  if (!session) {
    return new Response("Not found", { status: 404 });
  }

  // #region agent log
  console.log(`[DBG] stream/route GET id=${id} state=${session.state} turns=${session.turns.length}`);
  // #endregion

  if (!tryAcquireOrchestratorLock(id)) {
    // #region agent log
    console.log(`[DBG] stream/route LOCK HELD id=${id}`);
    // #endregion
    return new Response("Stream already active", { status: 409 });
  }

  const ac = new AbortController();
  setSessionAbort(id, ac);
  request.signal.addEventListener("abort", () => {
    // #region agent log
    console.log(`[DBG] stream ABORT id=${id}`);
    // #endregion
    ac.abort();
    resolveFeedback(id, "");
    resolveDisplayReady(id);
  });

  const stream = createSSEReadableStream(
    withHistory(session.turns, runOrchestrator(id, ac.signal)),
    ac.signal,
    () => {
      // #region agent log
      console.log(`[DBG] stream onDone id=${id}`);
      // #endregion
      releaseOrchestratorLock(id);
      clearSessionAbort(id);
      resolveFeedback(id, "");
      resolveDisplayReady(id);
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
