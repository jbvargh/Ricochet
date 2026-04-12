import type { Session } from "@/lib/session/types";
import { IDEA_COUNT_MAX, IDEA_COUNT_MIN } from "@/lib/config";
import { initialStance } from "@/lib/session/decay";

const sessions = new Map<string, Session>();

/** Single waiter per session: resolved when user POSTs while orchestrator awaits feedback, or on end. */
const feedbackWaiters = new Map<string, (text: string) => void>();

/** Resolved when client POSTs /ready after finishing throttled display of an agent turn. */
const displayReadyWaiters = new Map<string, () => void>();

export function createSession(
  topic: string,
  ideaCount: number,
  contextType: string | null,
): Session {
  if (
    typeof topic !== "string" ||
    topic.trim().length === 0 ||
    !Number.isInteger(ideaCount) ||
    ideaCount < IDEA_COUNT_MIN ||
    ideaCount > IDEA_COUNT_MAX
  ) {
    throw new Error("invalid session parameters");
  }
  const id = crypto.randomUUID();
  const session: Session = {
    id,
    topic: topic.trim(),
    ideaCount,
    contextType,
    createdAt: Date.now(),
    state: "idle",
    stance: initialStance(),
    turns: [],
    exchangesInCycle: 0,
    pendingInterjection: null,
    lastCandidates: null,
  };
  sessions.set(id, session);
  return session;
}

export function getSession(id: string): Session | undefined {
  return sessions.get(id);
}

export function updateSession(
  id: string,
  mutator: (s: Session) => Session,
): Session | undefined {
  const cur = sessions.get(id);
  if (!cur) return undefined;
  const next = mutator(cur);
  sessions.set(id, next);
  return next;
}

/** Blocks until POST /message or POST /end resolves with body text (empty string on end). */
export function awaitFeedback(sessionId: string): Promise<string> {
  return new Promise((resolve) => {
    feedbackWaiters.set(sessionId, resolve);
  });
}

export function resolveFeedback(sessionId: string, text: string): void {
  const r = feedbackWaiters.get(sessionId);
  feedbackWaiters.delete(sessionId);
  if (r) {
    r(text);
  }
}

export function clearFeedbackWaiter(sessionId: string): void {
  feedbackWaiters.delete(sessionId);
}

/** Blocks until client POSTs /api/session/[id]/ready (after UI finishes typing the turn). */
export function awaitDisplayReady(sessionId: string): Promise<void> {
  return new Promise((resolve) => {
    displayReadyWaiters.set(sessionId, resolve);
  });
}

export function resolveDisplayReady(sessionId: string): void {
  const r = displayReadyWaiters.get(sessionId);
  displayReadyWaiters.delete(sessionId);
  if (r) {
    r();
  }
}

export function clearDisplayReadyWaiter(sessionId: string): void {
  displayReadyWaiters.delete(sessionId);
}

const orchestratorLocks = new Set<string>();

export function tryAcquireOrchestratorLock(sessionId: string): boolean {
  if (orchestratorLocks.has(sessionId)) return false;
  orchestratorLocks.add(sessionId);
  return true;
}

export function releaseOrchestratorLock(sessionId: string): void {
  orchestratorLocks.delete(sessionId);
}

const sessionAborts = new Map<string, AbortController>();

export function setSessionAbort(
  sessionId: string,
  ac: AbortController,
): void {
  sessionAborts.set(sessionId, ac);
}

export function abortSessionOrchestrator(sessionId: string): void {
  sessionAborts.get(sessionId)?.abort();
  resolveDisplayReady(sessionId);
}

export function clearSessionAbort(sessionId: string): void {
  sessionAborts.delete(sessionId);
}
