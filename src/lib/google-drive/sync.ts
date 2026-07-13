// ============================================
// Google Drive sync entry point — ALWAYS non-blocking.
// A Drive failure must never break the main operation.
//
// Folder layout:  RoundTrack Pro / {Client Name} / {Sub Folder} / {file}
// ============================================

import { getAccessToken } from "./auth";
import { getOrCreateFolder, uploadFileToDrive } from "./client";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Agency } from "@/types";

/** Minimal shape needed for Drive sync — accepts a full Agency or a subset. */
export type DriveAgency = Pick<
  Agency,
  | "id"
  | "google_drive_enabled"
  | "google_drive_refresh_token"
  | "google_drive_root_folder_id"
>;

export interface DriveSyncParams {
  clientName: string;
  subFolder: string; // 'Onboarding' | 'Round_1' | 'Bureau_Responses' | 'Client_Uploads' | ...
  fileName: string;
  fileBuffer: Buffer;
  mimeType: string;
}

function driveConnected(agency: DriveAgency): boolean {
  return Boolean(agency.google_drive_enabled && agency.google_drive_refresh_token);
}

/**
 * Uploads one document into the agency's Drive under the client/sub-folder.
 * Returns the Drive file id, or null when Drive isn't connected or the sync
 * failed (failures are swallowed and logged — never thrown).
 */
export async function syncDocumentToDrive(
  agency: DriveAgency,
  params: DriveSyncParams
): Promise<string | null> {
  if (!driveConnected(agency)) return null;

  try {
    const accessToken = await getAccessToken(agency.google_drive_refresh_token!);

    const rootFolderId =
      agency.google_drive_root_folder_id ||
      (await getOrCreateFolder(accessToken, null, "RoundTrack Pro"));

    const clientFolderId = await getOrCreateFolder(
      accessToken,
      rootFolderId,
      params.clientName
    );
    const subFolderId = await getOrCreateFolder(
      accessToken,
      clientFolderId,
      params.subFolder
    );

    return await uploadFileToDrive(
      accessToken,
      subFolderId,
      params.fileName,
      params.fileBuffer,
      params.mimeType
    );
  } catch (err) {
    console.error("[Google Drive] Sync failed (non-blocking):", err);
    return null;
  }
}

/**
 * Creates (or finds) the "RoundTrack Pro" root folder and THROWS on failure.
 *
 * Used by the OAuth callback as a live proof that the granted token can
 * actually write to Drive, before the connection is recorded. `ensureRootFolder`
 * below deliberately swallows errors (it runs inside non-blocking sync paths),
 * which is what let a broken connection sit there looking healthy — so connect
 * needs a version that fails loudly.
 */
export async function createRootFolderOrThrow(refreshToken: string): Promise<string> {
  const accessToken = await getAccessToken(refreshToken);
  return getOrCreateFolder(accessToken, null, "RoundTrack Pro");
}

/**
 * Ensures the "RoundTrack Pro" root folder exists and is cached on the agency
 * row so later syncs skip the lookup. Returns the folder id or null.
 */
export async function ensureRootFolder(agency: DriveAgency): Promise<string | null> {
  if (!driveConnected(agency)) return null;
  if (agency.google_drive_root_folder_id) return agency.google_drive_root_folder_id;

  try {
    const accessToken = await getAccessToken(agency.google_drive_refresh_token!);
    const folderId = await getOrCreateFolder(accessToken, null, "RoundTrack Pro");

    const supabase = createAdminClient();
    await supabase
      .from("agencies")
      .update({ google_drive_root_folder_id: folderId })
      .eq("id", agency.id);

    return folderId;
  } catch (err) {
    console.error("[Google Drive] Failed to create root folder:", err);
    return null;
  }
}
