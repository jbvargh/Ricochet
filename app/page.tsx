import { TopicForm } from "@/components/TopicForm";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4 py-16">
      <div className="bg-neutral-900 border-neutral-800 w-full max-w-xl rounded-2xl border p-8 shadow-2xl">
        <h1 className="text-neutral-100 mb-2 text-4xl font-semibold tracking-tight">
          Ricochet
        </h1>
        <p className="text-neutral-400 mb-8 text-sm">
          Two agents debate your idea until they agree
        </p>
        <TopicForm />
      </div>
    </div>
  );
}
