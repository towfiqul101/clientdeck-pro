# Agency Custom Portal Domain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an Agency-plan agency connect their own domain (e.g. `portal.theiragency.com`) so their clients see that domain instead of `roundtrackpro.com/portal`, backed by Vercel's Domains API.

**Architecture:** A new `src/lib/vercel/domains.ts` fetch wrapper talks to Vercel's REST API to add/verify/remove a domain on the `clientdeck-pro` Vercel project. A gated Settings → Domain page lets an agency connect a domain and walks them through DNS verification. Once `agencies.custom_domain_verified` is true, `generatePortalLink()` builds magic links on that domain instead of the default app URL, and a thin middleware guard confirms any non-default Host hitting `/portal` maps to a verified agency before letting the existing (unmodified) token/cookie flow run.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres + RLS), plain `fetch()` against `api.vercel.com` (no new dependency — `@vercel/sdk` was considered and rejected to avoid an unapproved package install).

## Global Constraints

- **Portal-only scope.** Never touch staff-auth/dashboard/admin routing. Only `/portal/*` is affected.
- **URL shape unchanged.** Custom domains serve the exact same `/portal`, `/portal/dashboard`, etc. tree — no rewrites, no new route files.
- **No new dependencies.** Use `fetch()` directly; do not add `@vercel/sdk` or any other package.
- **DNS instructions are never persisted.** Always fetch live from Vercel (`getDomainVerification`) when the Settings page renders an unverified domain.
- **No automated test framework exists in this repo** (confirmed: no jest/vitest, no `*.test.ts` files anywhere). Every task's "test" step therefore uses this repo's actual verification tools — `npx tsc --noEmit` for type correctness and `npm run build` for full build correctness — not a fabricated unit-test suite. Task 8 additionally does a real, live Vercel API call.
- Follow existing code style: `"use server"` actions return `{ success: boolean; error?: string }` (the `ActionResult` type already exported from `src/app/(dashboard)/settings/actions.ts`); client components use `useToast()` for feedback and `window.confirm()` for destructive-action confirmation (see `src/app/(dashboard)/templates/templates-list.tsx:48`).

---

### Task 1: Migration + Agency type

**Files:**
- Create: `supabase/migrations/026_custom_domain.sql`
- Modify: `src/types/index.ts:65` (Agency interface)

**Interfaces:**
- Produces: `agencies.custom_domain_verified` column (boolean, default false), a unique partial index on `agencies.custom_domain`, and `Agency.custom_domain_verified: boolean` in the TS type — every later task depends on this column existing.

- [ ] **Step 1: Write the migration**

```sql
-- Adds the missing half of the "custom portal domain" feature. custom_domain
-- itself already exists (migration 001) but has never been used — it's a
-- bare TEXT column with no verification-status tracking and no uniqueness
-- guarantee. This migration adds both.

ALTER TABLE agencies
  ADD COLUMN custom_domain_verified BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX idx_agencies_custom_domain
  ON agencies (custom_domain)
  WHERE custom_domain IS NOT NULL;
```

Save this to `supabase/migrations/026_custom_domain.sql`.

- [ ] **Step 2: Update the Agency type**

In `src/types/index.ts`, find this line (around line 65):

```typescript
  custom_domain: string | null;
```

Change it to:

```typescript
  custom_domain: string | null;
  custom_domain_verified: boolean;
```

- [ ] **Step 3: Apply the migration and verify**

Run the SQL in `supabase/migrations/026_custom_domain.sql` against the project's Supabase instance via the Supabase SQL editor (this repo's migrations are applied manually — there is no migration runner). Then confirm:

```sql
select column_name, data_type, column_default
from information_schema.columns
where table_name = 'agencies' and column_name = 'custom_domain_verified';
```

