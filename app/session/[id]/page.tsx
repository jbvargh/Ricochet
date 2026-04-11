"use client";

import { ChatView } from "@/components/ChatView";
import { CandidatePanel } from "@/components/CandidatePanel";
import { EndButton } from "@/components/EndButton";
import { InterjectBox } from "@/components/InterjectBox";
import { JudgePanel } from "@/components/JudgePanel";
import { StanceMeter } from "@/components/StanceMeter";
import type {
  CandidateIdea,
  JudgeResult,
  SessionState,
  Stance,
  Turn,
} from "@/lib/session/types";
import { useParams } from "next/navigation";
import { useEffect, useReducer } from "react";

type StreamState = {
  topic: string;
  ideaCount: number;
  stance: Stance;
  turns: Turn[];
  sessionState: SessionState;
  candidates: CandidateIdea[] | null;
  judgeHistory: Array<JudgeResult & { at: number }>;
  judgePanelOpen: boolean;
  streaming: { agent: "visionary" | "critic"; text: string } | null;
  error: string | null;
  finalCandidates: CandidateIdea[] | null;
};

type Action =
  | { type: "init"; topic: string; ideaCount: number; stance: Stance }
  | { type: "token"; agent: "visionary" | "critic"; delta: string }
  | {
      type: "complete";
      agent: "visionary" | "critic";
      text: string;
      stance: Stance;
    }
  | { type: "user_message"; text: string }
  | { type: "stance"; stance: Stance }
  | { type: "judge"; payload: JudgeResult }
  | { type: "paused"; candidates: CandidateIdea[] }
  | { type: "resumed"; stance: Stance }
  | { type: "ended"; finalCandidates: CandidateIdea[] }
  | { type: "error"; message: string }
  | { type: "toggle_judge" }
  | { type: "close_judge" };

function reducer(state: StreamState, action: Action): StreamState {
  switch (action.type) {
    case "init":
      return {
        ...state,
        topic: action.topic,
        ideaCount: action.ideaCount,
        stance: action.stance,
        sessionState: "running",
      };
    case "token":
      return {
        ...state,
        streaming: {
          agent: action.agent,
          text: (state.streaming?.agent === action.agent
            ? state.streaming.text
            : "") + action.delta,
        },
      };
    case "complete": {
      const id = crypto.randomUUID();
      const turn: Turn = {
        id,
        agent: action.agent,
        text: action.text,
        createdAt: Date.now(),
        stanceAtTurn:
          action.agent === "visionary"
            ? action.stance.visionary
            : action.stance.critic,
      };
      return {
        ...state,
        turns: [...state.turns, turn],
        streaming: null,
        stance: action.stance,
      };
    }
    case "user_message": {
      const id = crypto.randomUUID();
      const turn: Turn = {
        id,
        agent: "user",
        text: action.text,
        createdAt: Date.now(),
      };
      return { ...state, turns: [...state.turns, turn] };
    }
    case "stance":
      return { ...state, stance: action.stance };
    case "judge":
      return {
        ...state,
        judgeHistory: [
          ...state.judgeHistory,
          { ...action.payload, at: Date.now() },
        ],
      };
    case "paused":
      return {
        ...state,
        sessionState: "awaiting_user",
        candidates: action.candidates,
      };
    case "resumed":
      return {
        ...state,
        sessionState: "running",
        stance: action.stance,
        candidates: null,
      };
    case "ended":
      return {
        ...state,
        sessionState: "ended",
        finalCandidates: action.finalCandidates,
        streaming: null,
      };
    case "error":
      return {
        ...state,
        error: action.message,
        sessionState: "ended",
        streaming: null,
      };
    case "toggle_judge":
      return { ...state, judgePanelOpen: !state.judgePanelOpen };
    case "close_judge":
      return { ...state, judgePanelOpen: false };
    default:
      return state;
  }
}

const initial: StreamState = {
  topic: "",
  ideaCount: 3,
  stance: { visionary: 1, critic: 0.5 },
  turns: [],
  sessionState: "idle",
  candidates: null,
  judgeHistory: [],
  judgePanelOpen: false,
  streaming: null,
  error: null,
  finalCandidates: null,
};

