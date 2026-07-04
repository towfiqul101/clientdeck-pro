import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncDocumentToDrive } from "@/lib/google-drive/sync";
import type { Document } from "@/types";

export const dynamic = "force-dynamic";
// Hobby plan caps functions at 60s; large libraries may need multiple runs.
export const maxDuration = 60;

const BUCKET = "documents";

function subFolderFor(doc: Document): string {
  if (doc.uploaded_by === "client") return "Client_Uploads";
  switch (doc.category) {
    case "dispute_letter":
      return "Letters";
    case "bureau_response":
      return "Bureau_Responses";
    default:
      return "Onboarding";
  }
}

/** POST — syncs all existing Supabase-stored documents into Google Drive. */
export async function POST() {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const agency = session.agency;
  if (!agency.google_drive_enabled || !agency.google_drive_refresh_token) {
    return NextResponse.json(
      { ok: false, error: "Google Drive is not connected." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data: docs } = await admin
    .from("documents")
    .select("*")
    .eq("agency_id", agency.id)
    .order("created_at", { ascending: true });

  const list = (docs ?? []) as Document[];
  if (list.length === 0) {
    return NextResponse.json({ ok: true, synced: 0, failed: 0, total: 0 });
  }

  const clientIds = [...new Set(list.map((d) => d.client_id))];
  const { data: clients } = await admin
    .from("clients")
    .select("id, first_name, last_name")
    .in("id", clientIds);
  const nameMap = new Map(
    (clients ?? []).map((c) => [c.id, `${c.first_name} ${c.last_name}`])
  );

  let synced = 0;
  let failed = 0;

  for (const doc of list) {
    try {
      const { data: blob } = await admin.storage.from(BUCKET).download(doc.storage_path);
      if (!blob) {
        failed++;
        continue;
      }
      const buffer = Buffer.from(await blob.arrayBuffer());
      const fileId = await syncDocumentToDrive(agency, {
        clientName: nameMap.get(doc.client_id) ?? "Unknown Client",
        subFolder: subFolderFor(doc),
        fileName: doc.name,
        fileBuffer: buffer,
        mimeType: doc.file_type || "application/octet-stream",
      });
      if (fileId) synced++;
      else failed++;
    } catch (err) {
      console.error("[Drive backfill] failed for", doc.id, err);
      failed++;
    }
    // Gentle pacing to respect Drive rate limits.
    await new Promise((r) => setTimeout(r, 400));
  }

  return NextResponse.json({ ok: true, synced, failed, total: list.length });
}
