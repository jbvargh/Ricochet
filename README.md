# TerpSpark
by Joshua Varghese, Daksh Patel, Vishal Senthilkumar and Aditya Mahesh

**TerpSpark** is a web app that turns a rough topic into stronger ideas through a **structured two-agent debate**. You set a topic and how many candidate ideas you want; a **Visionary** pushes for bold directions while a **Critic** stress-tests them. A **Judge** model watches the conversation, decides when the agents have converged on your target number of shared candidates, and can pause for your feedback so the next round refines what already worked.

The UI streams the dialogue in real time (Server-Sent Events), shows **stance** evolution (how “ambitious” vs “grounded” the Visionary is, and how “constructive” vs “harsh” the Critic is), and lets you **interject** anytime without resetting the cycle.

## Why it’s useful

- **Reduces one-sided brainstorming**: Instead of a single chatbot agreeing with you, you get explicit tension between expansion and critique.
- **Convergence you can steer**: Periodic checkpoints surface concrete candidate ideas; your reply reshapes the next pass instead of starting from zero.
- **Transparent dynamics**: Stance decay over exchanges makes the “temperature” of each agent legible, so the arc of the session is easier to reason about than a flat assistant thread.

## Tech stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router), TypeScript, Node server runtime (SSE / long-lived orchestration)
- **UI**: React, Tailwind CSS, shadcn-style components
- **LLMs**: Pluggable providers (see [Environment variables](#environment-variables)); Visionary, Critic, and most Judge calls share a **fallback chain**; the Judge prefers **Groq** when configured to spare quota on your main provider
- **Auth**: Firebase Authentication + signed session cookies (`jose`)
- **Persistence**: Azure Cosmos DB for session summaries and message history
- **Linting**: [ESLint](https://eslint.org/) with `eslint-config-next` (Core Web Vitals + TypeScript)

## Prerequisites

- Node.js 20+ (recommended for current Next.js)
- npm
- Values for `SESSION_SECRET` and at least **one** LLM provider (see [Environment variables](#environment-variables))

## Setup

1. **Clone and install**

   ```bash
   cd TerpSpark
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

   **Azure Cosmos DB** (required for dashboard history and durable sessions)

   | Variable | Default | Notes |
   | --- | --- | --- |
   | `COSMOS_ENDPOINT` | — | Account URI from Azure Portal |
   | `COSMOS_KEY` | — | Primary or secondary key |
   | `COSMOS_DATABASE` | `ricochet` | Database name |
   | `COSMOS_CONTAINER` | `sessions` | Partition key: `/userId` |
   | `COSMOS_MESSAGES_CONTAINER` | `messages` | Partition key: `/sessionId` |

   Without Cosmos, live debates still work in memory; listing sessions and reloading history will fail until Cosmos is configured.

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
- `components/` — chat UI, stance meter, panels, forms
- `eslint.config.mjs` — ESLint flat config
- `.env.local.example` — documented template for all environment variables
- `.github/workflows/ci.yml` — GitHub Actions build on every push

## Security notes

- Never commit `.env.local`, real Firebase service account JSON, or API keys.
- `firebase-service-account.json` in this repo should only be a local secret; prefer env-based configuration for deployment.
- `SESSION_SECRET` must be unique per environment; treat it like a password.

## License

Private project (`"private": true` in `package.json`). Adjust if you open-source it.
