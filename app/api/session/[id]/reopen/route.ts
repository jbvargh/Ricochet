import {
  getSession,
  loadSessionFromCosmos,
  updateSession,
} from "@/lib/session/store";
import { getSessionFromCookies } from "@/lib/auth/session-server";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
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

  if (session.state !== "ended") {
    // #region agent log
    console.log(`[DBG] reopen REJECTED id=${id} actualState=${session.state}`);
    // #endregion
    return new Response(null, { status: 409 });
  }

  // #region agent log
  console.log(`[DBG] reopen SUCCESS id=${id}`);
  // #endregion

  updateSession(id, (s) => ({
    ...s,
    state: "idle",
    exchangesInCycle: 0,
  }));

  return new Response(null, { status: 204 });
}
