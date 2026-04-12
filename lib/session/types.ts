export type AgentId = "visionary" | "critic" | "judge" | "user" | "system";

export type SessionState =
  | "idle"
  | "running"
  | "awaiting_user"
  | "ended";

export type Turn = {
  id: string;
  agent: AgentId;
  text: string;
  createdAt: number;
  stanceAtTurn?: number;
};

export type Stance = {
  visionary: number;
  critic: number;
};

export type CandidateIdea = {
  title: string;
  summary: string;
};

export type Session = {
  id: string;
  topic: string;
  ideaCount: number;
  contextType: string | null;
  createdAt: number;
  state: SessionState;
  stance: Stance;
  turns: Turn[];
  exchangesInCycle: number;
  pendingInterjection: string | null;
  lastCandidates: CandidateIdea[] | null;
};

export type JudgeResult = {
  converged: boolean;
  reason: string;
  candidates: CandidateIdea[];
  userSatisfied: boolean;
};
