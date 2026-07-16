import { cache } from "react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Agency, TeamMember } from "@/types";

export interface SessionContext {
  userId: string;
  teamMember: TeamMember;
  agency: Agency;
}

/**
 * True when the signed-in user has a VERIFIED TOTP factor but this session
 * is still at AAL1 — i.e. they logged in with just a password and must pass
 * the MFA challenge before the app is usable. getSessionContext() returns
 * null in that state (so every page and server action fails closed);
 * the dashboard layout calls this to route to /auth/mfa instead of signing
 * the user out.
 */
export const isMfaChallengeRequired = cache(async (): Promise<boolean> => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const hasVerifiedFactor = (user.factors ?? []).some(
    (f) => f.status === "verified"
  );
  if (!hasVerifiedFactor) return false;

  // Current level comes from the session JWT's aal claim. If the check
  // itself errors, err toward requiring the challenge (the user can pass
  // it) rather than silently waiving MFA.
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return true;
  return data.currentLevel !== "aal2";
});

/**
 * Resolves the authenticated user, their team_member record, and their agency.
 * Wrapped in React `cache()` so the layout and any child page/component in the
 * same request share a single set of queries.
 *
 * Returns null when there is no signed-in user OR no active team_member row
 * (e.g. mid-signup before the agency has been provisioned).
 */
export const getSessionContext = cache(
  async (): Promise<SessionContext | null> => {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    // MFA enforcement: a password-only (AAL1) session belonging to a user
    // with an enrolled+verified TOTP factor gets NO session context —
    // enrollment without enforcement would be decorative. The dashboard
    // layout routes this state to /auth/mfa.
    if (await isMfaChallengeRequired()) return null;

    const { data: teamMember, error } = await supabase
      .from("team_members")
      .select("*, agency:agencies(*)")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (error || !teamMember || !teamMember.agency) return null;

    const { agency, ...member } = teamMember as TeamMember & { agency: Agency };

    // Lazy login-email sync. Supabase Auth is the source of truth; after a
    // secure email change completes (confirmed from BOTH addresses), the
    // JWT's email differs from team_members.email — which is joined on as
    // identity by the invite duplicate check, resendInvite's generateLink
    // (would otherwise mail a recovery link to the OLD address), staff
    // notification delivery, and signup's owner-row link. Sync here on the
    // user's first request after the change; owners also carry
    // agencies.owner_email (the signup lookup key + portal contact address).
    if (user.email && user.email.toLowerCase() !== member.email.toLowerCase()) {
      const newEmail = user.email.toLowerCase();
      const admin = createAdminClient();
      const { error: syncError } = await admin
        .from("team_members")
        .update({ email: newEmail })
        .eq("id", member.id);
      if (syncError) {
        console.error("session: team_members.email sync failed:", syncError);
      } else {
        (member as TeamMember).email = newEmail;
        if (member.role === "owner") {
          // owner_email is UNIQUE — a conflict (another agency already owned
          // by this address) is logged, not fatal; the login itself is fine.
          const { error: ownerError } = await admin
            .from("agencies")
            .update({ owner_email: newEmail })
            .eq("id", agency.id);
          if (ownerError) {
            console.error("session: agencies.owner_email sync failed:", ownerError);
          }
        }
      }
    }

    return {
      userId: user.id,
      teamMember: member as TeamMember,
      agency: agency as Agency,
    };
  }
);
