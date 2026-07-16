"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";

type Result = { success: boolean; error?: string };

// "use server" modules may only export async functions — keep the cap local
// (mirrored in recipients-form.tsx).
const MAX_ADMIN_RECIPIENTS = 3;

/** Adds an admin notification email recipient (cap 3, cross-agency config). */
export async function addAdminRecipient(email: string): Promise<Result> {
  if (!(await isAdmin())) return { success: false, error: "Unauthorized." };

  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return { success: false, error: "Enter a valid email address." };
  }

  const admin = createAdminClient();

  const { count, error: countError } = await admin
    .from("admin_notification_recipients")
    .select("id", { count: "exact", head: true });
  if (countError) return { success: false, error: countError.message };
  if ((count ?? 0) >= MAX_ADMIN_RECIPIENTS) {
    return { success: false, error: `Maximum ${MAX_ADMIN_RECIPIENTS} recipients.` };
  }

  const { error } = await admin
    .from("admin_notification_recipients")
    .insert({ email: normalized });
  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      return { success: false, error: "That email is already a recipient." };
    }
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/settings");
  return { success: true };
}

export async function removeAdminRecipient(id: string): Promise<Result> {
  if (!(await isAdmin())) return { success: false, error: "Unauthorized." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("admin_notification_recipients")
    .delete()
    .eq("id", id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/settings");
  return { success: true };
}
