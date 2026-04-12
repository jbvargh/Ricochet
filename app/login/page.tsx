"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    if (typeof window !== "undefined") {
      localStorage.setItem("ricochet-user", JSON.stringify({ email: email.trim() }));
    }
    router.push("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* ── Left panel ── */}
      <div className="relative flex flex-col justify-between bg-neutral-900 px-10 py-10 md:w-[45%]">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <span className="flex h-6 w-6 items-center justify-center bg-red-700 text-[10px] font-black text-white">
            R
          </span>
          <span className="font-display text-sm font-black italic uppercase tracking-widest text-neutral-100">
            Ricochet
          </span>
        </div>

        {/* Hero text */}
        <div className="py-16">
          <p className="mb-5 font-mono text-[9px] uppercase tracking-[0.25em] text-red-600">
            System Protocol 001
          </p>
          <h1 className="font-display font-black uppercase leading-none text-neutral-100">
            <span className="block text-[clamp(2.5rem,5vw,4rem)] tracking-tight">
              Enter
            </span>
            <span className="block text-[clamp(2.5rem,5vw,4rem)] tracking-tight">
              the debate.
            </span>
          </h1>
          <p className="mt-6 max-w-xs text-xs leading-relaxed text-neutral-500">
            Two AI agents debate your idea until they converge on the strongest
            version of your thinking.
          </p>
        </div>

        {/* Bottom metadata */}
        <div className="border border-neutral-800 p-4">
          <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.2em] text-red-600">
            Metadata_log
          </p>
          <p className="text-[11px] leading-relaxed text-neutral-400">
            Authentication:{" "}
            <span className="text-neutral-200">Firebase</span>.{" "}
            Database:{" "}
            <span className="text-neutral-200">Azure CosmosDB</span>.
          </p>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex flex-1 flex-col items-center justify-center bg-neutral-950 px-10 py-16">
        <div className="w-full max-w-sm">
          {/* Breadcrumb */}
          <p className="mb-4 font-mono text-[9px] uppercase tracking-[0.25em] text-neutral-500">
            // Identity_verification
          </p>

          <h2 className="font-display mb-10 text-4xl font-black uppercase tracking-tight text-neutral-100">
            Sign in
          </h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-8">
            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="email"
                className="font-mono text-[9px] uppercase tracking-[0.2em] text-neutral-500"
              >
                Personnel_email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="border-b border-neutral-700 bg-transparent pb-2 pt-1 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-red-600 focus:outline-none"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="password"
                className="font-mono text-[9px] uppercase tracking-[0.2em] text-neutral-500"
              >
                Access_key
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="border-b border-neutral-700 bg-transparent pb-2 pt-1 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-red-600 focus:outline-none"
              />
            </div>

            {/* Submit */}
            <div className="mt-2 border border-dashed border-red-700/60 p-0.5">
              <button
                type="submit"
                className="w-full bg-red-700 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-red-600"
              >
                Execute_login
              </button>
            </div>
          </form>

          {/* Back link */}
          <div className="mt-8 flex items-center gap-3">
            <div className="h-px flex-1 bg-neutral-800" />
            <Link
              href="/"
              className="font-mono text-[9px] uppercase tracking-[0.2em] text-neutral-600 transition-colors hover:text-neutral-400"
            >
              ← Back
            </Link>
            <div className="h-px flex-1 bg-neutral-800" />
          </div>
        </div>
      </div>
    </div>
  );
}
