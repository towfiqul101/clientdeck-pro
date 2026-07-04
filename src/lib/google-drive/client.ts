// ============================================
// Google Drive API v3 wrapper (folders + multipart upload).
// ============================================

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3";

/** Escapes a value for use inside a Drive `q` search string. */
function escapeQuery(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/**
 * Returns the id of a folder with `folderName` under `parentId` (or root),
 * creating it if it does not already exist. Idempotent.
 */
export async function getOrCreateFolder(
  accessToken: string,
  parentId: string | null,
  folderName: string
): Promise<string> {
  const query = [
    `name='${escapeQuery(folderName)}'`,
    `mimeType='application/vnd.google-apps.folder'`,
    parentId ? `'${escapeQuery(parentId)}' in parents` : `'root' in parents`,
    `trashed=false`,
  ].join(" and ");

  const searchRes = await fetch(
    `${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  ).then((r) => r.json());

  if (searchRes.files?.length > 0) {
    return searchRes.files[0].id as string;
  }

  const createRes = await fetch(`${DRIVE_API}/files?fields=id`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : [],
    }),
  }).then((r) => r.json());

  if (!createRes.id) {
    throw new Error(
      `Drive folder create failed: ${JSON.stringify(createRes).slice(0, 200)}`
    );
  }
  return createRes.id as string;
}

/** Multipart upload of a file into `folderId`. Returns the new file id. */
export async function uploadFileToDrive(
  accessToken: string,
  folderId: string,
  fileName: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<string> {
  const metadata = JSON.stringify({ name: fileName, parents: [folderId] });
  const boundary = "-------314159265358979323846";

  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`
    ),
    fileBuffer,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const res = await fetch(
    `${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id,webViewLink`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary="${boundary}"`,
        "Content-Length": body.length.toString(),
      },
      body: new Uint8Array(body),
    }
  ).then((r) => r.json());

  if (!res.id) {
    throw new Error(
      `Drive upload failed: ${JSON.stringify(res).slice(0, 200)}`
    );
  }
  return res.id as string;
}

/** `{docType} - {sanitized client name}.{ext}` */
export function buildFileName(
  docType: string,
  clientName: string,
  extension = "pdf"
): string {
  const sanitized = clientName.replace(/[^a-zA-Z0-9\s-]/g, "").trim();
  return `${docType} - ${sanitized}.${extension}`;
}
