"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { AlertCircle, ShieldCheck, ShieldOff, Loader2 } from "lucide-react";

interface EnrollData {
  factorId: string;
  qrCode: string; // SVG data URI from Supabase
  secret: string;
}

/**
 * TOTP two-factor enrollment (supabase.auth.mfa.*). Once a factor is
 * verified, enforcement is automatic: getSessionContext() refuses AAL1
 * sessions and the dashboard layout routes them to /auth/mfa.
 */
export function MfaSection() {
  const [loading, setLoading] = useState(true);
  const [verifiedFactorId, setVerifiedFactorId] = useState<string | null>(null);
  const [enroll, setEnroll] = useState<EnrollData | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data, error: listError } = await supabase.auth.mfa.listFactors();
    if (!listError && data) {
      const verified = data.totp.find((f) => f.status === "verified");
      setVerifiedFactorId(verified?.id ?? null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function startEnroll() {
    setError(null);
    setBusy(true);
    const supabase = createClient();

    // Clear any abandoned unverified factors first — a stale one would make
    // enroll() fail with "friendly name already exists".
    const { data: existing } = await supabase.auth.mfa.listFactors();
    for (const f of existing?.totp ?? []) {
      if (f.status !== "verified") {
        await supabase.auth.mfa.unenroll({ factorId: f.id }).catch(() => {});
      }
    }

    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Authenticator app",
    });
    setBusy(false);
    if (enrollError || !data) {
      setError(enrollError?.message ?? "Could not start enrollment.");
      return;
    }
    setEnroll({
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    });
  }

  async function confirmEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!enroll) return;
    setError(null);
    setBusy(true);

    const supabase = createClient();
    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId: enroll.factorId });
    if (challengeError || !challenge) {
      setError(challengeError?.message ?? "Could not create a challenge.");
      setBusy(false);
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: enroll.factorId,
      challengeId: challenge.id,
      code: code.trim(),
    });
    setBusy(false);
    if (verifyError) {
      setError("That code didn't match. Check your authenticator app and try again.");
      return;
    }
    setEnroll(null);
    setCode("");
    await refresh();
  }

  async function cancelEnroll() {
    if (enroll) {
      const supabase = createClient();
      await supabase.auth.mfa.unenroll({ factorId: enroll.factorId }).catch(() => {});
    }
    setEnroll(null);
    setCode("");
    setError(null);
  }

  async function disable() {
    if (!verifiedFactorId) return;
    if (!window.confirm("Disable two-factor authentication? Your password alone will sign you in again.")) {
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({
      factorId: verifiedFactorId,
    });
    setBusy(false);
    if (unenrollError) {
      // Unenrolling a verified factor requires an AAL2 session.
      setError(
        /aal2|assurance/i.test(unenrollError.message)
          ? "For security, disabling 2FA needs a session that passed the 2FA challenge. Sign out, sign back in (completing the code step), then disable it here."
          : unenrollError.message
      );
      return;
    }
    await refresh();
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Checking 2FA status…
      </div>
    );
  }

  // Enrolled and verified
  if (verifiedFactorId && !enroll) {
    return (
      <div className="max-w-md space-y-4">
        <div className="flex items-start gap-2 rounded-md border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-400">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Two-factor authentication is <strong>on</strong>. Signing in
            requires your password plus a 6-digit code from your authenticator
            app.
          </span>
        </div>
        {error && (
          <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <button
          onClick={disable}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md border border-red-500/30 px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-50"
        >
          <ShieldOff className="h-4 w-4" />
          {busy ? "Disabling…" : "Disable 2FA"}
        </button>
      </div>
    );
  }

  // Mid-enrollment: QR + verify
  if (enroll) {
    return (
      <div className="max-w-md space-y-4">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-400">
          <li>Scan the QR code with Google Authenticator, 1Password, Authy, etc.</li>
          <li>Enter the 6-digit code it shows to confirm.</li>
        </ol>
        <div className="inline-block rounded-lg bg-white p-3">
          {/* Supabase returns the QR as an SVG data URI */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enroll.qrCode} alt="TOTP enrollment QR code" className="h-40 w-40" />
        </div>
        <p className="break-all text-xs text-slate-500">
          Can&apos;t scan? Enter this key manually: <code className="text-slate-300">{enroll.secret}</code>
        </p>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={confirmEnroll} className="space-y-3">
          <Field label="6-digit code" htmlFor="mfaCode">
            <Input
              id="mfaCode"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
            />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" loading={busy} disabled={code.length !== 6}>
              {busy ? "Verifying…" : "Verify & enable"}
            </Button>
            <button
              type="button"
              onClick={cancelEnroll}
              className="rounded-md px-3 py-2 text-sm text-slate-500 hover:text-slate-300"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Not enrolled
  return (
    <div className="max-w-md space-y-4">
      <p className="text-sm text-slate-400">
        Add a 6-digit authenticator code on top of your password. Once
        enabled, every sign-in requires the code.
      </p>
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <Button onClick={startEnroll} loading={busy}>
        {busy ? "Preparing…" : "Enable two-factor authentication"}
      </Button>
    </div>
  );
}
