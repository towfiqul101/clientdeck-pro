/**
 * Shared allowlist for client/staff document uploads. Enforced server-side in
 * the upload server actions — the `<input accept>` attribute is only a UX hint,
 * never a control. Kept intentionally narrow: the file kinds a credit-repair
 * workflow actually needs (PDFs + phone photos of IDs, letters, and reports),
 * nothing executable.
 */

export const ALLOWED_UPLOAD_MIME_TYPES: string[] = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic", // iPhone photos
  "image/heif",
];

export const ALLOWED_UPLOAD_EXTENSIONS: string[] = [
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".heif",
];

/** For the `<input accept="...">` UX hint (and any future dropzone copy). */
export const UPLOAD_ACCEPT_ATTR = ALLOWED_UPLOAD_EXTENSIONS.join(",");

/** Human-readable list for error messages and hint text. */
export const UPLOAD_ACCEPT_LABEL = "PDF, JPG, PNG, WEBP, or HEIC";

/**
 * Returns a user-friendly error message when a file's type/extension isn't
 * allowed, or null when it passes. Requires an allowed extension, and — when
 * the browser reports a MIME type — that the type is on the allowlist too.
 * Some browsers report an empty type for HEIC/HEIF phone photos, so an empty
 * type falls back to the extension check rather than being rejected outright.
 */
export function validateUploadType(file: File): string | null {
  const ext = file.name.includes(".")
    ? "." + file.name.split(".").pop()!.toLowerCase()
    : "";

  if (!ALLOWED_UPLOAD_EXTENSIONS.includes(ext)) {
    return `File type not allowed. Please upload a ${UPLOAD_ACCEPT_LABEL} file.`;
  }
  if (file.type && !ALLOWED_UPLOAD_MIME_TYPES.includes(file.type)) {
    return `File type not allowed. Please upload a ${UPLOAD_ACCEPT_LABEL} file.`;
  }
  return null;
}
