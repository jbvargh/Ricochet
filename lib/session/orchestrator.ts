import { runCritic } from "@/lib/agents/critic";
import { runJudge } from "@/lib/agents/judge";
import { runVisionary } from "@/lib/agents/visionary";
import {
  MAX_EXCHANGES_PER_CYCLE,
  MIN_EXCHANGES_BEFORE_JUDGE,
} from "@/lib/config";
import type { SSEPayload } from "@/lib/sse";
import {
  applyDecayStep,
  resetStance,
} from "@/lib/session/decay";
import {
  awaitDisplayReady,
  awaitFeedback,
  getSession,
  updateSession,
} from "@/lib/session/store";
import type { AgentId } from "@/lib/session/types";

function appendTurn(
  sessionId: string,
  agent: AgentId,
  text: string,
  stanceAtTurn?: number,
): void {
  updateSession(sessionId, (s) => ({
    ...s,
    turns: [
      ...s.turns,
      {
        id: crypto.randomUUID(),
        agent,
        text,
        createdAt: Date.now(),
        stanceAtTurn,
      },
    ],
  }));
}

/** Between agent turns: append pending user text if any (no decay). */
function consumePendingInterjection(
  sessionId: string,
): { text: string } | null {
  const s = getSession(sessionId);
  if (!s?.pendingInterjection) return null;
  const text = s.pendingInterjection;
  updateSession(sessionId, (x) => ({ ...x, pendingInterjection: null }));
  appendTurn(sessionId, "user", text);
  return { text };
}

