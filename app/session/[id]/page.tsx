"use client";

import { CONTEXT_OPTIONS } from "@/lib/context/umd";
import { ChatView } from "@/components/ChatView";
import { CandidatePanel } from "@/components/CandidatePanel";
import { EndButton } from "@/components/EndButton";
import { InterjectBox } from "@/components/InterjectBox";
import { JudgePanel } from "@/components/JudgePanel";
import { PendingMessageQueue } from "@/components/PendingMessageQueue";
import { TerpSparkHomeLink } from "@/components/TerpSparkWordmark";
import { SessionChatTitle } from "@/components/SessionChatTitle";
import { StanceMeter } from "@/components/StanceMeter";
import type {
  CandidateIdea,
  JudgeResult,
  SessionState,
  Stance,
  Turn,
} from "@/lib/session/types";
import { upsertDashboardSession } from "@/lib/dashboard/storage";
import { useWordThrottle } from "@/hooks/useWordThrottle";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";

/** Pause after a turn is committed before signaling the server to continue (matches prior UX). */
const INTER_AGENT_DELAY_MS = 1500;

function chatTitleStorageKey(sessionId: string) {
  return `terpspark-chat-title-${sessionId}`;
}

type StreamState = {
  /** Header chat title (client-only; rename persists in sessionStorage; server debate topic unchanged). */
  topic: string;
  ideaCount: number;
  contextType: string | null;
  stance: Stance;
  turns: Turn[];
  sessionState: SessionState;
  candidates: CandidateIdea[] | null;
  judgeHistory: Array<JudgeResult & { at: number }>;
  judgePanelOpen: boolean;
  streaming: { agent: "visionary" | "critic"; text: string } | null;
  error: string | null;
  finalCandidates: CandidateIdea[] | null;
  /** Client-only: message sent to server, shown until user_message SSE confirms it in the transcript. */
  pendingUserMessage: string | null;
};

type Action =
  | {
      type: "init";
      topic: string;
      ideaCount: number;
      contextType: string | null;
      stance: Stance;
    }
  | { type: "token"; agent: "visionary" | "critic"; delta: string }
  | {
      type: "complete";
      agent: "visionary" | "critic";
      text: string;
      stance: Stance;
    }
  | { type: "user_message"; text: string }
  | { type: "queue_user_message"; text: string }
  | { type: "clear_pending_user_message" }
  | { type: "stance"; stance: Stance }
  | { type: "judge"; payload: JudgeResult }
  | { type: "paused"; candidates: CandidateIdea[] }
  | { type: "resumed"; stance: Stance }
  | { type: "ended"; finalCandidates: CandidateIdea[] }
  | { type: "error"; message: string }
  | { type: "toggle_judge" }
  | { type: "close_judge" }
  | { type: "rename_chat_title"; title: string }
  | { type: "history"; turns: Turn[] }
  | { type: "reset" };

const initial: StreamState = {
  topic: "",
  ideaCount: 3,
  contextType: null,
  stance: { visionary: 1, critic: 0.5 },
  turns: [],
  sessionState: "idle",
  candidates: null,
  judgeHistory: [],
  judgePanelOpen: false,
  streaming: null,
  error: null,
  finalCandidates: null,
  pendingUserMessage: null,
};

function reducer(state: StreamState, action: Action): StreamState {
  switch (action.type) {
    case "init":
      return {
        ...state,
        topic: action.topic,
        ideaCount: action.ideaCount,
        contextType: action.contextType,
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
      return {
        ...state,
        turns: [...state.turns, turn],
        pendingUserMessage: null,
      };
    }
    case "queue_user_message":
      return { ...state, pendingUserMessage: action.text };
    case "clear_pending_user_message":
      return { ...state, pendingUserMessage: null };
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
        pendingUserMessage: null,
      };
    case "error":
      return {
        ...state,
        error: action.message,
        sessionState: "ended",
        streaming: null,
        pendingUserMessage: null,
      };
    case "toggle_judge":
      return { ...state, judgePanelOpen: !state.judgePanelOpen };
    case "close_judge":
      return { ...state, judgePanelOpen: false };
    case "rename_chat_title":
      return { ...state, topic: action.title };
    case "history":
      return { ...state, turns: action.turns };
    case "reset":
      return { ...initial };
    default:
      return state;
  }
}

