import { NextResponse, type NextRequest } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  exchangeCodeForTokens,
  parseOAuthState,
  MissingDriveScopeError,
} from "@/lib/google-drive/auth";
import { createRootFolderOrThrow } from "@/lib/google-drive/sync";

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
    // 1. Exchange. Throws MissingDriveScopeError if Google granted a token
    //    without drive.file — the consent screen makes Drive an OPTIONAL
    //    checkbox, so OAuth "succeeds" with a token that can't touch Drive.
    const tokens = await exchangeCodeForTokens(code);

    // 2. Prove the token actually works BEFORE recording the connection.
    //    Nothing is written until Drive has really let us create the folder,
    //    so "Connected" can never again mean "connected but 403s on every
    //    call". Throws on failure.
    const rootFolderId = await createRootFolderOrThrow(tokens.refresh_token);

    // 3. Only now persist — with the verified root folder id already cached.
    const admin = createAdminClient();
    await admin
      .from("agencies")
      .update({
        google_drive_enabled: true,
        google_drive_access_token: tokens.access_token,
        google_drive_refresh_token: tokens.refresh_token,
        google_drive_email: tokens.email,
        google_drive_connected_at: new Date().toISOString(),
        google_drive_root_folder_id: rootFolderId,
      })
      .eq("id", session.agency.id);

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
    if (err instanceof MissingDriveScopeError) {
      console.error(
        "[Google Drive callback] Drive permission not granted. Scopes returned:",
        err.grantedScopes
      );
      // Deliberately leaves the agency's Drive state untouched — a rejected
      // connect must not half-enable anything.
      return NextResponse.redirect(
        new URL(`${returnTo}?error=drive_scope`, request.url)
      );
    }
    console.error("[Google Drive callback] Connect failed:", err);
    return NextResponse.redirect(new URL(`${returnTo}?error=exchange`, request.url));
  }
}
