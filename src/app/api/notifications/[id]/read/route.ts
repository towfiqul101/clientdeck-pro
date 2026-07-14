import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }

  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase
    .from("staff_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("team_member_id", session.teamMember.id);

  if (error) {
    console.error("[notifications/read] update failed:", error);
    return NextResponse.json({ ok: false, error: "Could not mark as read." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
