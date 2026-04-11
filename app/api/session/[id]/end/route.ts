import {
  abortSessionOrchestrator,
  getSession,
  resolveFeedback,
  updateSession,
} from "@/lib/session/store";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const session = getSession(id);
  if (!session) {
    return new Response(null, { status: 404 });
  }

  updateSession(id, (s) => ({ ...s, state: "ended" }));
  abortSessionOrchestrator(id);
  resolveFeedback(id, "");

  return new Response(null, { status: 204 });
}
