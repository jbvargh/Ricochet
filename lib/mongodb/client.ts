import { MongoClient, type Collection } from "mongodb";
import type { DashboardSession } from "@/lib/dashboard/storage";
import type { AgentId, CandidateIdea, SessionState, Stance } from "@/lib/session/types";

let client: MongoClient | null = null;

function getClient(): MongoClient {
  if (client) return client;
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) throw new Error("MONGODB_URI must be set");
  client = new MongoClient(uri);
  return client;
}

function getDb() {
  const dbName = process.env.MONGODB_DATABASE ?? "ricochet";
  return getClient().db(dbName);
}

function getSessionsCollection(): Collection<SessionDocument> {
  return getDb().collection(process.env.MONGODB_SESSIONS_COLLECTION ?? "sessions");
}

export function getMessagesCollection(): Collection<MessageDocument> {
  return getDb().collection(process.env.MONGODB_MESSAGES_COLLECTION ?? "messages");
}

export type SessionDocument = {
  id: string;
  userId: string;
  topic: string;
  ideaCount: number;
  contextType: string | null;
  createdAt: number;
  state: SessionState;
  stance: Stance;
  exchangesInCycle: number;
  lastCandidates: CandidateIdea[] | null;
  turnCount: number;
};

export type MessageDocument = {
  id: string;
  sessionId: string;
  agent: AgentId;
  text: string;
  createdAt: number;
  stanceAtTurn?: number;
  order: number;
};

export async function getSessionsByUser(userId: string): Promise<DashboardSession[]> {
  const col = getSessionsCollection();
  const resources = await col
    .find({ userId, state: { $in: ["running", "awaiting_user", "ended"] } })
    .sort({ createdAt: -1 })
    .toArray();

  return resources.map((r) => ({
    id: r.id,
    topic: r.topic,
    createdAt: r.createdAt,
    state: r.state as "running" | "awaiting_user" | "ended",
    lastCandidates: r.lastCandidates,
    turnCount: r.turnCount,
  }));
}

export async function upsertSession(userId: string, session: DashboardSession): Promise<void> {
  const col = getSessionsCollection();
  const existing = await col.findOne({ id: session.id, userId });
  const doc: SessionDocument = existing
    ? { ...existing, ...session, userId }
    : {
        id: session.id,
        userId,
        topic: session.topic,
        ideaCount: 0,
        contextType: null,
        createdAt: session.createdAt,
        state: session.state,
        stance: { visionary: 1, critic: 0.5 },
        exchangesInCycle: 0,
        lastCandidates: session.lastCandidates,
        turnCount: session.turnCount,
      };
  await col.replaceOne({ id: session.id, userId }, doc, { upsert: true });
}

export async function deleteSession(userId: string, sessionId: string): Promise<void> {
  const col = getSessionsCollection();
  await col.deleteOne({ id: sessionId, userId });
}

export async function upsertSessionDoc(doc: SessionDocument): Promise<void> {
  const col = getSessionsCollection();
  await col.replaceOne({ id: doc.id, userId: doc.userId }, doc, { upsert: true });
}

export async function getSessionDoc(sessionId: string, userId: string): Promise<SessionDocument | null> {
  const col = getSessionsCollection();
  return await col.findOne({ id: sessionId, userId }) ?? null;
}

export async function getSessionDocById(sessionId: string): Promise<SessionDocument | null> {
  const col = getSessionsCollection();
  return await col.findOne({ id: sessionId }) ?? null;
}

export async function upsertMessage(msg: MessageDocument): Promise<void> {
  const col = getMessagesCollection();
  await col.replaceOne({ id: msg.id, sessionId: msg.sessionId }, msg, { upsert: true });
}

export async function getMessagesBySession(sessionId: string): Promise<MessageDocument[]> {
  const col = getMessagesCollection();
  return await col.find({ sessionId }).sort({ order: 1 }).toArray();
}

export async function deleteMessagesBySession(sessionId: string): Promise<void> {
  const col = getMessagesCollection();
  await col.deleteMany({ sessionId });
}
