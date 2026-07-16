"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { AlertCircle, MailCheck } from "lucide-react";

/**
 * Requests a login-email change via supabase.auth.updateUser({ email }).
 * With Supabase's "Secure email change" (default), confirmation links go to
 * BOTH the current and the new address, and the change only lands once both
 * are clicked. team_members.email (+ agencies.owner_email for owners) is
 * synced lazily by getSessionContext() on the first request afterwards.
 */
export function EmailChangeForm({
  currentEmail,
  isOwner,
}: {
  currentEmail: string;
  isOwner: boolean;
}) {
  const [newEmail, setNewEmail] = useState("");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [requested, setRequested] = useState(false);

  // A change requested earlier (possibly in another tab/session) shows up as
  // user.new_email until both confirmations land.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const pending = (data.user as { new_email?: string } | null)?.new_email;
      if (pending) setPendingEmail(pending);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const email = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (email === currentEmail.toLowerCase()) {
      setError("That's already your login email.");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser(
      { email },
      { emailRedirectTo: `${window.location.origin}/settings/account` }
    );
    setSubmitting(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    setPendingEmail(email);
    setRequested(true);
    setNewEmail("");
  }

  return (
    <div className="max-w-md space-y-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500">Current email</p>
        <p className="mt-0.5 text-sm font-medium text-slate-200">{currentEmail}</p>
      </div>

      {pendingEmail && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-400">
          <MailCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Change to <strong>{pendingEmail}</strong> is pending.
            {requested ? " We just sent" : " We previously sent"} confirmation
            links to <strong>both</strong> {currentEmail} and {pendingEmail} —
            the change completes only after both are clicked. You can keep
            signing in with your current email until then.
          </span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="New email" htmlFor="newEmail">
          <Input
            id="newEmail"
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="you@newdomain.com"
            autoComplete="email"
            required
          />
        </Field>
        <Button type="submit" loading={submitting}>
          {submitting ? "Sending confirmations…" : "Change email"}
        </Button>
      </form>

      {isOwner && (
        <p className="text-xs text-slate-500">
          You&apos;re the agency owner — once confirmed, your agency&apos;s
          contact email (used on the client portal and billing) updates to the
          new address automatically.
        </p>
      )}
    </div>
  );
}
