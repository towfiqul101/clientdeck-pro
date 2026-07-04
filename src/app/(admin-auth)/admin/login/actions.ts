"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminSessionToken, ADMIN_COOKIE } from "@/lib/admin/session";

/**
 * Password-only admin login. On success, sets the httpOnly cdp_admin_session
 * cookie and sends the operator to the admin dashboard. On failure, bounces
 * back to the login page with ?error=1 (redirect() throws, so it must stay
 * outside any try/catch).
 */
export async function adminLoginAction(formData: FormData): Promise<void> {
  const password = String(formData.get("password") || "");
  const expected = process.env.ADMIN_PASSWORD || "";

  if (!expected || password !== expected) {
    redirect("/admin/login?error=1");
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