export default function SessionPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";
  const [state, dispatch] = useReducer(reducer, initial);
  const pendingCompleteRef = useRef<Action | null>(null);
  const [streamFinished, setStreamFinished] = useState(false);
  const interAgentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [composeSeed, setComposeSeed] = useState<{
    id: number;
    text: string;
  } | null>(null);
  /** After editing a queued message, resume playback once the revised message is sent. */
  const resumeAfterQueuedEditSendRef = useRef(false);

  const { throttledStreaming, isPaused, togglePause, setPaused } = useWordThrottle(
    state.streaming,
    state.sessionState,
    streamFinished,
    () => {
      if (pendingCompleteRef.current) {
        dispatch(pendingCompleteRef.current);
        pendingCompleteRef.current = null;
      }
      setStreamFinished(false);

      if (interAgentTimerRef.current) {
        clearTimeout(interAgentTimerRef.current);
        interAgentTimerRef.current = null;
      }
      interAgentTimerRef.current = setTimeout(() => {
        interAgentTimerRef.current = null;
        void fetch(`/api/session/${id}/ready`, { method: "POST" });
      }, INTER_AGENT_DELAY_MS);
    },
  );

  const cancelPendingOnServer = useCallback(async (): Promise<boolean> => {
    if (!id) return false;
    const res = await fetch(`/api/session/${id}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cancelPending: true }),
    });
    return res.ok;
  }, [id]);

  const clearComposeSeed = useCallback(() => setComposeSeed(null), []);

  const handleReopen = useCallback(async () => {
    if (!id) return;
    const res = await fetch(`/api/session/${id}/reopen`, { method: "POST" });
    if (res.ok) {
      router.refresh();
      window.location.reload();
    }
  }, [id, router]);

  // Persist session snapshot to Cosmos (via API) for the dashboard
  useEffect(() => {
    if (!id || state.sessionState === "idle") return;
    const createdAt =
      state.turns.length > 0 ? state.turns[0].createdAt : Date.now();
    void upsertDashboardSession({
      id,
      topic: state.topic,
      createdAt,
      state: state.sessionState as "running" | "awaiting_user" | "ended",
      lastCandidates: state.finalCandidates ?? null,
      turnCount: state.turns.length,
    });
  }, [id, state.sessionState, state.turns.length, state.topic, state.finalCandidates]);

  const commitChatTitle = useCallback(
    (title: string) => {
      const t = title.trim();
      if (!t) return;
      if (id && typeof window !== "undefined") {
        sessionStorage.setItem(chatTitleStorageKey(id), t);
      }
      dispatch({ type: "rename_chat_title", title: t });
    },
    [id],
  );

  const handleCancelQueued = useCallback(async () => {
    const ok = await cancelPendingOnServer();
    if (ok) dispatch({ type: "clear_pending_user_message" });
  }, [cancelPendingOnServer]);

  const handleEditQueued = useCallback(
    async (text: string) => {
      setPaused(true);
      const ok = await cancelPendingOnServer();
      if (ok) {
        resumeAfterQueuedEditSendRef.current = true;
        dispatch({ type: "clear_pending_user_message" });
        setComposeSeed({ id: Date.now(), text });
      }
    },
    [cancelPendingOnServer, setPaused],
  );

  const handleInterjectSendSuccess = useCallback(() => {
    if (!resumeAfterQueuedEditSendRef.current) return;
    resumeAfterQueuedEditSendRef.current = false;
    setPaused(false);
  }, [setPaused]);

  useEffect(() => {
    if (state.sessionState === "ended" || state.error) {
      resumeAfterQueuedEditSendRef.current = false;
    }
  }, [state.sessionState, state.error]);

  useEffect(() => {
    if (!id) return;
    dispatch({ type: "reset" });
    const es = new EventSource(`/api/session/${id}/stream`);
    let esErrorCount = 0;
    const resetEsErrorCount = () => {
      esErrorCount = 0;
    };

    es.onerror = () => {
      esErrorCount += 1;
      if (esErrorCount >= 3) {
        dispatch({
          type: "error",
          message: "Unable to connect to session. Try refreshing.",
        });
        es.close();
      }
    };

    es.addEventListener("history", (ev) => {
      resetEsErrorCount();
      const data = JSON.parse((ev as MessageEvent).data) as { turns: Turn[] };
      dispatch({ type: "history", turns: data.turns });
    });

    es.addEventListener("session_init", (ev) => {
      resetEsErrorCount();
      const data = JSON.parse((ev as MessageEvent).data) as {
        topic: string;
        ideaCount: number;
        contextType?: string | null;
        stance: Stance;
      };
      let headerTitle = data.topic;
      if (typeof window !== "undefined" && id) {
        const stored = sessionStorage.getItem(chatTitleStorageKey(id));
        if (stored !== null && stored.trim() !== "") {
          headerTitle = stored.trim();
        }
      }
      dispatch({
        type: "init",
        topic: headerTitle,
        ideaCount: data.ideaCount,
        contextType: data.contextType ?? null,
        stance: data.stance,
      });
    });

    es.addEventListener("agent_token", (ev) => {
      resetEsErrorCount();
      const data = JSON.parse((ev as MessageEvent).data) as {
        agent: "visionary" | "critic";
        delta: string;
      };
      dispatch({ type: "token", agent: data.agent, delta: data.delta });
    });

    es.addEventListener("agent_complete", (ev) => {
      resetEsErrorCount();
      const data = JSON.parse((ev as MessageEvent).data) as {
        agent: "visionary" | "critic";
        text: string;
        stance: Stance;
      };
      pendingCompleteRef.current = {
        type: "complete",
        agent: data.agent,
        text: data.text,
        stance: data.stance,
      };
      setStreamFinished(true);
    });

    es.addEventListener("user_message", (ev) => {
      resetEsErrorCount();
      const data = JSON.parse((ev as MessageEvent).data) as { text: string };
      dispatch({ type: "user_message", text: data.text });
    });

    es.addEventListener("stance_update", (ev) => {
      resetEsErrorCount();
      const data = JSON.parse((ev as MessageEvent).data) as {
        stance: Stance;
      };
      dispatch({ type: "stance", stance: data.stance });
    });

    es.addEventListener("judge_result", (ev) => {
      resetEsErrorCount();
      const data = JSON.parse((ev as MessageEvent).data) as JudgeResult;
      dispatch({ type: "judge", payload: data });
    });

    es.addEventListener("paused", (ev) => {
      resetEsErrorCount();
      const data = JSON.parse((ev as MessageEvent).data) as {
        candidates: CandidateIdea[];
      };
      dispatch({ type: "paused", candidates: data.candidates });
    });

    es.addEventListener("resumed", (ev) => {
      resetEsErrorCount();
      const data = JSON.parse((ev as MessageEvent).data) as {
        stance: Stance;
      };
      dispatch({ type: "resumed", stance: data.stance });
    });

    es.addEventListener("ended", (ev) => {
      resetEsErrorCount();
      if (interAgentTimerRef.current) {
        clearTimeout(interAgentTimerRef.current);
        interAgentTimerRef.current = null;
      }
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
      resetEsErrorCount();
      try {
        const data = JSON.parse(ev.data) as { message?: string };
        if (interAgentTimerRef.current) {
          clearTimeout(interAgentTimerRef.current);
          interAgentTimerRef.current = null;
        }
        pendingCompleteRef.current = null;
        setStreamFinished(false);
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
      if (interAgentTimerRef.current) {
        clearTimeout(interAgentTimerRef.current);
        interAgentTimerRef.current = null;
      }
      es.close();
    };
  }, [id]);

  const ended = state.sessionState === "ended";

  return (
    <div className="bg-neutral-950 flex h-[100dvh] flex-col">
      <header className="flex h-[56px] shrink-0 items-center gap-3 border-b border-neutral-800 px-4">
        <TerpSparkHomeLink />
        <span className="shrink-0 font-mono text-[9px] text-neutral-700">//</span>
        <SessionChatTitle
          title={state.topic}
          onSave={commitChatTitle}
          disabled={ended || Boolean(state.error)}
        />
        {state.contextType ? (
          <span className="shrink-0 border border-neutral-700 bg-neutral-800 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-neutral-400">
            {CONTEXT_OPTIONS.find((o) => o.value === state.contextType)?.label ??
              state.contextType}
          </span>
        ) : null}
        {/* Session status indicator */}
        <span className="ml-1 hidden shrink-0 items-center gap-1.5 md:flex">
          <span
            className={`h-1.5 w-1.5 ${
              ended || state.error
                ? "bg-neutral-600"
                : state.sessionState === "running"
                  ? "bg-emerald-500"
                  : "bg-yellow-500"
            }`}
          />
          <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-neutral-600">
            {ended || state.error
              ? "Ended"
              : state.sessionState === "running"
                ? "Live"
                : "Awaiting"}
          </span>
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/dashboard"
            className="inline-flex shrink-0 items-center border border-neutral-700 px-2 py-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-neutral-400 transition-colors hover:border-neutral-500 hover:text-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 sm:px-3"
          >
            Dashboard
          </Link>
          <button
            type="button"
            onClick={() => dispatch({ type: "toggle_judge" })}
            className="border border-neutral-700 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-neutral-400 transition-colors hover:border-neutral-500 hover:text-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
          >
            {state.judgePanelOpen ? "Hide_judge" : "Show_judge"}
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
            <ChatView
              turns={state.turns}
              streaming={
                throttledStreaming
                  ? {
                      agent: throttledStreaming.agent,
                      text: throttledStreaming.displayedText,
                    }
                  : null
              }
            />
            {state.candidates ? (
              <div className="px-4 pb-2">
                <CandidatePanel
                  candidates={state.candidates}
                  ideaCount={state.ideaCount}
                />
              </div>
            ) : null}
            {ended ? (
              <div className="border-neutral-800 border-t px-4 py-4">
                <div className="mx-auto max-w-[720px] rounded-sm border border-neutral-800 bg-neutral-900 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-neutral-100">
                      Session ended
                    </h3>
                    <button
                      type="button"
                      onClick={() => void handleReopen()}
                      className="shrink-0 border border-red-700/60 bg-red-950/40 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.15em] text-red-300 transition-colors hover:bg-red-950/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                    >
                      Continue_session
                    </button>
                  </div>
                  {state.finalCandidates && state.finalCandidates.length > 0 ? (
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
                  ) : (
                    <p className="text-neutral-500 text-sm">No final candidates recorded.</p>
                  )}
                </div>
              </div>
            ) : null}
          </div>
          <aside className="flex w-full min-h-0 shrink-0 flex-col border-t border-neutral-800 bg-neutral-950 md:w-[240px] md:border-l md:border-t-0">
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
          inputLocked={state.pendingUserMessage != null}
          onQueued={(text) => dispatch({ type: "queue_user_message", text })}
          onSuccessfulSend={handleInterjectSendSuccess}
          composeSeed={composeSeed}
          onComposeSeedApplied={clearComposeSeed}
          queueSlot={
            state.pendingUserMessage != null ? (
              <PendingMessageQueue
                text={state.pendingUserMessage}
                onCancel={handleCancelQueued}
                onEdit={handleEditQueued}
              />
            ) : null
          }
          actionEnd={
            state.sessionState === "running" ? (
              <button
                type="button"
                onClick={togglePause}
                className="whitespace-nowrap border border-red-700/60 bg-red-950/40 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.15em] text-red-300 transition-colors hover:bg-red-950/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
              >
                {isPaused ? "Resume" : "Pause"}
              </button>
            ) : null
          }
        />
      </div>
    </div>
  );
}
