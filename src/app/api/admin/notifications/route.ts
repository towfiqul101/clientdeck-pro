import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/tool-helpers";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const LIST_LIMIT = 20;

/** Super-admin notification feed for the /admin header bell (migration 036). */
export async function GET() {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;

  const admin = createAdminClient();

  const [{ data: notifications }, { count: unreadCount }] = await Promise.all([
    admin
      .from("admin_notifications")
      .select("id, type, agency_id, title, body, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(LIST_LIMIT),
    admin
      .from("admin_notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null),
  ]);

  return NextResponse.json({
    ok: true,
    notifications: notifications ?? [],
    unreadCount: unreadCount ?? 0,
  });
}
