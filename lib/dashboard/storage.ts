export type DashboardSession = {
  id: string;
  topic: string;
  createdAt: number;
  state: "running" | "awaiting_user" | "ended";
  lastCandidates: Array<{ title: string; summary: string }> | null;
  turnCount: number;
};

export async function getDashboardSessions(): Promise<DashboardSession[]> {
  const res = await fetch("/api/sessions", {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json() as Promise<DashboardSession[]>;
}

export async function upsertDashboardSession(
  session: DashboardSession,
): Promise<void> {
  await fetch(`/api/sessions/${encodeURIComponent(session.id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(session),
  });
}

export async function removeDashboardSession(id: string): Promise<void> {
  await fetch(`/api/sessions/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
}
