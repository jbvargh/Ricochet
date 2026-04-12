"use client";

import { getFirebaseAuth } from "@/lib/firebase/client";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function safeNextParam(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/dashboard";
  }
  return next;
}

function firebaseAuthMessage(code: string): string {
  switch (code) {
    case "auth/email-already-in-use":
      return "Account exists. Sign in instead.";
    case "auth/invalid-email":
      return "Invalid email address.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Invalid credentials.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again later.";
    default:
      return "Something went wrong. Try again.";
  }
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setError(null);
    try {
      const auth = getFirebaseAuth();
      const cred =
        mode === "signup"
          ? await createUserWithEmailAndPassword(
              auth,
              email.trim(),
              password,
            )
          : await signInWithEmailAndPassword(auth, email.trim(), password);

      const idToken = await cred.user.getIdToken();
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ idToken }),
      });

      if (!res.ok) {
        await signOut(auth);
        setError("Could not establish session. Try again.");
        return;
      }

      router.push(safeNextParam(searchParams.get("next")));
    } catch (err: unknown) {
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code: string }).code)
          : "";
      setError(firebaseAuthMessage(code));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* ── Left panel ── */}
      <div className="relative flex flex-col justify-between bg-neutral-900 px-10 py-10 md:w-[45%]">
        <div className="flex items-center gap-3">
          <span className="flex h-6 w-6 items-center justify-center bg-red-700 text-[10px] font-black text-white">
            R
          </span>
          <span className="font-display text-sm font-black italic uppercase tracking-widest text-neutral-100">
            Ricochet
          </span>
        </div>

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

        <div className="border border-neutral-800 p-4">
          <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.2em] text-red-600">
            Metadata_log
          </p>
          <p className="text-[11px] leading-relaxed text-neutral-400">
            Authentication:{" "}
            <span className="text-neutral-200">Firebase</span>. Database:{" "}
            <span className="text-neutral-200">Azure CosmosDB</span>.
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center bg-neutral-950 px-10 py-16">
        <div className="w-full max-w-sm">
          <p className="mb-4 font-mono text-[9px] uppercase tracking-[0.25em] text-neutral-500">
            // Identity_verification
          </p>

          <h2 className="font-display mb-6 text-4xl font-black uppercase tracking-tight text-neutral-100">
            {mode === "signup" ? "Create account" : "Sign in"}
          </h2>

          <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-8">
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
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="border-b border-neutral-700 bg-transparent pb-2 pt-1 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-red-600 focus:outline-none"
              />
            </div>

            {error ? (
              <p className="text-xs text-red-400" role="alert">
                {error}
              </p>
            ) : null}

            <div className="mt-2 border border-dashed border-red-700/60 p-0.5">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-red-700 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-red-600 disabled:opacity-60"
              >
                {loading
                  ? "…"
                  : mode === "signup"
                    ? "Create_account"
                    : "Execute_login"}
              </button>
            </div>
          </form>

          <p className="mt-6 text-center font-mono text-[9px] uppercase tracking-[0.15em] text-neutral-600">
            {mode === "signup" ? (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  className="text-red-500 underline-offset-2 hover:underline"
                  onClick={() => {
                    setMode("signin");
                    setError(null);
                  }}
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                New researcher?{" "}
                <button
                  type="button"
                  className="text-red-500 underline-offset-2 hover:underline"
                  onClick={() => {
                    setMode("signup");
                    setError(null);
                  }}
                >
                  Create account
                </button>
              </>
            )}
          </p>

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

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-neutral-950" aria-busy="true" />
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
