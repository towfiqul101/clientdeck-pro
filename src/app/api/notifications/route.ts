import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const LIST_LIMIT = 20;

export async function GET() {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }

  const supabase = await createServerSupabaseClient();

  const [{ data: notifications }, { count: unreadCount }] = await Promise.all([
    supabase
      .from("staff_notifications")
      .select("id, type, message, link, read_at, created_at")
      .eq("team_member_id", session.teamMember.id)
      .order("created_at", { ascending: false })
      .limit(LIST_LIMIT),
    supabase
      .from("staff_notifications")
      .select("id", { count: "exact", head: true })
      .eq("team_member_id", session.teamMember.id)
      .is("read_at", null),
  ]);

  return NextResponse.json({
    ok: true,
    notifications: notifications ?? [],
    unreadCount: unreadCount ?? 0,
  });
}
