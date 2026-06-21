import { getSessionFromCookies } from "@/lib/auth/session-server";
import { deleteSession, deleteMessagesBySession, upsertSession } from "@/lib/mongodb/client";
import type { DashboardSession } from "@/lib/dashboard/storage";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function isCandidate(x: unknown): x is { title: string; summary: string } {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return typeof o.title === "string" && typeof o.summary === "string";
}

function isDashboardSession(x: unknown): x is DashboardSession {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.topic === "string" &&
    typeof o.createdAt === "number" &&
    (o.state === "running" ||
      o.state === "awaiting_user" ||
      o.state === "ended") &&
    typeof o.turnCount === "number" &&
    (o.lastCandidates === null ||
      (Array.isArray(o.lastCandidates) && o.lastCandidates.every(isCandidate)))
  );
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSessionFromCookies();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  if (!isDashboardSession(body)) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  if (body.id !== id) {
    return NextResponse.json({ error: "id mismatch" }, { status: 400 });
  }

  try {
    await upsertSession(user.uid, body);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    console.error("[sessions PUT]", e);
    return NextResponse.json(
      { error: "database unavailable" },
      { status: 503 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSessionFromCookies();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    await deleteMessagesBySession(id);
    await deleteSession(user.uid, id);
  } catch (e) {
    console.error("[sessions DELETE]", e);
    return NextResponse.json(
      { error: "database unavailable" },
      { status: 503 },
    );
  }
  return new NextResponse(null, { status: 204 });
}
