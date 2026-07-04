import { NextResponse, type NextRequest } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  exchangeCodeForTokens,
  parseOAuthState,
} from "@/lib/google-drive/auth";
import { ensureRootFolder } from "@/lib/google-drive/sync";

export const dynamic = "force-dynamic";

/** GET — Google OAuth callback. Exchanges the code and stores tokens. */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error");
  const state = parseOAuthState(searchParams.get("state"));
  const returnTo = state?.returnTo || "/settings/documents";

  if (oauthError || !code || !state) {
    return NextResponse.redirect(new URL(`${returnTo}?error=oauth`, request.url));
  }

  // The browser carries the staff session — verify it owns the target agency.
  const session = await getSessionContext();
  if (!session || session.agency.id !== state.agencyId) {
    return NextResponse.redirect(new URL(`${returnTo}?error=session`, request.url));
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    const admin = createAdminClient();
    await admin
      .from("agencies")
      .update({
        google_drive_enabled: true,
        google_drive_access_token: tokens.access_token,
        google_drive_refresh_token: tokens.refresh_token,
        google_drive_email: tokens.email,
        google_drive_connected_at: new Date().toISOString(),
        google_drive_root_folder_id: null,
      })
      .eq("id", session.agency.id);

    // Pre-create the root folder so the first document sync is fast.
    await ensureRootFolder({
      id: session.agency.id,
      google_drive_enabled: true,
      google_drive_refresh_token: tokens.refresh_token,
      google_drive_root_folder_id: null,
    });

    await admin.from("activity_log").insert({
      agency_id: session.agency.id,
      actor_type: "staff",
      actor_id: session.userId,
      action: "Google Drive connected",
      description: `Connected as ${tokens.email}.`,
    });

    return NextResponse.redirect(
      new URL(`${returnTo}?connected=true`, request.url)
    );
  } catch (err) {
    console.error("[Google Drive callback] Token exchange failed:", err);
    return NextResponse.redirect(new URL(`${returnTo}?error=exchange`, request.url));
  }
}
