"use server";

import { revalidatePath } from "next/cache";
import { getSessionContext } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SnapshotRequestStatus } from "@/types";

async function requireAdmin(): Promise<boolean> {
  const session = await getSessionContext();
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  return Boolean(
    session && adminEmail && session.agency.owner_email.toLowerCase() === adminEmail
  );
}

export async function updateSnapshotRequestStatus(
  id: string,
  status: SnapshotRequestStatus
): Promise<{ success: boolean; error?: string }> {
  if (!(await requireAdmin())) return { success: false, error: "Forbidden." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("snapshot_requests")
    .update({ status })
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/snapshot-requests");
  return { success: true };
}
