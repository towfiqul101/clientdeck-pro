"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export interface SnapshotRequestResult {
  success: boolean;
  error?: string;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function submitSnapshotRequest(input: {
  name: string;
  email: string;
  ghlLocationId: string;
  agencyName: string;
  message: string;
}): Promise<SnapshotRequestResult> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();

  if (!name) return { success: false, error: "Name is required." };
  if (!isValidEmail(email)) return { success: false, error: "Enter a valid email." };

  const admin = createAdminClient();
  const { error } = await admin.from("snapshot_requests").insert({
    name,
    email,
    ghl_location_id: input.ghlLocationId.trim() || null,
    agency_name: input.agencyName.trim() || null,
    message: input.message.trim() || null,
  });

  if (error) {
    console.error("snapshot request insert failed:", error);
    return { success: false, error: "Could not submit your request. Try again." };
  }

  await notifyOwner({ ...input, name, email });
  return { success: true };
}

/** Best-effort owner notification via the Resend HTTP API (no SDK dependency). */
async function notifyOwner(input: {
  name: string;
  email: string;
  ghlLocationId: string;
  agencyName: string;
  message: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ADMIN_EMAIL;
  if (!apiKey || !to) return;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "ClientDeck Pro <onboarding@clientdeckpro.com>",
        to: [to],
        subject: `New snapshot request — ${input.name}`,
        text: [
          `Name: ${input.name}`,
          `Email: ${input.email}`,
          `Agency: ${input.agencyName || "—"}`,
          `GHL Location ID: ${input.ghlLocationId || "—"}`,
          `Message: ${input.message || "—"}`,
        ].join("\n"),
      }),
    });
  } catch (e) {
    console.error("Resend notification failed:", e);
  }
}
