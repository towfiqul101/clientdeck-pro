"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminSessionToken, ADMIN_COOKIE } from "@/lib/admin/session";
import { verifyTotp } from "@/lib/admin/totp";

/**
 * Admin login: password, plus a TOTP code when ADMIN_TOTP_SECRET is set
 * (fully separate from Supabase Auth's MFA — there is no Supabase user
 * here). On success, sets the httpOnly rtp_admin_session cookie and sends
 * the operator to the admin dashboard. On failure, bounces back with
 * ?error=1 (bad password) or ?error=2fa (bad/missing code) — redirect()
 * throws, so it must stay outside any try/catch.
 */
export async function adminLoginAction(formData: FormData): Promise<void> {
  const password = String(formData.get("password") || "");
  const expected = process.env.ADMIN_PASSWORD || "";

  if (!expected || password !== expected) {
    redirect("/admin/login?error=1");
  }

  // Second factor — fails closed when configured: a set secret with a
  // missing/invalid code always rejects.
  const totpSecret = process.env.ADMIN_TOTP_SECRET;
  if (totpSecret) {
    const code = String(formData.get("totp") || "");
    if (!verifyTotp(totpSecret, code)) {
      redirect("/admin/login?error=2fa");
    }
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, getAdminSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  redirect("/admin");
}
