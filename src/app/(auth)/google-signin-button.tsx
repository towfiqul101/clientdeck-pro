"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AlertCircle } from "lucide-react";

/**
 * "Continue with Google" for /login and /signup. Requires the Google provider
 * to be enabled in Supabase Dashboard → Authentication → Providers (with a
 * Google Cloud OAuth client whose redirect URI is the Supabase
 * /auth/v1/callback URL) — if it isn't, the error renders inline here.
 *
 * Google is sign-in only: the /auth/callback route rejects users with no
 * team membership (see the design note there).
 */
export function GoogleSignInButton() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setError(null);
    setPending(true);
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });
    // On success the browser navigates away; we only get here on failure.
    if (oauthError) {
      setError(
        /not enabled|unsupported/i.test(oauthError.message)
          ? "Google sign-in isn't enabled yet. Use your email and password instead."
          : oauthError.message
      );
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-white/10" />
        <span className="text-xs uppercase tracking-wide text-slate-600">or</span>
        <span className="h-px flex-1 bg-white/10" />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="flex w-full items-center justify-center gap-2.5 rounded-md border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.8z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.11A12 12 0 0 0 12 24z"
          />
          <path
            fill="#FBBC05"
            d="M5.28 14.28a7.21 7.21 0 0 1 0-4.56V6.61H1.27a12 12 0 0 0 0 10.78l4.01-3.11z"
          />
          <path
            fill="#EA4335"
            d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.61l4.01 3.11C6.22 6.88 8.87 4.77 12 4.77z"
          />
        </svg>
        {pending ? "Redirecting…" : "Continue with Google"}
      </button>
    </div>
  );
}
