import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Super-admin access is granted purely on the authenticated Supabase user's
 * email matching ADMIN_EMAIL — independent of whether the user also owns an
 * agency. Used by the /admin route group (layout, pages, and server actions).
 */
export async function getAdminEmail(): Promise<string | null> {
  const configured = process.env.ADMIN_EMAIL?.toLowerCase();
  if (!configured) return null;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = user?.email?.toLowerCase() ?? null;
  return email && email === configured ? email : null;
}

/** For pages/layouts: redirect non-admins to /login. Returns the admin email. */
export async function requireAdmin(): Promise<string> {
  const email = await getAdminEmail();
  if (!email) redirect("/login");
  return email;
}

/** For server actions: boolean guard (no redirect). */
export async function isAdmin(): Promise<boolean> {
  return (await getAdminEmail()) !== null;
}
