import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Mirrors login's safeDest: in-app path or /dashboard, never an auth route. */
function safeDest(path: string | null): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return "/dashboard";
  if (
    ["/login", "/signup", "/signout", "/auth"].some((p) => path.startsWith(p)) ||
    path.startsWith("/portal")
  ) {
    return "/dashboard";
  }
  return path;
}

/**
 * OAuth callback (Supabase SSR PKCE flow): exchanges the ?code for a session.
 *
 * DESIGN: Google is SIGN-IN ONLY — it never provisions an agency. Agency
 * signup stays on the form (it needs an agency name and deliberate tenant
 * setup), and an invited member who clicks Google before accepting their
 * invite must not spawn a phantom agency. Supabase auto-links the Google
 * identity to an existing user with the same verified email, so invited
 * members and password users can sign in with Google freely. A Google user
 * with no active team_members row is signed out and bounced to /login with
 * a clear message. The orphaned auth user (if the exchange created one) is
 * deliberately NOT deleted: it may be a mid-signup owner whose agency
 * provisioning failed, and signUpAction/invites both already handle
 * "already registered" users by recovering/linking them.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const next = safeDest(url.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    console.error("OAuth callback: code exchange failed:", error?.message);
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  // Sign-in only: require an existing active team membership.
  const admin = createAdminClient();
  const { data: member } = await admin
    .from("team_members")
    .select("id")
    .eq("user_id", data.user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!member) {
    await supabase.auth.signOut();
    const email = encodeURIComponent(data.user.email ?? "");
    return NextResponse.redirect(`${origin}/login?error=no_account&email=${email}`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
