import { TerpSparkHomeLink } from "@/components/TerpSparkWordmark";
import { TopicForm } from "@/components/TopicForm";

export default function NewIdeaPage() {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-950">
      <header className="flex h-[56px] shrink-0 items-center gap-3 border-b border-neutral-800 px-6">
        <TerpSparkHomeLink />
        <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-neutral-600">
          // New_idea
        </span>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row">
        {/* Left info panel */}
        <div className="flex flex-col justify-center border-b border-neutral-800 bg-neutral-900 px-10 py-12 lg:w-[380px] lg:border-b-0 lg:border-r">
          <p className="mb-4 font-mono text-[9px] uppercase tracking-[0.25em] text-red-600">
            Initialize_session
          </p>
          <h1 className="font-display mb-4 text-4xl font-black uppercase leading-none tracking-tight text-neutral-100">
            New idea
          </h1>
          <p className="text-xs leading-relaxed text-neutral-500">
            Describe what you want the agents to debate. The more specific your
            topic, the richer the debate.
          </p>
          <div className="mt-10 border-t border-neutral-800 pt-6">
            <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-neutral-600">
              How it works
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {["Visionary proposes ideas", "Critic challenges every angle", "Judge evaluates convergence"].map((s) => (
                <li key={s} className="flex items-start gap-2 text-[11px] text-neutral-500">
                  <span className="mt-px text-red-700">▸</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right form panel */}
        <div className="flex flex-1 items-center justify-center px-8 py-12">
          <div className="w-full max-w-lg">
            <TopicForm />
          </div>
        </div>
      </div>
    </div>
  );
}
