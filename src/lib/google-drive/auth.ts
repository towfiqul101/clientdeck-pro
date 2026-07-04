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

export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  email: string;
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

  const userInfo = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    { headers: { Authorization: `Bearer ${tokens.access_token}` } }
  ).then((r) => r.json());

  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    email: userInfo.email ?? "",
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
