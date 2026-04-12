import { CosmosClient, type Container } from "@azure/cosmos";
import type { DashboardSession } from "@/lib/dashboard/storage";
import type { AgentId, CandidateIdea, SessionState, Stance } from "@/lib/session/types";

let cosmosClient: CosmosClient | null = null;
let sessionsContainer: Container | null = null;
let messagesContainer: Container | null = null;

function getCosmosClient(): CosmosClient {
  if (cosmosClient) return cosmosClient;
  const endpoint = process.env.COSMOS_ENDPOINT?.trim();
  const key = process.env.COSMOS_KEY?.trim();
  if (!endpoint || !key) {
    throw new Error("COSMOS_ENDPOINT and COSMOS_KEY must be set");
  }
  cosmosClient = new CosmosClient({ endpoint, key });
  return cosmosClient;
}

function getSessionsContainer(): Container {
  if (sessionsContainer) return sessionsContainer;
  const dbName = process.env.COSMOS_DATABASE ?? "ricochet";
  const containerName = process.env.COSMOS_CONTAINER ?? "sessions";
  sessionsContainer = getCosmosClient().database(dbName).container(containerName);
  return sessionsContainer;
}

/** Chat messages container; partition key must be `/sessionId`. */
export function getMessagesContainer(): Container {
  if (messagesContainer) return messagesContainer;
  const dbName = process.env.COSMOS_DATABASE ?? "ricochet";
  const containerName = process.env.COSMOS_MESSAGES_CONTAINER ?? "messages";
  messagesContainer = getCosmosClient().database(dbName).container(containerName);
  return messagesContainer;
}

/** Full session document stored in Cosmos sessions container. Partition key: /userId */
export type CosmosSessionDocument = {
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

/** Message document stored in Cosmos messages container. Partition key: /sessionId */
export type CosmosMessageDocument = {
  id: string;
  sessionId: string;
  agent: AgentId;
  text: string;
  createdAt: number;
  stanceAtTurn?: number;
  order: number;
};

export async function getSessionsByUser(
  userId: string,
): Promise<DashboardSession[]> {
  const container = getSessionsContainer();
  const { resources } = await container.items
    .query<CosmosSessionDocument>("SELECT * FROM c", {
      partitionKey: userId,
    })
    .fetchAll();

  resources.sort((a, b) => b.createdAt - a.createdAt);

  return resources
    .filter((r) => r.state === "running" || r.state === "awaiting_user" || r.state === "ended")
    .map((r) => ({
      id: r.id,
      topic: r.topic,
      createdAt: r.createdAt,
      state: r.state as "running" | "awaiting_user" | "ended",
      lastCandidates: r.lastCandidates,
      turnCount: r.turnCount,
    }));
}

/** Legacy dashboard upsert — merges dashboard fields onto existing doc so new fields aren't overwritten. */
export async function upsertSession(
  userId: string,
  session: DashboardSession,
): Promise<void> {
  const container = getSessionsContainer();
  let existing: CosmosSessionDocument | null = null;
  try {
    const { resource } = await container.item(session.id, userId).read<CosmosSessionDocument>();
    existing = resource ?? null;
  } catch {
    /* doc may not exist yet */
  }
  const doc: CosmosSessionDocument = existing
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
  await container.items.upsert(doc);
}

export async function deleteSession(
  userId: string,
  sessionId: string,
): Promise<void> {
  const container = getSessionsContainer();
  await container.item(sessionId, userId).delete();
}

/** Upsert a full session document (used by server-side persistence). */
export async function upsertSessionDoc(doc: CosmosSessionDocument): Promise<void> {
  const container = getSessionsContainer();
  await container.items.upsert(doc);
}

/** Fetch a single session doc by id + userId (point read — fast). */
export async function getSessionDoc(
  sessionId: string,
  userId: string,
): Promise<CosmosSessionDocument | null> {
  const container = getSessionsContainer();
  try {
    const { resource } = await container.item(sessionId, userId).read<CosmosSessionDocument>();
    return resource ?? null;
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && "code" in e && (e as { code: number }).code === 404) return null;
    throw e;
  }
}

/** Fetch a session doc when userId is unknown — cross-partition query (slower). */
export async function getSessionDocById(
  sessionId: string,
): Promise<CosmosSessionDocument | null> {
  const container = getSessionsContainer();
  const { resources } = await container.items
    .query<CosmosSessionDocument>({
      query: "SELECT * FROM c WHERE c.id = @id",
      parameters: [{ name: "@id", value: sessionId }],
    })
    .fetchAll();
  return resources[0] ?? null;
}

/** Write a single message (turn) to the messages container. */
export async function upsertMessage(msg: CosmosMessageDocument): Promise<void> {
  const container = getMessagesContainer();
  await container.items.upsert(msg);
}

/** Fetch all messages for a session, ordered by the `order` field. */
export async function getMessagesBySession(
  sessionId: string,
): Promise<CosmosMessageDocument[]> {
  const container = getMessagesContainer();
  const { resources } = await container.items
    .query<CosmosMessageDocument>(
      {
        query: "SELECT * FROM c WHERE c.sessionId = @sid ORDER BY c[\"order\"] ASC",
        parameters: [{ name: "@sid", value: sessionId }],
      },
      { partitionKey: sessionId },
    )
    .fetchAll();
  return resources;
}

/** Delete all messages for a session (used when deleting a session from the dashboard). */
export async function deleteMessagesBySession(sessionId: string): Promise<void> {
  const container = getMessagesContainer();
  const messages = await getMessagesBySession(sessionId);
  for (const msg of messages) {
    await container.item(msg.id, sessionId).delete();
  }
}
