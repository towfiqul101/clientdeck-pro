import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash } from "crypto";

/**
 * Super-admin auth for the /admin panel.
 *
 * This is deliberately SEPARATE from Supabase Auth (which gates the agency app
 * and the client portal). Access is granted by a single shared password
 * (ADMIN_PASSWORD) — matching TaxIntake Pro's pattern — and persisted in an
 * httpOnly cookie whose value is a deterministic hash of the password. No
 * database lookup, no dependency on which agency user (if any) is signed in.
 */

export const ADMIN_COOKIE = "cdp_admin_session";

/** Label written to activity_log / recorded_by for admin-initiated writes. */
export const ADMIN_ACTOR = "super-admin";

/** The value we store in the cookie: sha256("cdp-admin-<password>"). */
export function getAdminSessionToken(): string {
  const password = process.env.ADMIN_PASSWORD || "";
  return createHash("sha256").update(`cdp-admin-${password}`).digest("hex");
}

/**
 * True when the request carries a valid admin session cookie. If ADMIN_PASSWORD
 * is not configured the panel is locked shut (no cookie can ever match).
 */
export async function validateAdminSession(): Promise<boolean> {
  if (!process.env.ADMIN_PASSWORD) return false;
  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_COOKIE);
  if (!session) return false;
  return session.value === getAdminSessionToken();
}

/** For pages/layouts: redirect to the admin login when not authenticated. */
export async function requireAdminSession(): Promise<void> {
  if (!(await validateAdminSession())) redirect("/admin/login");
}
