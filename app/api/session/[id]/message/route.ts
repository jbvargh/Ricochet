import {
  getSession,
  loadSessionFromCosmos,
  resolveFeedback,
  updateSession,
} from "@/lib/session/store";
import { getSessionFromCookies } from "@/lib/auth/session-server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(
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
    return new Response(null, { status: 404 });
  }

  let body: { text?: unknown; isFeedback?: unknown; cancelPending?: unknown };
  try {
    body = (await request.json()) as {
      text?: unknown;
      isFeedback?: unknown;
      cancelPending?: unknown;
    };
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  if (body.cancelPending === true) {
    updateSession(id, (s) => ({ ...s, pendingInterjection: null }));
    return new Response(null, { status: 204 });
  }

  const text = typeof body.text === "string" ? body.text : "";

  updateSession(id, (s) => ({ ...s, pendingInterjection: text }));

  if (session.state === "awaiting_user") {
    resolveFeedback(id, text);
  }

  return new Response(null, { status: 204 });
}