Expected: one row, `data_type = boolean`, `column_default = false`.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors related to `Agency` or `custom_domain_verified`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/026_custom_domain.sql src/types/index.ts
git commit -m "feat: add custom_domain_verified column + Agency type field"
```

---

### Task 2: Vercel Domains API wrapper

**Files:**
- Create: `src/lib/vercel/domains.ts`

**Interfaces:**
- Consumes: `process.env.VERCEL_TOKEN`, `process.env.VERCEL_PROJECT_ID`, `process.env.VERCEL_TEAM_ID`.
- Produces (all consumed by Task 5's server actions and Task 6's page):
  - `interface VerificationChallenge { type: string; domain: string; value: string; reason?: string }`
  - `interface DomainStatus { verified: boolean; ownershipChallenge: VerificationChallenge | null; recommendedCname: string | null }`
  - `addDomainToProject(domain: string): Promise<{ ok: true; status: DomainStatus } | { ok: false; error: string }>`
  - `getDomainVerification(domain: string): Promise<DomainStatus>`
  - `verifyDomain(domain: string): Promise<{ verified: boolean }>`
  - `removeDomainFromProject(domain: string): Promise<{ ok: boolean; error?: string }>`

- [ ] **Step 1: Write the wrapper**

Create `src/lib/vercel/domains.ts`:

```typescript
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

  const ownershipChallenge = extractOwnershipChallenge(body.verification);
  return {
    ok: true,
    status: {
      verified: Boolean(body.verified),
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
  const ownershipChallenge = extractOwnershipChallenge(body.verification);
  return {
    verified: Boolean(body.verified),
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
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in `src/lib/vercel/domains.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/vercel/domains.ts
git commit -m "feat: add Vercel Domains API wrapper"
```

---

### Task 3: Document the new env vars

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add the Vercel section**

In `.env.example`, after the Web Push section at the end of the file, add:

```
# ============================================
# Vercel Domains API (Agency-plan custom portal domain)
# ============================================
VERCEL_TOKEN=                       # Vercel API token with domain-management access on the team (vercel.com → Settings → Tokens)
VERCEL_PROJECT_ID=prj_1xP9e4FtX9RTg3Hun0E9chcRrvFX  # This project (clientdeck-pro)
VERCEL_TEAM_ID=team_mDOpQbtGfJpBuYcNc3GNkX3g        # Required — the project is team-owned
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: document Vercel Domains API env vars"
```

---

### Task 4: Custom-domain-aware magic links

**Files:**
- Modify: `src/lib/utils/portal-token.ts`

**Interfaces:**
- Consumes: `agencies.custom_domain` / `custom_domain_verified` (Task 1).
- Produces: `generatePortalLink()`'s existing signature is unchanged — callers need no changes.

- [ ] **Step 1: Update `generatePortalLink`**

In `src/lib/utils/portal-token.ts`, replace the function body:

```typescript
export async function generatePortalLink(
  clientId: string,
  agencyId: string
): Promise<string> {
  const supabase = createAdminClient();
  const token = randomUUID().replace(/-/g, "");
  const expires = new Date(
    Date.now() + PORTAL_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: agency } = await supabase
    .from("agencies")
    .select("custom_domain, custom_domain_verified")
    .eq("id", agencyId)
    .maybeSingle();

  const { error } = await supabase
    .from("clients")
    .update({ portal_token: token, portal_token_expires_at: expires })
    .eq("id", clientId)
    .eq("agency_id", agencyId);

  if (error) throw new Error(`Could not generate portal link: ${error.message}`);

  const base =
    agency?.custom_domain && agency.custom_domain_verified
      ? `https://${agency.custom_domain}`
      : appUrl();

  return `${base}/portal?token=${token}`;
}
```

This is the only change to the file — `appUrl()`, `validatePortalToken()`, and everything else stay as-is.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in `src/lib/utils/portal-token.ts`.

- [ ] **Step 3: Manual verification**

Run: `npm run build`
Expected: build succeeds (this function is used by both the onboarding webhook and the client detail "regenerate portal link" action — a build failure here would show up as a type error in one of those callers).

- [ ] **Step 4: Commit**

```bash
git add src/lib/utils/portal-token.ts
git commit -m "feat: use agency's verified custom domain for portal magic links"
```

---

### Task 5: Server actions (connect / verify / remove)

**Files:**
- Modify: `src/app/(dashboard)/settings/actions.ts`

**Interfaces:**
- Consumes: `addDomainToProject`, `getDomainVerification` (unused directly here, but re-exported types), `verifyDomain`, `removeDomainFromProject`, `VerificationChallenge` from `@/lib/vercel/domains` (Task 2); `isAgencyPlanOrHigher` from `@/lib/billing/plans` (already imported elsewhere in the codebase); `createAdminClient` from `@/lib/supabase/admin`.
- Produces (consumed by Task 6's form component):
  - `interface ConnectDomainResult { success: boolean; error?: string; ownershipChallenge?: VerificationChallenge | null; recommendedCname?: string | null }`
  - `connectDomain(domainInput: string): Promise<ConnectDomainResult>`
  - `checkDomainVerification(): Promise<{ verified: boolean }>`
  - `removeDomain(): Promise<ActionResult>` (reuses the file's existing `ActionResult` type)

- [ ] **Step 1: Add imports**

At the top of `src/app/(dashboard)/settings/actions.ts`, add to the existing import block:

```typescript
import { createAdminClient } from "@/lib/supabase/admin";
import { isAgencyPlanOrHigher } from "@/lib/billing/plans";
import {
  addDomainToProject,
  verifyDomain,
  removeDomainFromProject,
  type VerificationChallenge,
} from "@/lib/vercel/domains";
```

- [ ] **Step 2: Add the three actions**

Append to the end of `src/app/(dashboard)/settings/actions.ts`:

```typescript
const DOMAIN_REGEX = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/i;

export interface ConnectDomainResult {
  success: boolean;
  error?: string;
  ownershipChallenge?: VerificationChallenge | null;
  recommendedCname?: string | null;
}

/** Connects a new custom domain: validates format, checks it isn't already
 *  claimed by another agency, adds it to the Vercel project, and stores it
 *  unverified pending DNS verification. */
export async function connectDomain(domainInput: string): Promise<ConnectDomainResult> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  if (!isAgencyPlanOrHigher(session.agency.plan)) {
    return { success: false, error: "Custom domains are available on the Agency plan." };
  }

  const domain = domainInput.trim().toLowerCase();
  if (!DOMAIN_REGEX.test(domain)) {
    return { success: false, error: "Enter a valid domain, e.g. portal.youragency.com." };
  }

  // RLS scopes agencies to the caller's own row, so a cross-tenant
  // uniqueness check needs the admin client. The unique index from the
  // migration is the real backstop against a race between two agencies.
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("agencies")
    .select("id")
    .eq("custom_domain", domain)
    .neq("id", session.agency.id)
    .maybeSingle();
  if (existing) {
    return { success: false, error: "That domain is already connected to another agency." };
  }

  const result = await addDomainToProject(domain);
  if (!result.ok) {
    return { success: false, error: result.error };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("agencies")
    .update({ custom_domain: domain, custom_domain_verified: false })
    .eq("id", session.agency.id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/settings/domain");
  return {
    success: true,
    ownershipChallenge: result.status.ownershipChallenge,
    recommendedCname: result.status.recommendedCname,
  };
}

/** Triggers Vercel's verification check for the agency's connected domain and
 *  flips custom_domain_verified on success. */
export async function checkDomainVerification(): Promise<{ verified: boolean }> {
  const session = await getSessionContext();
  if (!session) return { verified: false };

  const domain = session.agency.custom_domain;
  if (!domain) return { verified: false };

  const result = await verifyDomain(domain);
  if (result.verified) {
    const supabase = await createServerSupabaseClient();
    await supabase
      .from("agencies")
      .update({ custom_domain_verified: true })
      .eq("id", session.agency.id);
    revalidatePath("/settings/domain");
  }
  return result;
}

/** Removes the agency's custom domain from Vercel and clears the DB fields. */
export async function removeDomain(): Promise<ActionResult> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  const domain = session.agency.custom_domain;
  if (!domain) return { success: false, error: "No domain connected." };

  const result = await removeDomainFromProject(domain);
  if (!result.ok) return { success: false, error: result.error };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("agencies")
    .update({ custom_domain: null, custom_domain_verified: false })
    .eq("id", session.agency.id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/settings/domain");
  return { success: true };
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in `src/app/(dashboard)/settings/actions.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/settings/actions.ts
git commit -m "feat: add connectDomain/checkDomainVerification/removeDomain actions"
```

---

### Task 6: Settings → Domain page

**Files:**
- Create: `src/app/(dashboard)/settings/domain/page.tsx`
- Create: `src/app/(dashboard)/settings/domain/domain-form.tsx`
- Modify: `src/app/(dashboard)/settings/settings-nav.tsx`

**Interfaces:**
- Consumes: `connectDomain`, `checkDomainVerification`, `removeDomain` (Task 5); `getDomainVerification` (Task 2); `isAgencyPlanOrHigher` (existing); `getSessionContext` (existing).

- [ ] **Step 1: Write the page**

Create `src/app/(dashboard)/settings/domain/page.tsx`:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { getSessionContext } from "@/lib/auth/session";
import { isAgencyPlanOrHigher } from "@/lib/billing/plans";
import { Card } from "@/components/ui/card";
import { getDomainVerification } from "@/lib/vercel/domains";
import { DomainForm } from "./domain-form";

export default async function DomainSettingsPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");

  const { agency } = session;

  if (!isAgencyPlanOrHigher(agency.plan)) {
    return (
      <Card className="p-8 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.06]">
          <Lock className="h-6 w-6 text-slate-500" />
        </span>
        <h2 className="mt-4 text-sm font-semibold text-slate-100">
          Custom Portal Domain — Available on Agency plan
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
          White-label your client portal on your own domain instead of
          roundtrackpro.com.
        </p>
        <Link
          href="/settings/billing"
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Upgrade to Agency Plan →
        </Link>
      </Card>
    );
  }

  let status: Awaited<ReturnType<typeof getDomainVerification>> | null = null;
  if (agency.custom_domain && !agency.custom_domain_verified) {
    try {
      status = await getDomainVerification(agency.custom_domain);
    } catch {
      status = null;
    }
  }

  return (
    <DomainForm
      initial={{
        domain: agency.custom_domain,
        verified: agency.custom_domain_verified,
        ownershipChallenge: status?.ownershipChallenge ?? null,
        recommendedCname: status?.recommendedCname ?? null,
      }}
    />
  );
}
```

- [ ] **Step 2: Write the form component**

Create `src/app/(dashboard)/settings/domain/domain-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { connectDomain, checkDomainVerification, removeDomain } from "../actions";
import type { VerificationChallenge } from "@/lib/vercel/domains";

interface DomainFormProps {
  initial: {
    domain: string | null;
    verified: boolean;
    ownershipChallenge: VerificationChallenge | null;
    recommendedCname: string | null;
  };
}

export function DomainForm({ initial }: DomainFormProps) {
  const { toast } = useToast();
  const [domain, setDomain] = useState(initial.domain ?? "");
  const [input, setInput] = useState("");
  const [verified, setVerified] = useState(initial.verified);
  const [ownershipChallenge, setOwnershipChallenge] = useState(initial.ownershipChallenge);
  const [recommendedCname, setRecommendedCname] = useState(initial.recommendedCname);
  const [connecting, setConnecting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function handleConnect() {
    if (!input.trim()) return;
    setConnecting(true);
    const result = await connectDomain(input.trim());
    setConnecting(false);
    if (!result.success) {
      toast(result.error ?? "Could not connect domain.", "error");
      return;
    }
    setDomain(input.trim().toLowerCase());
    setInput("");
    setVerified(false);
    setOwnershipChallenge(result.ownershipChallenge ?? null);
    setRecommendedCname(result.recommendedCname ?? null);
    toast("Domain connected — complete DNS verification below.", "success");
  }

  async function handleVerify() {
    setVerifying(true);
    const result = await checkDomainVerification();
    setVerifying(false);
    if (result.verified) {
      setVerified(true);
      toast("Domain verified! Portal links will now use this domain.", "success");
    } else {
      toast("Not verified yet — DNS changes can take a few minutes to propagate.", "error");
    }
  }

  async function handleRemove() {
    if (!window.confirm(`Remove ${domain}? Portal links will go back to using the default domain.`)) {
      return;
    }
    setRemoving(true);
    const result = await removeDomain();
    setRemoving(false);
    if (!result.success) {
      toast(result.error ?? "Could not remove domain.", "error");
      return;
    }
    setDomain("");
    setVerified(false);
    setOwnershipChallenge(null);
    setRecommendedCname(null);
    toast("Domain removed.", "success");
  }

  return (
    <Card>
      <CardHeader
        title="Custom Portal Domain"
        description="White-label your client portal on your own domain (e.g. portal.youragency.com) instead of roundtrackpro.com."
      />
      <div className="space-y-5 p-6">
        {!domain && (
          <>
            <Field label="Domain" htmlFor="domain">
              <Input
                id="domain"
                placeholder="portal.youragency.com"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="font-mono text-xs"
              />
            </Field>
            <div className="flex justify-end">
              <Button onClick={handleConnect} loading={connecting}>
                Connect
              </Button>
            </div>
          </>
        )}

        {domain && !verified && (
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              <span className="font-mono">{domain}</span> is connected but not verified yet.
            </p>

            {ownershipChallenge ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
                <p className="font-medium text-amber-300">
                  This domain is already connected to another project.
                </p>
                <p className="mt-1 text-slate-400">
                  To claim it here, add this TXT record to prove ownership:
                </p>
                <div className="mt-2 space-y-1 font-mono text-xs text-slate-300">
                  <div>Type: TXT</div>
                  <div>Name: {ownershipChallenge.domain}</div>
                  <div>Value: {ownershipChallenge.value}</div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-white/10 bg-[#1a1a2e] p-4 text-sm">
                <p className="text-slate-400">Add this DNS record:</p>
                <div className="mt-2 space-y-1 font-mono text-xs text-slate-300">
                  <div>Type: CNAME</div>
                  <div>Name: {domain.split(".")[0]}</div>
                  <div>Value: {recommendedCname ?? "cname.vercel-dns.com"}</div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={handleRemove} loading={removing}>
                Cancel
              </Button>
              <Button onClick={handleVerify} loading={verifying}>
                Verify
              </Button>
            </div>
          </div>
        )}

        {domain && verified && (
          <div className="flex items-center justify-between rounded-lg border border-white/10 bg-[#1a1a2e] p-4">
            <div>
              <p className="text-sm font-medium text-slate-100">{domain}</p>
              <p className="text-xs text-emerald-400">Verified — live</p>
            </div>
            <Button type="button" variant="secondary" onClick={handleRemove} loading={removing}>
              Remove domain
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
```

- [ ] **Step 3: Add the nav tab**

In `src/app/(dashboard)/settings/settings-nav.tsx`, add `Globe` to the lucide-react import:

```typescript
import { Building2, Plug, Palette, CreditCard, FolderOpen, LineChart, Globe } from "lucide-react";
```

Then add a tab entry to the `TABS` array, after "Credit Monitoring":

```typescript
  { label: "Credit Monitoring", href: "/settings/credit-monitoring", icon: LineChart },
  { label: "Domain", href: "/settings/domain", icon: Globe },
  { label: "Branding", href: "/settings/branding", icon: Palette },
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in the new `domain/` files or `settings-nav.tsx`.

- [ ] **Step 5: Manual verification**

Run: `npm run build`
Expected: build succeeds, `/settings/domain` appears in the route list.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/settings/domain" "src/app/(dashboard)/settings/settings-nav.tsx"
git commit -m "feat: add Settings > Domain page"
```

---

### Task 7: Middleware guard

**Files:**
- Modify: `src/middleware.ts`

**Interfaces:**
- Consumes: `createAdminClient` from `@/lib/supabase/admin`; `agencies.custom_domain` / `custom_domain_verified` (Task 1).

- [ ] **Step 1: Add the import**

At the top of `src/middleware.ts`, add:

```typescript
import { createAdminClient } from "@/lib/supabase/admin";
```

- [ ] **Step 2: Add the host-check helpers**

After the `PUBLIC_ROUTES` constant (around line 12), add:

```typescript
/** True for the app's own hosts (production domain, Vercel preview/prod
 *  aliases, localhost) — i.e. NOT a candidate for custom-domain resolution. */
function isPrimaryAppHost(host: string): boolean {
  const bare = host.split(":")[0].toLowerCase();
  if (bare === "localhost" || bare === "127.0.0.1") return true;
  if (bare.endsWith(".vercel.app")) return true;
  try {
    const appHost = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "").hostname.toLowerCase();
    return bare === appHost;
  } catch {
    return false;
  }
}

/** True if `host` is a verified custom_domain on some agency. */
async function isVerifiedAgencyDomain(host: string): Promise<boolean> {
  const bare = host.split(":")[0].toLowerCase();
  const admin = createAdminClient();
  const { data } = await admin
    .from("agencies")
    .select("id")
    .eq("custom_domain", bare)
    .eq("custom_domain_verified", true)
    .maybeSingle();
  return Boolean(data);
}
```

- [ ] **Step 3: Wire the guard into the `/portal` branch**

In the `middleware` function, find:

```typescript
  // 2. Portal (client-facing) — separate auth via the portal_session cookie.
  //    Never apply staff Supabase Auth here.
  if (pathname.startsWith("/portal")) {
```

Change it to:

```typescript
  // 2. Portal (client-facing) — separate auth via the portal_session cookie.
  //    Never apply staff Supabase Auth here.
  if (pathname.startsWith("/portal")) {
    const host = request.headers.get("host");
    // Defense-in-depth: on any Host that isn't our own, only proceed if it's
    // a verified custom domain. The token/cookie flow below is already
    // fully host-agnostic and does the real work; this just guards against
    // stale DNS after an agency disconnects their domain.
    if (host && !isPrimaryAppHost(host) && !(await isVerifiedAgencyDomain(host))) {
      return new NextResponse("Not found", { status: 404 });
    }
```

(The rest of the existing `/portal` block — the `?token=` exchange, the `portal_session` cookie check — is unchanged; this just wraps it with one new early-exit check.)

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in `src/middleware.ts`.

- [ ] **Step 5: Manual verification — existing behavior unaffected**

Run: `npm run dev`, then in another terminal:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/portal
```

Expected: `200` (unchanged from before this task — `localhost` is a primary app host, so the guard is a no-op here).

- [ ] **Step 6: Manual verification — guard rejects an unrecognized host**

With the dev server still running:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -H "Host: not-a-real-domain.example" http://localhost:3000/portal
```

Expected: `404` (this host isn't the primary app host and isn't a verified `custom_domain` in the database).

- [ ] **Step 7: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add verified-custom-domain guard to portal middleware"
```

---

### Task 8: Full build + live Vercel API test

**Files:** none (verification only)

- [ ] **Step 1: Confirm VERCEL_TOKEN is present**

Check `.env.local` has real, non-empty values for `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID` (Task 3 documents what these should be — `VERCEL_PROJECT_ID`/`VERCEL_TEAM_ID` are fixed values already known; `VERCEL_TOKEN` must be a real token the user generated). If `VERCEL_TOKEN` is missing, stop here and ask the user for it — the rest of this task cannot run without it.

- [ ] **Step 2: Full build**

Run: `npm run build`
Expected: succeeds with no errors (warnings about Google Fonts fallback are pre-existing and unrelated).

- [ ] **Step 3: Write the throwaway verification script**

Create `verify-vercel-domain.ts` at the repo root (same level as `package.json`) — it will be deleted in Step 8, never committed:

```typescript
// Throwaway script — deleted at the end of this task. Run with:
//   npx tsx verify-vercel-domain.ts add
//   npx tsx verify-vercel-domain.ts verify
//   npx tsx verify-vercel-domain.ts remove
import { readFileSync } from "fs";

// .env.local isn't auto-loaded outside the Next.js runtime — parse it manually
// rather than adding a dotenv dependency for a script we're about to delete.
for (const line of readFileSync(".env.local", "utf-8").split("\n")) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2].trim();
}

const { addDomainToProject, verifyDomain, removeDomainFromProject } = await import(
  "./src/lib/vercel/domains"
);

const DOMAIN = "info.towfiqul.com";
const action = process.argv[2];

if (action === "add") {
  console.log(JSON.stringify(await addDomainToProject(DOMAIN), null, 2));
} else if (action === "verify") {
  console.log(JSON.stringify(await verifyDomain(DOMAIN), null, 2));
} else if (action === "remove") {
  console.log(JSON.stringify(await removeDomainFromProject(DOMAIN), null, 2));
} else {
  console.error("Usage: npx tsx verify-vercel-domain.ts <add|verify|remove>");
  process.exit(1);
}
```

- [ ] **Step 4: Live add — info.towfiqul.com**

Run: `npx tsx verify-vercel-domain.ts add`

Expected output shape: `{ "ok": true, "status": { "verified": false, "ownershipChallenge": null, "recommendedCname": "<something>.vercel-dns.com" } }` (no ownership challenge expected, since this is presumably a fresh domain not already on another Vercel project). Note the `recommendedCname` value for the next step.

- [ ] **Step 5: Add the DNS record**

Tell the user the exact CNAME record from Step 4's output — name `info` (or whatever subdomain label applies), value = the `recommendedCname` printed — and ask them to add it in their DNS provider for `info.towfiqul.com`. Wait for their confirmation before proceeding; DNS propagation can take a few minutes.

- [ ] **Step 6: Live verify**

Run: `npx tsx verify-vercel-domain.ts verify`
Expected: `{ "verified": true }`. If `false`, wait a few minutes for DNS propagation and retry — do not loop indefinitely; check back with the user if it fails more than twice.

- [ ] **Step 7: Confirm HTTPS serves correctly**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://info.towfiqul.com/portal
```

Expected: `200` with a valid TLS handshake (curl fails outright on a cert error, not just a non-200 status) — confirms Vercel issued SSL automatically.

- [ ] **Step 8: Clean up the test domain and script**

Run: `npx tsx verify-vercel-domain.ts remove`
Expected: `{ "ok": true }`. Then confirm `curl https://info.towfiqul.com/portal` no longer resolves through this project, and remind the user they may also want to remove the DNS record on their end.

Delete the script:

```bash
rm verify-vercel-domain.ts
```

No commit needed for this task — it's verification only, and the script never lived in the repo (confirm `git status` shows it gone, not staged/deleted).
