import { CosmosClient, type Container } from "@azure/cosmos";
import type { DashboardSession } from "@/lib/dashboard/storage";

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

export type CosmosSessionDocument = DashboardSession & { userId: string };

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

  return resources.map((r) => ({
    id: r.id,
    topic: r.topic,
    createdAt: r.createdAt,
    state: r.state,
    lastCandidates: r.lastCandidates,
    turnCount: r.turnCount,
  }));
}

export async function upsertSession(
  userId: string,
  session: DashboardSession,
): Promise<void> {
  const container = getSessionsContainer();
  const doc: CosmosSessionDocument = {
    ...session,
    userId,
    id: session.id,
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
