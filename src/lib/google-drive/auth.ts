// ============================================
// Google Drive OAuth2 — each agency connects their own Drive.
// Mirrors the TaxIntake Pro pattern.
// ============================================

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_SCOPES = [
  // Create/modify only files the app creates — least privilege.
  "https://www.googleapis.com/auth/drive.file",
  // Read the connected account's email for display.
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

function redirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "";
  return `${base}/api/google-drive/callback`;
}

export function getOAuthUrl(agencyId: string, returnTo?: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: GOOGLE_SCOPES,
    access_type: "offline",
    prompt: "consent", // always return a refresh token
    state: JSON.stringify({
      agencyId,
      returnTo: returnTo || "/settings/documents",
    }),
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export interface OAuthState {
  agencyId: string;
  returnTo: string;
}

export function parseOAuthState(raw: string | null): OAuthState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.agencyId !== "string") return null;
    return {
      agencyId: parsed.agencyId,
      returnTo:
        typeof parsed.returnTo === "string" ? parsed.returnTo : "/settings/documents",
    };
  } catch {
    return null;
  }
}

/** The scope that actually lets us create/upload anything. */
export const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";

/**
 * Thrown when Google returns a token that lacks Drive access.
 *
 * Google's consent screen shows Drive as an OPTIONAL checkbox — if the user
 * doesn't tick it (or `drive.file` isn't registered on the Cloud Console
 * consent screen), OAuth still SUCCEEDS and returns a perfectly valid token
 * that can read the account email and nothing else. That is exactly what
 * happened to the first live agency: Drive showed as "Connected" while every
 * Drive call 403'd with ACCESS_TOKEN_SCOPE_INSUFFICIENT, the error was
 * swallowed as non-blocking, and no folder or document ever synced.
 */
export class MissingDriveScopeError extends Error {
  constructor(readonly grantedScopes: string[]) {
    super("Google did not grant the Drive permission (drive.file).");
    this.name = "MissingDriveScopeError";
  }
}

export function hasDriveScope(scopes: string[]): boolean {
  return scopes.includes(DRIVE_FILE_SCOPE);
}

export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  email: string;
  scopes: string[];
}> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });
  const tokens = await response.json();
  if (!tokens.access_token) throw new Error("Failed to get access token");
  if (!tokens.refresh_token) {
    throw new Error("No refresh token returned — re-consent required.");
  }

  // Google reports what it ACTUALLY granted, which is not necessarily what we
  // asked for. Reject a token that can't touch Drive rather than storing it and
  // discovering the problem later as a swallowed 403.
  const scopes: string[] = (tokens.scope ?? "").split(" ").filter(Boolean);
  if (!hasDriveScope(scopes)) {
    throw new MissingDriveScopeError(scopes);
  }

  const userInfo = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    { headers: { Authorization: `Bearer ${tokens.access_token}` } }
  ).then((r) => r.json());

  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    email: userInfo.email ?? "",
    scopes,
  };
}

export async function getAccessToken(refreshToken: string): Promise<string> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      grant_type: "refresh_token",
    }),
  });
  const tokens = await response.json();
  if (!tokens.access_token) throw new Error("Failed to refresh access token");
  return tokens.access_token;
}

/** True when the Google OAuth app credentials are configured on the server. */
export function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}
