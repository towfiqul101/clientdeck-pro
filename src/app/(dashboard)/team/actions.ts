"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkTeamMemberLimit } from "@/lib/team/limits";
import { PLAN_BY_ID } from "@/lib/billing/plans";
import { sendStaffInviteEmail } from "@/lib/email/templates";
import { STAFF_FACING_NOTIFICATION_TYPES } from "@/lib/team/notification-prefs";
import type { TeamRole } from "@/types";

type Result = { success: boolean; error?: string };

const INVITABLE_ROLES: TeamRole[] = ["admin", "staff", "viewer"];

export async function inviteTeamMember(input: {
  name: string;
  email: string;
  role: TeamRole;
}): Promise<Result> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  if (session.teamMember.role !== "owner" && session.teamMember.role !== "admin") {
    return { success: false, error: "Only owners and admins can invite team members." };
  }

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name || !email) return { success: false, error: "Name and email are required." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { success: false, error: "Enter a valid email address." };
  }
  const role: TeamRole = INVITABLE_ROLES.includes(input.role) ? input.role : "staff";

  // Enforce the plan's team-member limit.
  const limit = await checkTeamMemberLimit(session.agency.id, session.agency.plan);
  if (!limit.allowed) {
    const planName = PLAN_BY_ID[session.agency.plan]?.name ?? session.agency.plan;
    return {
      success: false,
      error: `Your ${planName} plan allows up to ${limit.max} team members. Upgrade to add more.`,
    };
  }

  const admin = createAdminClient();

  // Block duplicates within the agency.
  const { data: existing } = await admin
    .from("team_members")
    .select("id")
    .eq("agency_id", session.agency.id)
    .eq("email", email)
    .maybeSingle();
  if (existing) {
    return { success: false, error: "That email is already on your team." };
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://app.roundtrackpro.com").replace(/\/$/, "");

  let userId: string | null = null;
  let createdNewUser = false;
  let inviteLink = `${appUrl}/login`;
  try {
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo: `${appUrl}/reset-password` },
    });
    if (!linkError && linkData?.user) {
      userId = linkData.user.id;
      createdNewUser = true;
      inviteLink = linkData.properties?.action_link ?? inviteLink;
    } else if (linkError && /already.*(registered|exists)|email.*exists/i.test(linkError.message)) {
      // Email already has a Supabase Auth account elsewhere (e.g. owns/works
      // at another agency) — reuse that user id instead of failing the invite.
      for (let page = 1; page <= 5; page++) {
        const { data, error: listError } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (listError || !data) break;
        const match = data.users.find((u) => u.email?.toLowerCase() === email);
        if (match) {
          userId = match.id;
          break;
        }
        if (data.users.length < 200) break;
      }
    }
  } catch (e) {
    console.error("Could not generate team invite link:", e);
  }

  const { error } = await admin.from("team_members").insert({
    agency_id: session.agency.id,
    user_id: userId,
    name,
    email,
    role,
    is_active: true,
  });
  if (error) {
    if (createdNewUser && userId) {
      await admin.auth.admin.deleteUser(userId).catch((e) =>
        console.error("Could not clean up orphaned invite account:", e)
      );
    }
    return { success: false, error: error.message };
  }

  after(() => {
    sendStaffInviteEmail({
      inviteeName: name,
      inviteeEmail: email,
      agencyName: session.agency.name,
      inviterName: session.teamMember.name,
      inviteLink,
    }).catch((err) => console.error("[Email] Staff invite email failed:", err));
  });

  revalidatePath("/team");
  return { success: true };
}

/**
 * Sets a team member's own GHL contact id, so staff-facing notifications can
 * reach them via a GHL tag/workflow instead of only Resend email. Self, or
 * an owner/admin configuring on someone else's behalf (mirrors the invite
 * permission).
 */
export async function updateMemberGhlContactId(
  memberId: string,
  ghlContactId: string
): Promise<Result> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  const isSelf = memberId === session.teamMember.id;
  const isManager = session.teamMember.role === "owner" || session.teamMember.role === "admin";
  if (!isSelf && !isManager) {
    return { success: false, error: "Only owners/admins can set another member's GHL contact id." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("team_members")
    .update({ ghl_contact_id: ghlContactId.trim() || null })
    .eq("id", memberId)
    .eq("agency_id", session.agency.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/team");
  return { success: true };
}

/** Self-service only — a team member sets their own notification subscriptions. */
export async function updateNotificationPrefs(types: string[]): Promise<Result> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  const valid = types.filter((t) => (STAFF_FACING_NOTIFICATION_TYPES as string[]).includes(t));

  const admin = createAdminClient();
  const { error } = await admin
    .from("team_members")
    .update({ subscribed_notification_types: valid })
    .eq("id", session.teamMember.id)
    .eq("agency_id", session.agency.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/team");
  return { success: true };
}
