import { getSessionFromCookies } from "@/lib/auth/session-server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionFromCookies();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ uid: user.uid, email: user.email });
}