export async function* runOrchestrator(
  sessionId: string,
  signal: AbortSignal,
): AsyncGenerator<SSEPayload> {
  let session = getSession(sessionId);
  if (!session) {
    yield { event: "error", data: { message: "session not found" } };
    return;
  }
  if (session.state === "ended") {
    yield {
      event: "ended",
      data: { finalCandidates: session.lastCandidates ?? [] },
    };
    return;
  }

  if (session.state === "idle") {
    updateSession(sessionId, (s) => ({ ...s, state: "running" }));
    session = getSession(sessionId)!;
  }

  yield {
    event: "session_init",
    data: {
      sessionId,
      topic: session.topic,
      ideaCount: session.ideaCount,
      contextType: session.contextType,
      stance: session.stance,
    },
  };

  try {
    while (true) {
      if (signal.aborted) {
        updateSession(sessionId, (s) =>
          s.state !== "ended" ? { ...s, state: "ended" } : s,
        );
        const s = getSession(sessionId);
        yield {
          event: "ended",
          data: { finalCandidates: s?.lastCandidates ?? [] },
        };
        return;
      }

      session = getSession(sessionId)!;

      if (session.state === "ended") {
        yield {
          event: "ended",
          data: { finalCandidates: session.lastCandidates ?? [] },
        };
        return;
      }

      if (session.state === "awaiting_user") {
        const textFromWait = await awaitFeedback(sessionId);
        session = getSession(sessionId)!;
        if (session.state === "ended") {
          yield {
            event: "ended",
            data: { finalCandidates: session.lastCandidates ?? [] },
          };
          return;
        }
        updateSession(sessionId, (s) => ({ ...s, pendingInterjection: null }));
        if (!textFromWait.trim()) {
          continue;
        }

        appendTurn(sessionId, "user", textFromWait.trim());
        yield {
          event: "user_message",
          data: { text: textFromWait.trim() },
        };
        session = getSession(sessionId)!;

        const judgeAfterFeedback = await runJudge(session, signal);
        yield {
          event: "judge_result",
          data: {
            converged: judgeAfterFeedback.converged,
            reason: judgeAfterFeedback.reason,
            candidates: judgeAfterFeedback.candidates,
            userSatisfied: judgeAfterFeedback.userSatisfied,
          },
        };

        if (judgeAfterFeedback.userSatisfied) {
          updateSession(sessionId, (s) => ({
            ...s,
            state: "ended",
            lastCandidates: judgeAfterFeedback.candidates,
          }));
          session = getSession(sessionId)!;
          yield {
            event: "ended",
            data: { finalCandidates: session.lastCandidates ?? [] },
          };
          return;
        }

        updateSession(sessionId, (s) => ({
          ...s,
          stance: resetStance(),
          exchangesInCycle: 0,
          state: "running",
        }));
        session = getSession(sessionId)!;
        yield { event: "resumed", data: { stance: session.stance } };
        continue;
      }

      session = getSession(sessionId)!;

      const stanceVBefore = session.stance.visionary;
      let visionaryText = "";
      try {
        for await (const delta of runVisionary(session, signal)) {
          visionaryText += delta;
          yield {
            event: "agent_token",
            data: { agent: "visionary", delta },
          };
        }
      } catch (e) {
        yield { event: "error", data: { message: String(e) } };
        updateSession(sessionId, (s) => ({ ...s, state: "ended" }));
        const s = getSession(sessionId);
        yield {
          event: "ended",
          data: { finalCandidates: s?.lastCandidates ?? [] },
        };
        return;
      }

      appendTurn(sessionId, "visionary", visionaryText, stanceVBefore);
      session = getSession(sessionId)!;
      yield {
        event: "agent_complete",
        data: {
          agent: "visionary",
          text: visionaryText,
          stance: session.stance,
        },
      };

      await awaitDisplayReady(sessionId);
      session = getSession(sessionId)!;
      if (session.state === "ended") {
        yield {
          event: "ended",
          data: { finalCandidates: session.lastCandidates ?? [] },
        };
        return;
      }

      const afterV = consumePendingInterjection(sessionId);
      if (afterV) {
        yield { event: "user_message", data: { text: afterV.text } };
      }

      session = getSession(sessionId)!;

      const stanceCBefore = session.stance.critic;
      let criticText = "";
      try {
        for await (const delta of runCritic(session, signal)) {
          criticText += delta;
          yield {
            event: "agent_token",
            data: { agent: "critic", delta },
          };
        }
      } catch (e) {
        yield { event: "error", data: { message: String(e) } };
        updateSession(sessionId, (s) => ({ ...s, state: "ended" }));
        const s = getSession(sessionId);
        yield {
          event: "ended",
          data: { finalCandidates: s?.lastCandidates ?? [] },
        };
        return;
      }

      appendTurn(sessionId, "critic", criticText, stanceCBefore);
      session = getSession(sessionId)!;
      yield {
        event: "agent_complete",
        data: {
          agent: "critic",
          text: criticText,
          stance: session.stance,
        },
      };

      await awaitDisplayReady(sessionId);
      session = getSession(sessionId)!;
      if (session.state === "ended") {
        yield {
          event: "ended",
          data: { finalCandidates: session.lastCandidates ?? [] },
        };
        return;
      }

      const afterC = consumePendingInterjection(sessionId);
      if (afterC) {
        yield { event: "user_message", data: { text: afterC.text } };
      }

      session = getSession(sessionId)!;
      const nextStance = applyDecayStep(session.stance);
      updateSession(sessionId, (s) => ({
        ...s,
        stance: nextStance,
        exchangesInCycle: s.exchangesInCycle + 1,
      }));
      session = getSession(sessionId)!;

      yield {
        event: "stance_update",
        data: { stance: session.stance },
      };

      if (session.exchangesInCycle >= MIN_EXCHANGES_BEFORE_JUDGE) {
        const judgeResult = await runJudge(session, signal);
        yield {
          event: "judge_result",
          data: {
            converged: judgeResult.converged,
            reason: judgeResult.reason,
            candidates: judgeResult.candidates,
            userSatisfied: judgeResult.userSatisfied,
          },
        };

        if (judgeResult.userSatisfied) {
          updateSession(sessionId, (s) => ({
            ...s,
            state: "ended",
            lastCandidates: judgeResult.candidates,
          }));
          session = getSession(sessionId)!;
          yield {
            event: "ended",
            data: { finalCandidates: session.lastCandidates ?? [] },
          };
          return;
        }

        const hitMax =
          session.exchangesInCycle >= MAX_EXCHANGES_PER_CYCLE;
        if (judgeResult.converged || hitMax) {
          updateSession(sessionId, (s) => ({
            ...s,
            lastCandidates: judgeResult.candidates,
            state: "awaiting_user",
          }));
          session = getSession(sessionId)!;
          yield {
            event: "paused",
            data: { candidates: judgeResult.candidates },
          };
          continue;
        }
      }
    }
  } finally {
    /* lock released by stream route */
  }
}
