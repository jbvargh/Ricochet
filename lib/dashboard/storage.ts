const STORAGE_KEY = "ricochet-sessions";

export type DashboardSession = {
  id: string;
  topic: string;
  createdAt: number;
  state: "running" | "awaiting_user" | "ended";
  lastCandidates: Array<{ title: string; summary: string }> | null;
  turnCount: number;
};

export function getDashboardSessions(): DashboardSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as DashboardSession[];
  } catch {
    return [];
  }
}

export function upsertDashboardSession(session: DashboardSession): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getDashboardSessions();
    const idx = existing.findIndex((s) => s.id === session.id);
    if (idx >= 0) {
      existing[idx] = session;
    } else {
      existing.unshift(session);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  } catch {
    /* ignore storage errors */
  }
}

export function removeDashboardSession(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getDashboardSessions().filter((s) => s.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  } catch {
    /* ignore storage errors */
  }
}
