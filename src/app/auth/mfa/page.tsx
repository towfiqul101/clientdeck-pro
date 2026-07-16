"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { AlertCircle, ShieldCheck, Loader2 } from "lucide-react";

/**
 * MFA challenge — the only page a signed-in AAL1 session with an enrolled
 * TOTP factor can use (getSessionContext() returns null everywhere else and
 * the dashboard layout redirects here). Verifying upgrades the session to
 * AAL2; a full-page navigation then re-reads the refreshed cookies.
 */
export default function MfaChallengePage() {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        window.location.assign("/login");
        return;
      }
      const { data } = await supabase.auth.mfa.listFactors();
      const verified = data?.totp.find((f) => f.status === "verified");
      if (!verified) {
        // Nothing to challenge — not an MFA user; go to the app.
        window.location.assign("/dashboard");
        return;
      }
      // Already AAL2? Straight through.
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel === "aal2") {
        window.location.assign("/dashboard");
        return;
      }
      setFactorId(verified.id);
      setChecking(false);
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setError(null);
    setBusy(true);

    const supabase = createClient();
    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId });
    if (challengeError || !challenge) {
      setError(challengeError?.message ?? "Could not start the verification.");
      setBusy(false);
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.trim(),
    });
    if (verifyError) {
      setError("That code didn't match. Try the current code from your app.");
      setBusy(false);
      return;
    }
    // Session is now AAL2 — full navigation so the server reads fresh cookies.
    window.location.assign("/dashboard");
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.assign("/login");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0f172a] px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl bg-[#13131f] p-8 shadow-xl">
          <div className="flex flex-col items-center text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <h1 className="mt-4 text-xl font-semibold text-slate-100">
              Two-factor verification
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Enter the 6-digit code from your authenticator app.
            </p>
          </div>

          {checking ? (
            <div className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking your session…
            </div>
          ) : (
            <>
              {error && (
                <div className="mt-6 flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <Field label="Authentication code" htmlFor="code">
                  <Input
                    id="code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123456"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    required
                  />
                </Field>
                <Button type="submit" loading={busy} disabled={code.length !== 6} className="w-full">
                  {busy ? "Verifying…" : "Verify"}
                </Button>
              </form>

              <button
                onClick={signOut}
                className="mt-4 w-full text-center text-sm text-slate-500 hover:text-slate-300"
              >
                Sign out and use a different account
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
