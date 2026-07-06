"use server";

import { after } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAgencyWelcomeEmail } from "@/lib/admin/welcome-email";

export interface AuthActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Signs up an agency owner:
 *  1. Creates the Supabase Auth user (sets the session cookie via the SSR client).
 *  2. Uses the service-role client to provision the `agencies` row and the
 *     owner's `team_members` row — this bypasses RLS, which can't yet resolve
 *     the user's agency because no team_member exists at this point.
 */
export async function signUpAction(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const agencyName = String(formData.get("agencyName") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  // --- Validation ---
  const fieldErrors: Record<string, string> = {};
  if (!agencyName) fieldErrors.agencyName = "Agency name is required.";
  if (!name) fieldErrors.name = "Your name is required.";
  if (!email) fieldErrors.email = "Email is required.";
  else if (!isValidEmail(email)) fieldErrors.email = "Enter a valid email.";
  if (!password) fieldErrors.password = "Password is required.";
  else if (password.length < 8)
    fieldErrors.password = "Password must be at least 8 characters.";

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  const admin = createAdminClient();

  // Create the auth user pre-confirmed (email_confirm: true) so agencies can
  // start working immediately without an email round-trip. If the email is
  // already registered (e.g. a previous stuck signup), we recover it by
  // resetting the password and confirming, so re-submitting "repairs" it.
  let userId: string;

  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });

  if (created?.user) {
    userId = created.user.id;
  } else if (createError && isAlreadyRegistered(createError.message)) {
    const existing = await findUserByEmail(admin, email);
    if (!existing) {
      return {
        error: "This email is already registered. Try logging in instead.",
      };
    }
    // Recover the account: set the just-entered password + confirm.
    await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    userId = existing.id;
  } else {
    return {
      error: createError?.message ?? "Could not create your account.",
    };
  }

  // --- Ensure the agency exists (owner_email is unique) ---
  let agencyId: string;
  const { data: existingAgency } = await admin
    .from("agencies")
    .select("id")
    .eq("owner_email", email)
    .maybeSingle();

  if (existingAgency) {
    agencyId = existingAgency.id;
    await admin
      .from("agencies")
      .update({ name: agencyName, owner_name: name, owner_user_id: userId })
      .eq("id", agencyId);
  } else {
    const { data: agency, error: agencyError } = await admin
      .from("agencies")
      .insert({
        name: agencyName,
        owner_name: name,
        owner_email: email,
        owner_user_id: userId,
      })
      .select("id")
      .single();
    if (agencyError || !agency) {
      return {
        error:
          agencyError?.message ??
          "Your account was created but we could not set up your agency.",
      };
    }
    agencyId = agency.id;
  }

  // --- Ensure the owner's team_member row exists and is linked ---
  const { data: existingMember } = await admin
    .from("team_members")
    .select("id")
    .eq("agency_id", agencyId)
    .eq("email", email)
    .maybeSingle();

  if (existingMember) {
    await admin
      .from("team_members")
      .update({ user_id: userId, name, role: "owner", is_active: true })
      .eq("id", existingMember.id);
  } else {
    const { error: memberError } = await admin.from("team_members").insert({
      agency_id: agencyId,
      user_id: userId,
      name,
      email,
      role: "owner",
    });
    if (memberError) {
      return {
        error:
          "Your agency was created but we could not add you to it. Contact support.",
      };
    }
  }

  // Best-effort welcome email — never blocks or fails the signup response.
  after(() => {
    sendAgencyWelcomeEmail({ name: agencyName, owner_name: name, owner_email: email }).catch((err) =>
      console.error("[Email] Welcome email failed:", err)
    );
  });

  return { success: true };
}

function isAlreadyRegistered(message: string): boolean {
  return /already.*(registered|exists)|email.*exists/i.test(message);
}

async function findUserByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string
): Promise<{ id: string } | null> {
  // listUsers is paginated; scan a few pages to find the match.
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error || !data) return null;
    const match = data.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );
    if (match) return { id: match.id };
    if (data.users.length < 200) break; // last page
  }
  return null;
}

/** Signs the current user out (server-side, clears the auth cookies). */
export async function signOutAction(): Promise<void> {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
}
