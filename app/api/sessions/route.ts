import { getSessionFromCookies } from "@/lib/auth/session-server";
import { getSessionsByUser } from "@/lib/mongodb/client";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionFromCookies();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const sessions = await getSessionsByUser(user.uid);
    return NextResponse.json(sessions);
  } catch (e) {
    console.error("[sessions GET]", e);
    return NextResponse.json(
      { error: "database unavailable" },
      { status: 503 },
    );
  }
}
