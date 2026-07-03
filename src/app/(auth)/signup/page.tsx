"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { signUpAction, type AuthActionState } from "../actions";
import { createClient } from "@/lib/supabase/client";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

const initialState: AuthActionState = {};

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(
    signUpAction,
    initialState
  );

  // Email + password are controlled so we can establish the session client-side
  // once the account has been created server-side (pre-confirmed).
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [finishing, setFinishing] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  useEffect(() => {
    if (!state.success) return;
    let cancelled = false;
    (async () => {
      setFinishing(true);
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (cancelled) return;
      if (error) {
        setSignInError(
          "Your account was created. Please sign in to continue."
        );
        setFinishing(false);
        return;
      }
      // Full-page navigation so the fresh auth cookies are read server-side on
      // one clean request (avoids the refresh-token rotation race).
      window.location.assign("/");
    })();
    return () => {
      cancelled = true;
    };
  }, [state.success, email, password]);

  const busy = pending || finishing;
  const errorMessage = signInError ?? state.error;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-gray-900">
          Create your agency account
        </h1>
        <p className="text-sm text-gray-500">
          Start managing disputes in minutes. 14-day free trial.
        </p>
      </div>

      {errorMessage && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {errorMessage}
            {signInError && (
              <>
                {" "}
                <Link href="/login" className="font-medium underline">
                  Go to login
                </Link>
                .
              </>
            )}
          </span>
        </div>
      )}

      <form action={formAction} className="space-y-4">
        <Field
          label="Agency name"
          htmlFor="agencyName"
          error={state.fieldErrors?.agencyName}
        >
          <Input
            id="agencyName"
            name="agencyName"
            placeholder="Acme Credit Solutions"
            autoComplete="organization"
            required
          />
        </Field>

        <Field label="Your name" htmlFor="name" error={state.fieldErrors?.name}>
          <Input
            id="name"
            name="name"
            placeholder="Jane Doe"
            autoComplete="name"
            required
          />
        </Field>

        <Field label="Email" htmlFor="email" error={state.fieldErrors?.email}>
          <Input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@agency.com"
            autoComplete="email"
            required
          />
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          error={state.fieldErrors?.password}
          hint="At least 8 characters."
        >
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

        <Button type="submit" loading={busy} className="w-full">
          {busy ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="text-center text-sm text-gray-500">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-blue-600 hover:text-blue-700"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
