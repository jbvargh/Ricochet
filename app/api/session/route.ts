import { CONTEXT_OPTIONS } from "@/lib/context/umd";
import { createSession } from "@/lib/session/store";
import { getProviderOrNull } from "@/lib/llm";
import { IDEA_COUNT_MAX, IDEA_COUNT_MIN } from "@/lib/config";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!getProviderOrNull()) {
    return NextResponse.json(
      { error: "no LLM provider configured" },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const topic =
    typeof body === "object" &&
    body !== null &&
    "topic" in body &&
    typeof (body as { topic: unknown }).topic === "string"
      ? (body as { topic: string }).topic
      : "";
  const rawN =
    typeof body === "object" &&
    body !== null &&
    "ideaCount" in body
      ? (body as { ideaCount: unknown }).ideaCount
      : undefined;
  const ideaCount =
    typeof rawN === "number" && Number.isInteger(rawN) ? rawN : NaN;

  const rawContextType =
    typeof body === "object" &&
    body !== null &&
    "contextType" in body &&
    typeof (body as { contextType: unknown }).contextType === "string"
      ? (body as { contextType: string }).contextType
      : null;

  if (!topic.trim()) {
    return NextResponse.json({ error: "topic is required" }, { status: 400 });
  }
  if (
    !Number.isFinite(ideaCount) ||
    ideaCount < IDEA_COUNT_MIN ||
    ideaCount > IDEA_COUNT_MAX
  ) {
    return NextResponse.json(
      { error: `ideaCount must be an integer from ${IDEA_COUNT_MIN} to ${IDEA_COUNT_MAX}` },
      { status: 400 },
    );
  }

  const contextType =
    rawContextType !== null &&
    CONTEXT_OPTIONS.some((o) => o.value === rawContextType)
      ? rawContextType
      : null;

  try {
    const session = createSession(topic, ideaCount, contextType);
    return NextResponse.json({ sessionId: session.id });
  } catch {
    return NextResponse.json({ error: "invalid session parameters" }, { status: 400 });
  }
}
