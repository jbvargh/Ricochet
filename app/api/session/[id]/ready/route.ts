import {
  getSession,
  loadPersistedSession,
  resolveDisplayReady,
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
    session = await loadPersistedSession(id, user?.uid) ?? undefined;
  }
  if (!session) {
    return new Response(null, { status: 404 });
  }

  // #region agent log
  console.log(`[DBG] POST /ready id=${id}`);
  // #endregion
  resolveDisplayReady(id);
  return new Response(null, { status: 204 });
}
