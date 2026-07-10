"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SnapshotRequestStatus } from "@/types";

type Result = { success: boolean; error?: string };

export async function updateSnapshotRequestStatus(
  id: string,
  status: SnapshotRequestStatus
): Promise<Result> {
  if (!(await isAdmin())) return { success: false, error: "Forbidden." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("snapshot_requests")
    .update({ status })
    .eq("id", id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/snapshot-requests");
  return { success: true };
}

/** Marks a request sent and emails the requester the install instructions. */
export async function sendSnapshot(id: string): Promise<Result> {
  if (!(await isAdmin())) return { success: false, error: "Forbidden." };

  const admin = createAdminClient();
  const { data: req } = await admin
    .from("snapshot_requests")
    .select("*")
    .eq("id", id)
    .single();
  if (!req) return { success: false, error: "Request not found." };

  await sendSnapshotEmail(req.email, req.name);

  const { error } = await admin
    .from("snapshot_requests")
    .update({ status: "sent" })
    .eq("id", id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/snapshot-requests");
  return { success: true };
}

async function sendSnapshotEmail(to: string, name: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const subject = "Your RoundTrack Pro GHL snapshot is ready";
  const text = `Hi ${name},

Your GoHighLevel snapshot for RoundTrack Pro is ready to install.

1. Open the snapshot install link we've shared with you.
2. Select the GHL location you want to load it into.
3. Confirm the import — pipelines, custom fields, and workflows will be created automatically.

Reply to this email if you have any questions.

— RoundTrack Pro`;

  if (!apiKey) {
    console.log(`[DEV] Snapshot email would send to: ${to} — Subject: ${subject}`);
    return;
  }

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "RoundTrack Pro <onboarding@roundtrackpro.com>",
        to: [to],
        subject,
        text,
      }),
    });
  } catch (e) {
    console.error("Snapshot email failed:", e);
  }
}
