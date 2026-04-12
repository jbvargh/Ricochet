import { getSession, updateSession } from "@/lib/session/store";

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

  if (session.state !== "ended") {
    return new Response(null, { status: 409 });
  }

  updateSession(id, (s) => ({
    ...s,
    state: "idle",
    exchangesInCycle: 0,
  }));

  return new Response(null, { status: 204 });
}
