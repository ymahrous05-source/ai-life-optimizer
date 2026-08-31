"use client";

// =====================================================================
// AuthForm
// Shared email/password + magic-link form for both /login and /signup.
// Uses Supabase Auth directly from the client (free tier, no extra infra).
// =====================================================================
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";

interface AuthFormProps {
  mode: "login" | "signup";
}

export default function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "check-email">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage(null);

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setStatus("error");
        setErrorMessage(error.message);
        return;
      }
      setStatus("check-email");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function handleMagicLink() {
    if (!email) {
      setErrorMessage("Enter your email first.");
      return;
    }
    setStatus("loading");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }
    setStatus("check-email");
  }

  if (status === "check-email") {
    return (
      <div className="rounded-deck border border-deck-line bg-deck-surface p-6 text-center shadow-panel">
        <p className="font-display text-sm font-semibold text-ink-primary">Check your inbox</p>
        <p className="mt-2 font-body text-xs text-ink-muted">
          We sent a confirmation link to {email}.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
      <div>
        <label className="mb-1 block font-body text-xs text-ink-muted" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-deck border border-deck-line bg-deck-surfaceRaised px-3 py-2 font-body text-sm text-ink-primary outline-none focus:border-energy-peak"
        />
      </div>

      <div>
        <label className="mb-1 block font-body text-xs text-ink-muted" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-deck border border-deck-line bg-deck-surfaceRaised px-3 py-2 font-body text-sm text-ink-primary outline-none focus:border-energy-peak"
        />
      </div>

      {errorMessage && <p className="font-body text-xs text-signal-cost">{errorMessage}</p>}

      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full rounded-deck bg-energy-peak px-4 py-2 font-body text-sm font-medium text-deck-bg transition hover:opacity-90 disabled:opacity-50"
      >
        {status === "loading" ? "Please wait…" : mode === "signup" ? "Create account" : "Log in"}
      </button>

      <button
        type="button"
        onClick={handleMagicLink}
        disabled={status === "loading"}
        className="w-full rounded-deck border border-deck-line px-4 py-2 font-body text-xs text-ink-muted transition hover:border-signal-info/60 hover:text-ink-primary"
      >
        Send me a magic link instead
      </button>
    </form>
  );
}
