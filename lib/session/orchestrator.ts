import { runCritic } from "@/lib/agents/critic";
import { runJudge } from "@/lib/agents/judge";
import { runVisionary } from "@/lib/agents/visionary";
import {
  MAX_EXCHANGES_PER_CYCLE,
  JUDGE_EVERY_N_EXCHANGES,
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
  persistTurn,
  updateSession,
} from "@/lib/session/store";
import type { AgentId, Turn } from "@/lib/session/types";

async function appendTurn(
  sessionId: string,
  agent: AgentId,
  text: string,
  stanceAtTurn?: number,
): Promise<void> {
  const turn: Turn = {
    id: crypto.randomUUID(),
    agent,
    text,
    createdAt: Date.now(),
    stanceAtTurn,
  };
  const session = updateSession(sessionId, (s) => ({
    ...s,
    turns: [...s.turns, turn],
  }));
  const order = session ? session.turns.length - 1 : 0;
  await persistTurn(sessionId, turn, order);
}

/** Between agent turns: append pending user text if any (no decay). */
async function consumePendingInterjection(
  sessionId: string,
): Promise<{ text: string } | null> {
  const s = getSession(sessionId);
  if (!s?.pendingInterjection) return null;
  const text = s.pendingInterjection;
  updateSession(sessionId, (x) => ({ ...x, pendingInterjection: null }));
  await appendTurn(sessionId, "user", text);
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

  // #region agent log
  console.log(`[DBG] orchestrator entry id=${sessionId} state=${session.state} turns=${session.turns.length} exchanges=${session.exchangesInCycle}`);
  // #endregion

  // Always send session_init first so the client has topic/stance regardless of state.
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
        // #region agent log
        console.log(`[DBG] orchestrator AWAITING_USER → awaitFeedback id=${sessionId}`);
        // #endregion
        // Re-emit paused so a reconnecting client knows to show the feedback UI.
        yield { event: "paused", data: { candidates: session.lastCandidates ?? [] } };
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

        await appendTurn(sessionId, "user", textFromWait.trim());
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

      // #region agent log
      console.log(`[DBG] visionary done id=${sessionId} len=${visionaryText.length}`);
      // #endregion

      if (visionaryText.trim()) {
        await appendTurn(sessionId, "visionary", visionaryText, stanceVBefore);
        session = getSession(sessionId)!;
        yield {
          event: "agent_complete",
          data: {
            agent: "visionary",
            text: visionaryText,
            stance: session.stance,
          },
        };

        // #region agent log
        console.log(`[DBG] awaitDisplayReady(visionary) WAITING id=${sessionId}`);
        // #endregion
        await awaitDisplayReady(sessionId);
        // #region agent log
        console.log(`[DBG] awaitDisplayReady(visionary) RESOLVED id=${sessionId}`);
        // #endregion
      }
      session = getSession(sessionId)!;
      if (session.state === "ended") {
        yield {
          event: "ended",
          data: { finalCandidates: session.lastCandidates ?? [] },
        };
        return;
      }

      const afterV = await consumePendingInterjection(sessionId);
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

      // #region agent log
      console.log(`[DBG] critic done id=${sessionId} len=${criticText.length}`);
      // #endregion

      if (criticText.trim()) {
        await appendTurn(sessionId, "critic", criticText, stanceCBefore);
        session = getSession(sessionId)!;
        yield {
          event: "agent_complete",
          data: {
            agent: "critic",
            text: criticText,
            stance: session.stance,
          },
        };

        // #region agent log
        console.log(`[DBG] awaitDisplayReady(critic) WAITING id=${sessionId}`);
        // #endregion
        await awaitDisplayReady(sessionId);
        // #region agent log
        console.log(`[DBG] awaitDisplayReady(critic) RESOLVED id=${sessionId}`);
        // #endregion
      }
      session = getSession(sessionId)!;
      if (session.state === "ended") {
        yield {
          event: "ended",
          data: { finalCandidates: session.lastCandidates ?? [] },
        };
        return;
      }

      const afterC = await consumePendingInterjection(sessionId);
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

      const judgeOnSchedule =
        session.exchangesInCycle >= MIN_EXCHANGES_BEFORE_JUDGE &&
        session.exchangesInCycle % JUDGE_EVERY_N_EXCHANGES === 0;
      const judgeAtCycleCap =
        session.exchangesInCycle >= MIN_EXCHANGES_BEFORE_JUDGE &&
        session.exchangesInCycle >= MAX_EXCHANGES_PER_CYCLE;
      if (judgeOnSchedule || judgeAtCycleCap) {
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
