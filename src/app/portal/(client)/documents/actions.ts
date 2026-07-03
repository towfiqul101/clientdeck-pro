"use server";

import { revalidatePath } from "next/cache";
import { getPortalSession } from "@/lib/portal/session";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DocumentCategory } from "@/types";

const BUCKET = "documents";

export interface PortalDocResult {
  success: boolean;
  error?: string;
}

/** Client-side upload from the portal. Validated via the portal session cookie. */
export async function portalUploadDocument(
  formData: FormData
): Promise<PortalDocResult> {
  const session = await getPortalSession();
  if (!session) return { success: false, error: "Session expired." };
  const { client, agency } = session;

  const category = String(
    formData.get("category") ?? "other"
  ) as DocumentCategory;
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "No file selected." };
  }
  if (file.size > 15 * 1024 * 1024) {
    return { success: false, error: "File must be under 15 MB." };
  }

  const admin = createAdminClient();
  const safeName = file.name.replace(/[^\w.\-]/g, "_");
  const path = `${agency.id}/${client.id}/portal-uploads/${Date.now()}-${safeName}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (uploadError) {
    return { success: false, error: `Upload failed: ${uploadError.message}` };
  }

  const { error: insertError } = await admin.from("documents").insert({
    client_id: client.id,
    agency_id: agency.id,
    uploaded_by: "client",
    name: file.name,
    file_type: file.type || null,
    file_size: file.size,
    storage_path: path,
    category,
  });
  if (insertError) {
    await admin.storage.from(BUCKET).remove([path]);
    return { success: false, error: insertError.message };
  }

  await admin.from("activity_log").insert({
    agency_id: agency.id,
    client_id: client.id,
    actor_type: "client",
    action: "Document uploaded",
    description: `Client uploaded ${file.name}`,
  });

  revalidatePath("/portal/documents");
  return { success: true };
}

/** Clients may only delete their OWN uploads. */
export async function portalDeleteDocument(
  documentId: string
): Promise<PortalDocResult> {
  const session = await getPortalSession();
  if (!session) return { success: false, error: "Session expired." };
  const { client } = session;

  const admin = createAdminClient();
  const { data: doc } = await admin
    .from("documents")
    .select("id, client_id, uploaded_by, storage_path")
    .eq("id", documentId)
    .single();

  if (!doc || doc.client_id !== client.id) {
    return { success: false, error: "Document not found." };
  }
  if (doc.uploaded_by !== "client") {
    return { success: false, error: "You can only delete your own uploads." };
  }

  await admin.from("documents").delete().eq("id", documentId);
  await admin.storage.from(BUCKET).remove([doc.storage_path]);

  revalidatePath("/portal/documents");
  return { success: true };
}

/** Signed download URL, scoped to the visitor's own client id. */
export async function portalGetDocumentUrl(
  storagePath: string
): Promise<{ url: string | null; error?: string }> {
  const session = await getPortalSession();
  if (!session) return { url: null, error: "Session expired." };
  const { client, agency } = session;

  if (!storagePath.startsWith(`${agency.id}/${client.id}/`)) {
    return { url: null, error: "Not authorized for this file." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 60);
  if (error || !data) return { url: null, error: "Could not create link." };
  return { url: data.signedUrl };
}
