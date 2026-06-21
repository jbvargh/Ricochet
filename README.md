# Ricochet
by Joshua Varghese, Daksh Patel, Vishal Senthilkumar and Aditya Mahesh

**Ricochet** is a web app that turns a rough topic into stronger ideas through a **structured two-agent debate**. Instead of one chatbot that agrees with everything you say, Ricochet runs a live back-and-forth between specialized AI agents — then pauses at checkpoints so you can steer the next round.

## What it does

### The problem it solves

Most AI brainstorming tools give you one voice. That voice tends to validate your first idea, miss blind spots, and produce a wall of text that is hard to scan. Ricochet forces **creative tension**: one agent expands the idea space while another stress-tests it, until both converge on a short list of candidates you can actually use.

### How a session works

1. **Start a debate** — Visit `/dashboard/new` in the running app (no account required). Enter a topic, choose how many ideas the agents should converge on (1–10), and optionally pick a **UMD context** (Startup Shell, thesis direction, policy proposal, etc.) so prompts are grounded in University of Maryland programs and culture.

2. **Watch the agents debate** — A **Visionary** and **Critic** take turns in a live chat. Replies stream word-by-word over Server-Sent Events at a readable pace (~250 WPM). You can pause/resume the display if you need to catch up.

3. **See the dynamics** — A **stance meter** tracks how bold vs pragmatic the Visionary is, and how constructive vs harsh the Critic is. These values shift automatically each exchange (stance decay), so long debates naturally move from wild brainstorming toward sharper refinement.

4. **Interject anytime** — Type feedback between turns without stopping the session. Your message is queued and inserted before the next agent speaks, steering scope or emphasis without wiping the transcript.

5. **Hit checkpoints** — A silent **Judge** periodically reviews the full transcript and decides whether the agents have converged on your target number of ideas. When they have (or a cycle limit is reached), the debate **pauses** and surfaces **candidate ideas** — each with a title and one-line summary.

6. **Steer the next cycle** — Reply at a checkpoint to refine direction. Stance resets, the agents resume with your feedback in context, and the Judge re-evaluates. Say you are satisfied and the session ends with final candidates.

7. **Return later (with login)** — Sign in to save sessions to your **dashboard**. Past debates show status (Active, Awaiting, Resolved, Ended), let you reopen live sessions, and persist message history to **MongoDB** when configured.

### The three agents

| Agent | Visible in chat? | Role |
| --- | --- | --- |
| **Visionary** | Yes | Proposes and advocates ideas — starts bold and gradually grounds over the cycle. |
| **Critic** | Yes | Challenges assumptions, surfaces risks, and signals when an idea is strong enough to keep (`"I'd lock in …"`). |
| **Judge** | No | Reads the transcript, returns structured JSON: converged or not, reason, candidate list, and whether the user wants to stop. |

The Judge runs on a schedule (every few exchanges) and again after user feedback at a pause. When Groq is configured, the Judge prefers it to spare quota on your main LLM provider.

### What you get at the end

Concrete **candidate ideas** — short titles and summaries the agents agreed were worth keeping — plus the full debate transcript. Use them for pitches, essays, research directions, policy memos, or any brainstorm where you want both expansion and rigor.

### Under the hood (short version)

- **Orchestrator** (`lib/session/orchestrator.ts`) drives Visionary → Critic → stance update → optional Judge in a loop.
- **LLM providers** are pluggable with a priority fallback chain (TerpAI → Anthropic → Gemini → OpenAI → Groq).
- **Auth** uses Firebase; **persistence** uses MongoDB for session summaries and per-message history.

For the full design rationale, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Why it’s useful

- **Reduces one-sided brainstorming**: Explicit tension between expansion and critique beats a single agreeable assistant.
- **Convergence you can steer**: Checkpoints surface concrete candidates; your reply reshapes the next pass instead of starting from zero.
- **Transparent dynamics**: Stance decay makes each agent’s “temperature” legible over the arc of a session.
- **Built for UMD**: Optional context packs ground debates in campus programs, research culture, and local knowledge.

