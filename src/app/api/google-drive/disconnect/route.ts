import { NextResponse, type NextRequest } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** POST — clears all Google Drive tokens/state for the signed-in agency. */
export async function POST(request: NextRequest) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  }

  const admin = createAdminClient();
  await admin
    .from("agencies")
    .update({
      google_drive_enabled: false,
      google_drive_access_token: null,
      google_drive_refresh_token: null,
      google_drive_root_folder_id: null,
      google_drive_connected_at: null,
      google_drive_email: null,
    })
    .eq("id", session.agency.id);

  await admin.from("activity_log").insert({
    agency_id: session.agency.id,
    actor_type: "staff",
    actor_id: session.userId,
    action: "Google Drive disconnected",
    description: "Drive tokens cleared by staff.",
  });

  // 303 so the browser issues a GET to the settings page after this POST.
  return NextResponse.redirect(new URL("/settings/documents", request.url), {
    status: 303,
  });
}
