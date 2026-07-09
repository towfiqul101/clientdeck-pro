"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";

type Stage = "checking" | "expired" | "ready" | "done";

export default function ResetPasswordPage() {
  const [stage, setStage] = useState<Stage>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const readyRef = useRef(false);

  useEffect(() => {
    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        readyRef.current = true;
        setStage("ready");
      }
    });

    // The PASSWORD_RECOVERY event may have already fired (from detectSessionInUrl
    // processing the link on load) before this listener attached — check for an
    // existing session as a fallback.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && !readyRef.current) {
        readyRef.current = true;
        setStage("ready");
      }
    });

    // No separate way to detect an invalid/expired link client-side — it simply
    // never fires PASSWORD_RECOVERY. Time out and show a helpful message instead
    // of spinning forever.
    const timeout = setTimeout(() => {
      if (!readyRef.current) setStage("expired");
    }, 4000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setPending(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setPending(false);
      return;
    }

    setPending(false);
    setStage("done");
  }

  if (stage === "checking") {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
        <p className="text-sm text-slate-500">Checking your link…</p>
      </div>
    );
  }

  if (stage === "expired") {
    return (
      <div className="space-y-4 text-center">
        <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-left text-sm text-red-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            This link may have expired. Ask your agency admin to resend the
            welcome email.
          </span>
        </div>
      </div>
    );
  }

  if (stage === "done") {
    return (
      <div className="space-y-6 text-center">
        <div className="flex flex-col items-center gap-2">
          <CheckCircle className="h-8 w-8 text-green-400" />
          <p className="text-sm text-slate-300">
            Your password has been set.
          </p>
        </div>
        <Button
          className="w-full"
          onClick={() => window.location.assign("/dashboard")}
        >
          Go to dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-100">
          Set your password
        </h1>
        <p className="text-sm text-slate-500">
          Choose a password for your ClientDeck Pro account.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="New password" htmlFor="password">
          <Input
            id="password"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            required
          />
        </Field>

        <Field label="Confirm password" htmlFor="confirmPassword">
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            required
          />
        </Field>

        <Button type="submit" loading={pending} className="w-full">
          {pending ? "Setting password…" : "Set password"}
        </Button>
      </form>
    </div>
  );
}
