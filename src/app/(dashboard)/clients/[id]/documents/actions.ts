"use server";

import { revalidatePath } from "next/cache";
import { getSessionContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DocumentCategory } from "@/types";

const BUCKET = "documents";

export interface DocActionResult {
  success: boolean;
  error?: string;
}

/**
 * Uploads a file to the private `documents` bucket (via service role, so it
 * works regardless of storage RLS) and records a row in the documents table.
 */
export async function uploadDocument(
  formData: FormData
): Promise<DocActionResult> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  const clientId = String(formData.get("clientId") ?? "");
  const category = String(formData.get("category") ?? "other") as DocumentCategory;
  const file = formData.get("file");

  if (!clientId) return { success: false, error: "Missing client." };
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "No file selected." };
  }
  if (file.size > 15 * 1024 * 1024) {
    return { success: false, error: "File must be under 15 MB." };
  }

  const admin = createAdminClient();
  const safeName = file.name.replace(/[^\w.\-]/g, "_");
  const path = `${session.agency.id}/${clientId}/${Date.now()}-${safeName}`;

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
    client_id: clientId,
    agency_id: session.agency.id,
    uploaded_by: session.teamMember.name,
    name: file.name,
    file_type: file.type || null,
    file_size: file.size,
    storage_path: path,
    category,
  });

  if (insertError) {
    // Roll back the orphaned storage object.
    await admin.storage.from(BUCKET).remove([path]);
    return { success: false, error: insertError.message };
  }

  await admin.from("activity_log").insert({
    agency_id: session.agency.id,
    client_id: clientId,
    actor_type: "staff",
    actor_id: session.userId,
    action: "Document uploaded",
    description: `Uploaded ${file.name}`,
  });

  revalidatePath(`/clients/${clientId}/documents`);
  return { success: true };
}

export async function deleteDocument(
  clientId: string,
  documentId: string
): Promise<DocActionResult> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  const supabase = await createServerSupabaseClient();
  // Fetch under RLS first — the storage path must come from the DB row, never
  // from client input, since the storage delete below runs with service role.
  const { data: doc, error: fetchError } = await supabase
    .from("documents")
    .select("id, storage_path")
    .eq("id", documentId)
    .single();
  if (fetchError || !doc) {
    return { success: false, error: "Document not found or access denied." };
  }

  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId);
  if (error) return { success: false, error: error.message };

  const admin = createAdminClient();
  await admin.storage.from(BUCKET).remove([doc.storage_path]);

  revalidatePath(`/clients/${clientId}/documents`);
  return { success: true };
}

/** Returns a short-lived signed URL for downloading a private document. */
export async function getDocumentUrl(
  storagePath: string
): Promise<{ url: string | null; error?: string }> {
  const session = await getSessionContext();
  if (!session) return { url: null, error: "Not authenticated." };

  // Scope check: the path is prefixed with the agency id.
  if (!storagePath.startsWith(`${session.agency.id}/`)) {
    return { url: null, error: "Not authorized for this file." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 60);

  if (error || !data) return { url: null, error: "Could not create link." };
  return { url: data.signedUrl };
}