## Tech stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router), TypeScript, Node server runtime (SSE / long-lived orchestration)
- **UI**: React, Tailwind CSS, shadcn-style components
- **LLMs**: Pluggable providers (see [Environment variables](#environment-variables)); Visionary, Critic, and most Judge calls share a **fallback chain**; the Judge prefers **Groq** when configured to spare quota on your main provider
- **Auth**: Firebase Authentication + signed session cookies (`jose`)
- **Persistence**: [MongoDB](https://www.mongodb.com/) (Atlas or self-hosted) for session summaries and message history
- **Linting**: [ESLint](https://eslint.org/) with `eslint-config-next` (Core Web Vitals + TypeScript)

See [CONTRIBUTING.md](CONTRIBUTING.md) for architecture decisions (Visionary/Critic/Judge, stance decay, LLM fallback chain).

## Prerequisites

- Node.js 20+ (recommended for current Next.js)
- npm
- Values for `SESSION_SECRET` and at least **one** LLM provider (see [Environment variables](#environment-variables))

## Setup

1. **Clone and install**

   ```bash
   cd Ricochet
   npm install
   ```

2. **Environment**

   Copy the template and fill in values:

   ```bash
   cp .env.local.example .env.local   # macOS/Linux
   copy .env.local.example .env.local # Windows
   ```

   **`.env.local.example`** is the source of truth: every variable is listed with comments explaining what it does, whether it is required, and where to get the value. Restart `npm run dev` after editing `.env.local`.

   **Minimum to run a debate session**

   | Variable | Required |
   | --- | --- |
   | `SESSION_SECRET` | Yes — 32+ random characters (server-only) |
   | At least one LLM block | Yes — see provider chain below |

   **LLM provider chain** — Visionary, Critic, and most Judge calls use the **first** provider whose required variables are all set:

   | Priority | Provider | Required variables | Optional |
   | --- | --- | --- | --- |
   | 1 | TerpAI | `TERPAI_API_KEY`, `TERPAI_BASE_URL` | `TERPAI_MODEL` (default: `gpt-4o`) |
   | 2 | Anthropic | `ANTHROPIC_API_KEY` | Model fixed: `claude-sonnet-4-6` |
   | 3 | Google Gemini | `GEMINI_API_KEY` | `GEMINI_MODEL` (default: `gemini-2.0-flash`) |
   | 4 | OpenAI | `OPENAI_API_KEY` | Model fixed: `gpt-4o` |
   | 5 | Groq | `GROQ_API_KEY` | Model fixed: `llama-3.3-70b-versatile` |

   The **Judge** prefers Groq when `GROQ_API_KEY` is set; otherwise it uses the same provider as the agents.

   **Firebase** (required for login and dashboard)

   | Variable | Notes |
   | --- | --- |
   | `NEXT_PUBLIC_FIREBASE_API_KEY` | Client config (safe in browser) |
   | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Client config |
   | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Client config |
   | `FIREBASE_SERVICE_ACCOUNT_KEY` | Server-only — full JSON on one line or path to a file (see `firebase-service-account-example.json`) |

   **MongoDB** (required for dashboard history and durable sessions)

   | Variable | Default | Notes |
   | --- | --- | --- |
   | `MONGODB_URI` | — | Connection string from Atlas or local MongoDB (server-only) |
   | `MONGODB_DATABASE` | `ricochet` | Database name |
   | `MONGODB_SESSIONS_COLLECTION` | `sessions` | Session summaries; queried by `userId` |
   | `MONGODB_MESSAGES_COLLECTION` | `messages` | Chat turns; queried by `sessionId`, sorted by `order` |

   Without MongoDB, live debates still work in memory; listing sessions and reloading history will fail until it is configured. See `.env.local.example` for connection-string format and recommended indexes.

3. **Run**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

   Production-style run locally:

   ```bash
   npm run build && npm start
   ```

## Development

### ESLint

**ESLint** is a static analysis tool for JavaScript and TypeScript. It reads your source files without running the app and flags likely bugs, inconsistent patterns, and accessibility issues before they reach production. In this project it checks React components, Next.js conventions, TypeScript types, and Core Web Vitals-related patterns (for example, avoiding patterns that hurt page performance).

Configuration lives in **`eslint.config.mjs`** (ESLint 9 “flat config”). It extends:

- `eslint-config-next/core-web-vitals` — Next.js, React, React Hooks, jsx-a11y, and import rules
- `eslint-config-next/typescript` — recommended TypeScript rules

VS Code/Cursor picks up ESLint automatically via **`.vscode/settings.json`** (flat config enabled, fix-on-save for supported rules).

```bash
npm run lint       # report issues across the project
npm run lint:fix   # auto-fix where ESLint can
```

Run lint before opening a pull request or after larger refactors. Some rules (especially newer React 19 ref checks in streaming components) may report errors in code that is intentionally written for SSE and word-throttle behavior; see `eslint.config.mjs` for project-specific rule overrides.

### Continuous integration (GitHub Actions)

**GitHub Actions** runs automated checks in the cloud whenever you push to GitHub. This repo includes a workflow at **`.github/workflows/ci.yml`** that installs dependencies and runs `npm run build` on every push, so broken TypeScript or Next.js compile errors are caught before they land on `main`.

**How to enable it**

1. Push this repository to GitHub (create a new repo on [github.com](https://github.com/new) if you have not already).
2. Commit and push the workflow file — no secrets or repository settings are required for the build step; `next build` completes without real API keys in this project.
3. Open your repo on GitHub → **Actions**. The first workflow run should appear within a minute of your push.
4. Optional: under **Settings → Branches**, add a branch protection rule that requires the **CI** check to pass before merging.

**What the workflow does**

| Step | Command / action |
| --- | --- |
| Trigger | Every `git push` to any branch |
| Runner | `ubuntu-latest` with Node.js 20 |
| Install | `npm ci` (reproducible install from `package-lock.json`) |
| Verify | `npm run build` |

To also lint in CI, add `- run: npm run lint` after the build step (fix or relax existing lint errors first — see [ESLint](#eslint) above).

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm start` | Run production build |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Run ESLint with auto-fix |

## Project layout (high level)

- `app/` — routes (home, login, dashboard, live session pages) and `app/api/*` handlers
- `lib/session/` — orchestration, in-memory session state, types, stance decay
- `lib/agents/` — Visionary, Critic, Judge prompts and calls
- `lib/llm/` — provider selection and adapters
- `lib/mongodb/` — MongoDB client for sessions and messages
- `components/` — chat UI, stance meter, panels, forms
- `eslint.config.mjs` — ESLint flat config
- `.env.local.example` — documented template for all environment variables
- `.github/workflows/ci.yml` — GitHub Actions build on every push
- `CONTRIBUTING.md` — architecture and contribution guidelines

## Security notes

- Never commit `.env.local`, real Firebase service account JSON, MongoDB connection strings, or API keys.
- `firebase-service-account.json` in this repo should only be a local secret; prefer env-based configuration for deployment.
- `SESSION_SECRET` must be unique per environment; treat it like a password.

## License

Private project (`"private": true` in `package.json`). Adjust if you open-source it.
