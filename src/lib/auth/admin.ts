import { redirect } from "next/navigation";
import {
  validateAdminSession,
  ADMIN_ACTOR,
} from "@/lib/admin/session";

/**
 * Super-admin access is granted by the standalone password/cookie session
 * (see @/lib/admin/session) — NOT by Supabase Auth. These thin wrappers keep
 * the historical call sites (admin layout, server actions) working while the
 * actual check lives in one place.
 */

/** For server actions: boolean guard (no redirect). */
export async function isAdmin(): Promise<boolean> {
  return validateAdminSession();
}

/** For pages/layouts: redirect non-admins to the admin login. Returns a label. */
export async function requireAdmin(): Promise<string> {
  if (!(await isAdmin())) redirect("/admin/login");
  return process.env.ADMIN_EMAIL || ADMIN_ACTOR;
}

/**
 * Actor label recorded on admin-initiated writes (activity_log.actor_id,
 * manual_payments.recorded_by). Uses ADMIN_EMAIL when configured for a nicer
 * audit trail, otherwise the generic "super-admin".
 */
export async function getAdminEmail(): Promise<string> {
  return process.env.ADMIN_EMAIL || ADMIN_ACTOR;
}
