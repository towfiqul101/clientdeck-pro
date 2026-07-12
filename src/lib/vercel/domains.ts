// ============================================
// Vercel Domains API wrapper
// Manages custom domains on the clientdeck-pro Vercel project for the
// Agency-plan "custom portal domain" feature. Plain fetch() — no SDK
// dependency (mirrors the shape of src/lib/ghl/api.ts).
// ============================================

const VERCEL_API = "https://api.vercel.com";

interface VercelEnv {
  token: string;
  projectId: string;
  teamId?: string;
}

function vercelEnv(): VercelEnv {
  const token = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!token || !projectId) {
    throw new Error(
      "VERCEL_TOKEN and VERCEL_PROJECT_ID must be set to manage custom domains."
    );
  }
  return { token, projectId, teamId: process.env.VERCEL_TEAM_ID };
}

function withTeam(path: string, env: VercelEnv): string {
  if (!env.teamId) return path;
  return `${path}${path.includes("?") ? "&" : "?"}teamId=${env.teamId}`;
}

async function vercelFetch(
  path: string,
  env: VercelEnv,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; body: any }> {
  try {
    const url = `${VERCEL_API}${withTeam(path, env)}`;
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${env.token}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
    const body = await response.json().catch(() => null);
    return { ok: response.ok, status: response.status, body };
  } catch {
    // Network-level failure (DNS, timeout, connection reset, etc.) — signal via status: 0
    return { ok: false, status: 0, body: null };
  }
}

export interface VerificationChallenge {
  type: string;
  domain: string;
  value: string;
  reason?: string;
}

export interface DomainStatus {
  verified: boolean;
  /** Set when the domain is already attached to a *different* Vercel project
   *  and needs a TXT ownership challenge instead of the standard CNAME flow. */
  ownershipChallenge: VerificationChallenge | null;
  /** Standard CNAME target to point the domain at (when no ownership
   *  challenge is required). Fetched live from Vercel's recommendations —
   *  never hardcoded, since it can vary per domain. */
  recommendedCname: string | null;
}

function extractOwnershipChallenge(
  verification: VerificationChallenge[] | undefined
): VerificationChallenge | null {
  return verification?.find((v) => v.type === "TXT") ?? null;
}

async function recommendedCname(
  domain: string,
  env: VercelEnv
): Promise<string | null> {
  const { ok, body } = await vercelFetch(`/v6/domains/${domain}/config`, env);
  if (!ok) return null;
  return body?.recommendedCNAME?.[0]?.value ?? null;
}

/** Adds a domain to the project. Non-throwing — callers get a discriminated result. */
export async function addDomainToProject(
  domain: string
): Promise<{ ok: true; status: DomainStatus } | { ok: false; error: string }> {
  const env = vercelEnv();
  const { ok, status, body } = await vercelFetch(
    `/v10/projects/${env.projectId}/domains`,
    env,
    { method: "POST", body: JSON.stringify({ name: domain }) }
  );

  if (!ok) {
    const message = body?.error?.message ?? `Vercel API error (${status}).`;
    return { ok: false, error: message };
  }

  const ownershipChallenge = extractOwnershipChallenge(body?.verification);
  return {
    ok: true,
    status: {
      verified: Boolean(body?.verified),
      ownershipChallenge,
      recommendedCname: ownershipChallenge
        ? null
        : await recommendedCname(domain, env),
    },
  };
}

/** Fetches current verification/config state live — never persisted to the DB. */
export async function getDomainVerification(
  domain: string
): Promise<DomainStatus> {
  const env = vercelEnv();
  const { ok, body } = await vercelFetch(
    `/v9/projects/${env.projectId}/domains/${domain}`,
    env
  );
  if (!ok) {
    return { verified: false, ownershipChallenge: null, recommendedCname: null };
  }
  const ownershipChallenge = extractOwnershipChallenge(body?.verification);
  return {
    verified: Boolean(body?.verified),
    ownershipChallenge,
    recommendedCname: ownershipChallenge
      ? null
      : await recommendedCname(domain, env),
  };
}

/** Triggers Vercel's verification check for a domain with verified = false. */
export async function verifyDomain(
  domain: string
): Promise<{ verified: boolean }> {
  const env = vercelEnv();
  const { ok, body } = await vercelFetch(
    `/v9/projects/${env.projectId}/domains/${domain}/verify`,
    env,
    { method: "POST" }
  );
  return { verified: ok && Boolean(body?.verified) };
}

/** Removes a domain from the project. Treats "already gone" (404) as success. */
export async function removeDomainFromProject(
  domain: string
): Promise<{ ok: boolean; error?: string }> {
  const env = vercelEnv();
  const { ok, status, body } = await vercelFetch(
    `/v9/projects/${env.projectId}/domains/${domain}`,
    env,
    { method: "DELETE" }
  );
  if (ok || status === 404) return { ok: true };
  return { ok: false, error: body?.error?.message ?? `Vercel API error (${status}).` };
}
