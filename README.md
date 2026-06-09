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
- **LLMs**: Pluggable providers (see below); Visionary, Critic, and primary Judge paths share a **fallback chain**; the Judge may prefer **Groq** when configured to spare quota on your main provider
- **Auth (optional)**: Firebase Authentication + signed session cookies (`jose`)
- **Persistence (optional)**: Azure Cosmos DB for session summaries and message history when configured

## Prerequisites

- Node.js 20+ (recommended for current Next.js)
- npm
- At least **one** LLM API key (see environment variables)

## Setup

1. **Clone and install**

   ```bash
   cd TerpSpark
   npm install
   ```

2. **Environment**

   Copy `.env.local.example` to `.env.local` and fill in values.

   **LLM provider chain** (first non-empty configuration wins for the main agent provider):

   1. TerpAI — `TERPAI_API_KEY`, `TERPAI_BASE_URL` (optional `TERPAI_MODEL`)
   2. Anthropic — `ANTHROPIC_API_KEY`
   3. Google Gemini — `GEMINI_API_KEY` (required `GEMINI_MODEL`)
   4. OpenAI — `OPENAI_API_KEY`
   5. Groq — `GROQ_API_KEY`

   **Always required for signed sessions**

   - `SESSION_SECRET` — long random string (32+ characters), server-only

   **Firebase** (if you use login / dashboard features that need identity)

   - `NEXT_PUBLIC_FIREBASE_*` for the client
   - `FIREBASE_SERVICE_ACCOUNT_KEY` — JSON string or path to a service account file (see `firebase-service-account-example.json`; do not commit real keys)

   **Azure Cosmos DB** (optional; enables durable session and message storage)

   - `COSMOS_ENDPOINT`, `COSMOS_KEY`, `COSMOS_DATABASE`, `COSMOS_CONTAINER`, `COSMOS_MESSAGES_CONTAINER`

3. **Run**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

   ```bash
   npm run build && npm start
   ```

   Use this for a production-style run locally.

## Project layout (high level)

- `app/` — routes (home, login, dashboard, live session pages) and `app/api/*` handlers
- `lib/session/` — orchestration, in-memory session state, types, stance decay
- `lib/agents/` — Visionary, Critic, Judge prompts and calls
- `lib/llm/` — provider selection and adapters
- `components/` — chat UI, stance meter, panels, forms

## Security notes

- Never commit `.env.local`, real Firebase service account JSON, or API keys.
- `firebase-service-account.json` in this repo should only be a local secret; prefer env-based configuration for deployment.

## License

Private project (`"private": true` in `package.json`). Adjust if you open-source it.