export default function SessionPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [state, dispatch] = useReducer(reducer, initial);

  useEffect(() => {
    if (!id) return;
    const es = new EventSource(`/api/session/${id}/stream`);

    es.addEventListener("session_init", (ev) => {
      const data = JSON.parse((ev as MessageEvent).data) as {
        topic: string;
        ideaCount: number;
        stance: Stance;
      };
      dispatch({
        type: "init",
        topic: data.topic,
        ideaCount: data.ideaCount,
        stance: data.stance,
      });
    });

    es.addEventListener("agent_token", (ev) => {
      const data = JSON.parse((ev as MessageEvent).data) as {
        agent: "visionary" | "critic";
        delta: string;
      };
      dispatch({ type: "token", agent: data.agent, delta: data.delta });
    });

    es.addEventListener("agent_complete", (ev) => {
      const data = JSON.parse((ev as MessageEvent).data) as {
        agent: "visionary" | "critic";
        text: string;
        stance: Stance;
      };
      dispatch({
        type: "complete",
        agent: data.agent,
        text: data.text,
        stance: data.stance,
      });
    });

    es.addEventListener("user_message", (ev) => {
      const data = JSON.parse((ev as MessageEvent).data) as { text: string };
      dispatch({ type: "user_message", text: data.text });
    });

    es.addEventListener("stance_update", (ev) => {
      const data = JSON.parse((ev as MessageEvent).data) as {
        stance: Stance;
      };
      dispatch({ type: "stance", stance: data.stance });
    });

    es.addEventListener("judge_result", (ev) => {
      const data = JSON.parse((ev as MessageEvent).data) as JudgeResult;
      dispatch({ type: "judge", payload: data });
    });

    es.addEventListener("paused", (ev) => {
      const data = JSON.parse((ev as MessageEvent).data) as {
        candidates: CandidateIdea[];
      };
      dispatch({ type: "paused", candidates: data.candidates });
    });

    es.addEventListener("resumed", (ev) => {
      const data = JSON.parse((ev as MessageEvent).data) as {
        stance: Stance;
      };
      dispatch({ type: "resumed", stance: data.stance });
    });

    es.addEventListener("ended", (ev) => {
      const data = JSON.parse((ev as MessageEvent).data) as {
        finalCandidates: CandidateIdea[];
      };
      dispatch({ type: "ended", finalCandidates: data.finalCandidates ?? [] });
      es.close();
    });

    es.addEventListener("error", (ev) => {
      if (!(ev instanceof MessageEvent) || !ev.data) {
        return;
      }
      try {
        const data = JSON.parse(ev.data) as { message?: string };
        dispatch({
          type: "error",
          message: data.message ?? "Something went wrong.",
        });
      } catch {
        return;
      }
      es.close();
    });

    return () => {
      es.close();
    };
  }, [id]);

  const ended = state.sessionState === "ended";

  return (
    <div className="bg-neutral-950 flex h-[100dvh] flex-col">
      <header className="border-neutral-800 flex h-[60px] shrink-0 items-center gap-4 border-b px-4">
        <span className="text-neutral-100 text-sm font-semibold">Ricochet</span>
        <span className="text-neutral-500">·</span>
        <span className="text-neutral-300 max-w-[min(40vw,320px)] truncate text-sm">
          {state.topic || "…"}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => dispatch({ type: "toggle_judge" })}
            className="focus-visible:ring-amber-400 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2"
          >
            {state.judgePanelOpen
              ? "Hide judge's thoughts"
              : "Show judge's thoughts"}
          </button>
          <EndButton sessionId={id} />
        </div>
      </header>

      {state.error ? (
        <div
          className="border-red-500/40 bg-red-950/40 text-red-200 border-b px-4 py-2 text-sm"
          role="alert"
        >
          {state.error}
        </div>
      ) : null}

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <ChatView turns={state.turns} streaming={state.streaming} />
            {state.candidates ? (
              <div className="px-4 pb-2">
                <CandidatePanel
                  candidates={state.candidates}
                  ideaCount={state.ideaCount}
                />
              </div>
            ) : null}
            {ended && state.finalCandidates ? (
              <div className="border-neutral-800 border-t px-4 py-4">
                <div className="border-neutral-800 bg-neutral-900 mx-auto max-w-[720px] rounded-xl border p-4">
                  <h3 className="text-neutral-100 mb-2 text-sm font-semibold">
                    Session ended
                  </h3>
                  <ul className="flex flex-col gap-2 text-sm text-neutral-300">
                    {state.finalCandidates.map((c, i) => (
                      <li key={`${c.title}-${i}`}>
                        <span className="text-neutral-100 font-medium">
                          {c.title}
                        </span>
                        {" — "}
                        {c.summary}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}
          </div>
          <aside className="border-neutral-800 bg-neutral-950 w-full shrink-0 border-t md:w-[240px] md:border-t-0 md:border-l">
            <StanceMeter stance={state.stance} />
          </aside>
          <JudgePanel
            open={state.judgePanelOpen}
            history={state.judgeHistory}
            onClose={() => dispatch({ type: "close_judge" })}
          />
        </div>
        <InterjectBox
          sessionId={id}
          sessionState={state.sessionState}
          disabled={ended || Boolean(state.error)}
        />
      </div>
    </div>
  );
}
