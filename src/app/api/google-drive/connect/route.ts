import { NextResponse, type NextRequest } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { getOAuthUrl, isGoogleConfigured } from "@/lib/google-drive/auth";

export const dynamic = "force-dynamic";

/** GET — kicks off the Google OAuth flow for the signed-in agency. */
export async function GET(request: NextRequest) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!isGoogleConfigured()) {
    return NextResponse.redirect(
      new URL("/settings/documents?error=not_configured", request.url)
    );
  }

  const authUrl = getOAuthUrl(session.agency.id, "/settings/documents");
  return NextResponse.redirect(authUrl);
}
