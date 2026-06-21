import type { Session } from "@/lib/session/types";
import { IDEA_COUNT_MAX, IDEA_COUNT_MIN } from "@/lib/config";
import { initialStance } from "@/lib/session/decay";
import {
  upsertSessionDoc,
  upsertMessage,
  getSessionDoc,
  getSessionDocById,
  getMessagesBySession,
  type SessionDocument,
  type MessageDocument,
} from "@/lib/mongodb/client";
import type { Turn } from "@/lib/session/types";

const sessions = new Map<string, Session>();

/** Maps sessionId → userId for MongoDB persistence. */
const sessionOwners = new Map<string, string>();

/** Build a MongoDB session document from an in-memory Session. */
function toSessionDocument(session: Session, userId: string): SessionDocument {
  return {
    id: session.id,
    userId,
    topic: session.topic,
    ideaCount: session.ideaCount,
    contextType: session.contextType,
    createdAt: session.createdAt,
    state: session.state,
    stance: session.stance,
    exchangesInCycle: session.exchangesInCycle,
    lastCandidates: session.lastCandidates,
    turnCount: session.turns.length,
  };
}

/** Fire-and-forget session persistence. Logs errors but does not throw. */
function persistSessionAsync(session: Session): void {
  const userId = sessionOwners.get(session.id);
  if (!userId) return;
  upsertSessionDoc(toSessionDocument(session, userId)).catch((e) => {
    console.error("[mongodb] failed to persist session", session.id, e);
  });
}

/** Single waiter per session: resolved when user POSTs while orchestrator awaits feedback, or on end. */
const feedbackWaiters = new Map<string, (text: string) => void>();

/** Resolved when client POSTs /ready after finishing throttled display of an agent turn. */
const displayReadyWaiters = new Map<string, () => void>();

export function createSession(
  topic: string,
  ideaCount: number,
  contextType: string | null,
  userId?: string,
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
  if (userId) {
    sessionOwners.set(id, userId);
    persistSessionAsync(session);
  }
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
  persistSessionAsync(next);
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

/** Persist a single turn to MongoDB. Awaited by the orchestrator for durability. */
export async function persistTurn(sessionId: string, turn: Turn, order: number): Promise<void> {
  const userId = sessionOwners.get(sessionId);
  if (!userId) return;
  const doc: MessageDocument = {
    id: turn.id,
    sessionId,
    agent: turn.agent,
    text: turn.text,
    createdAt: turn.createdAt,
    stanceAtTurn: turn.stanceAtTurn,
    order,
  };
  await upsertMessage(doc);
}

/**
 * Load a session from MongoDB into the in-memory store.
 * Returns null if the session doesn't exist in the database.
 * If the session is already in memory, returns it without hitting MongoDB.
 */
export async function loadPersistedSession(
  sessionId: string,
  userId?: string,
): Promise<Session | null> {
  const existing = sessions.get(sessionId);
  if (existing) return existing;

  let doc: SessionDocument | null;
  if (userId) {
    doc = await getSessionDoc(sessionId, userId);
  } else {
    doc = await getSessionDocById(sessionId);
  }
  if (!doc) return null;

  // Security: if userId was provided, verify ownership
  if (userId && doc.userId !== userId) return null;

  const messages = await getMessagesBySession(sessionId);

  const session: Session = {
    id: doc.id,
    topic: doc.topic,
    ideaCount: doc.ideaCount,
    contextType: doc.contextType,
    createdAt: doc.createdAt,
    state: doc.state,
    stance: doc.stance,
    turns: messages.map((m) => ({
      id: m.id,
      agent: m.agent,
      text: m.text,
      createdAt: m.createdAt,
      stanceAtTurn: m.stanceAtTurn,
    })),
    exchangesInCycle: doc.exchangesInCycle,
    pendingInterjection: null,
    lastCandidates: doc.lastCandidates,
  };

  sessions.set(session.id, session);
  sessionOwners.set(session.id, doc.userId);
  return session;
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
  resolveFeedback(sessionId, "");
  resolveDisplayReady(sessionId);
}

export function clearSessionAbort(sessionId: string): void {
  sessionAborts.delete(sessionId);
}
