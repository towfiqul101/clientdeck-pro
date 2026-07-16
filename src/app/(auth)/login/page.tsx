"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { GoogleSignInButton } from "../google-signin-button";

// /auth/callback bounce-back messages (OAuth is sign-in only — see the route).
function callbackError(code: string | null, email: string | null): string | null {
  if (code === "no_account") {
    return `No RoundTrack account found for ${email || "that Google account"}. Create an agency from the signup page, or ask your agency to invite you first.`;
  }
  if (code === "oauth") {
    return "Google sign-in didn't complete. Try again, or use your email and password.";
  }
  return null;
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFormSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginFormSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="h-6 w-32 animate-pulse rounded bg-white/[0.06]" />
        <div className="h-4 w-56 animate-pulse rounded bg-white/[0.06]" />
      </div>
      <div className="h-40 animate-pulse rounded bg-[#13131f]" />
    </div>
  );
}

// Only follow an in-app redirect target; never bounce back to an auth route.
// With no valid target we send the user to their dashboard, not the public
// landing page.
function safeDest(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) return "/dashboard";
  if (
    ["/login", "/signup", "/signout"].some((p) => path.startsWith(p)) ||
    path.startsWith("/portal")
  ) {
    return "/dashboard";
  }
  return path;
}

function LoginForm() {
  const searchParams = useSearchParams();
  const redirectedFrom = searchParams.get("redirectedFrom") || "/dashboard";
  const oauthError = callbackError(searchParams.get("error"), searchParams.get("email"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(oauthError);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setPending(false);
      return;
    }

    // Full-page navigation (not router.replace + refresh): a single request
    // guarantees the freshly-set auth cookies are read server-side and avoids a
    // refresh-token rotation race between concurrent RSC requests.
    window.location.assign(safeDest(redirectedFrom));
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-100">Welcome back</h1>
        <p className="text-sm text-slate-500">
          Sign in to your RoundTrack Pro account.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Email" htmlFor="email">
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

        <Field label="Password" htmlFor="password">
          <Input
            id="password"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
        </Field>

        <p className="text-right text-sm">
          <Link href="/forgot-password" className="font-medium text-blue-400 hover:text-blue-400">
            Forgot password?
          </Link>
        </p>

        <Button type="submit" loading={pending} className="w-full">
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <GoogleSignInButton />

      <p className="text-center text-sm text-slate-500">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="font-medium text-blue-400 hover:text-blue-400"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}
