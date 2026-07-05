# Session 7 (Part B) — Credit Monitoring Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Agency-plan agencies connect a credit-monitoring provider (MyFreeScoreNow, IdentityIQ, or SmartCredit) with their own API keys, and pull 3-bureau scores for a client directly from ClientDeck Pro — recording every attempt, updating the client's current scores and score history on success, and syncing to GHL.

**Architecture:** Agencies bring their own provider API keys (stored per-agency, not resold). A thin `src/lib/credit-monitoring/` adapter layer normalizes the three providers behind one `pullCreditScores()` call. A staff-triggered API route (`/api/credit-monitoring/pull`) does the pull, writes an audit row to a new `credit_monitoring_pulls` table regardless of outcome, and — only on success — updates the client's live scores, appends a `score_history` row, and does a best-effort GHL field sync. An optional non-blocking auto-pull hook fires from the existing GHL onboarding webhook for brand-new clients. This plan assumes Session 7 Part A (UI upgrade) is already merged/present in this branch — it reuses `Card`, `Modal`, `Button`, `Field`/`Input`, `Badge`, `StatCard` exactly as they exist after that work.

**Tech Stack:** Next.js 16 Route Handlers, Supabase (service-role writes), TypeScript. No new npm packages — plain `fetch()` for the three provider adapters.

## Global Constraints

- **Never log API keys to console**, in error messages, or in `raw_response` JSON (the providers' own response bodies are fine to store — they're not credentials — but never interpolate `apiKey`/`apiSecret` into a `console.error`/`console.log` call or into anything written to `credit_monitoring_pulls.error_message`).
- **Score pull is plan-gated to `agency`/`enterprise` only.** No existing code in this repo gates anything by `.plan === "agency"` — this plan introduces that pattern for the first time, in `src/lib/billing/plans.ts`, as a small reusable helper (Task 1) rather than inline `agency.plan !== "agency"` checks scattered across files.
- **API keys are stored as plain `TEXT` columns** on `agencies` (same as the existing `ghl_api_key` column) — "encrypted at rest" is satisfied by Supabase's disk-level encryption; do not add application-level encryption/decryption code.
- **If a provider call fails or returns null scores, do not update the client's scores** — but always insert a `credit_monitoring_pulls` row (status `success`/`failed`, with `error_message` set on failure) so there's an audit trail either way.
- **Auto-pull is non-blocking.** Follow the exact `after(async () => { ... })().catch(err => console.error(...))` pattern already used in `src/app/api/ghl/onboarding/route.ts` — never let a credit-pull failure affect the onboarding webhook's response or its other `after()` tasks.
- **No new required environment variables.** Every provider credential is per-agency, entered via Settings UI and stored in the `agencies` table — there is nothing to add to `.env.example` for this feature.
- **Reuse the existing auth/session patterns exactly:** staff-facing API routes and pages use `getSessionContext()` from `@/lib/auth/session` (manual null-check, no shared wrapper exists — see `src/app/api/ghl/onboarding/route.ts`'s sibling routes for the pattern); any DB write inside an API route or webhook uses `createAdminClient()` from `@/lib/supabase/admin`; server actions triggered from Settings forms use `"use server"` files following the exact shape of `src/app/(dashboard)/settings/actions.ts` (`getSessionContext()` → `{success: false, error}` early return → `createServerSupabaseClient()` → mutate → `revalidatePath(...)` → `{success: true}`).
- **Verification is `npx tsc --noEmit` + `npm run lint` per task, `npm run build` on the final task** — this repo has no test suite (confirmed: no jest/vitest/playwright in `package.json`); do not add one.
- **Migration 017 has already been run against the live Supabase project by the user** (per their own instruction) — Task 1 still creates the `supabase/migrations/017_credit_monitoring.sql` file for source-control parity (matching the existing 001–016 convention), but no task in this plan runs it against Supabase. Its SQL must be idempotent (`IF NOT EXISTS` everywhere) so re-running it is harmless if it's ever needed.
- **Commit after each task** once `tsc`/`lint` are clean.

---

### Task 1: Migration File + Types + Plan-Gate Helper

**Files:**
- Create: `supabase/migrations/017_credit_monitoring.sql`
- Modify: `src/types/index.ts`
- Modify: `src/lib/billing/plans.ts`

**Interfaces:**
- Produces: `CreditMonitoringService = "myfreescorenow" | "identityiq" | "smartcredit"`, `CreditMonitoringPullStatus = "success" | "failed" | "pending"`, `CreditMonitoringPull` interface, `Agency.credit_monitoring_service: "myfreescorenow" | "identityiq" | "smartcredit" | "none"`, `Agency.credit_monitoring_api_key: string | null`, `Agency.credit_monitoring_api_secret: string | null`, and `isAgencyPlanOrHigher(plan: Plan): boolean` exported from `src/lib/billing/plans.ts`.
- Consumes: `Plan` type (already defined, unchanged).

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/017_credit_monitoring.sql`, following the exact header/style convention of `supabase/migrations/016_opportunity_id.sql` (a `--` comment line, then plain idempotent DDL, no transactions, no `DROP`):

```sql
-- 017_credit_monitoring.sql — Agency-plan credit monitoring provider integration
CREATE TABLE IF NOT EXISTS credit_monitoring_pulls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  service TEXT NOT NULL CHECK (service IN ('myfreescorenow', 'identityiq', 'smartcredit', 'manual')),
  pulled_at TIMESTAMPTZ DEFAULT NOW(),
  score_eq INTEGER,
  score_exp INTEGER,
  score_tu INTEGER,
  raw_response JSONB,
  status TEXT DEFAULT 'success' CHECK (status IN ('success', 'failed', 'pending')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_pulls_client ON credit_monitoring_pulls(client_id, pulled_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_pulls_agency ON credit_monitoring_pulls(agency_id, pulled_at DESC);

ALTER TABLE credit_monitoring_pulls ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Agency sees own pulls" ON credit_monitoring_pulls
    FOR SELECT USING (agency_id = get_user_agency_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Agency manages pulls" ON credit_monitoring_pulls
    FOR INSERT WITH CHECK (agency_id = get_user_agency_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE agencies ADD COLUMN IF NOT EXISTS credit_monitoring_service TEXT
  CHECK (credit_monitoring_service IN ('myfreescorenow', 'identityiq', 'smartcredit', 'none'))
  DEFAULT 'none';

ALTER TABLE agencies ADD COLUMN IF NOT EXISTS credit_monitoring_api_key TEXT;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS credit_monitoring_api_secret TEXT;
```

Note: `CREATE POLICY` has no `IF NOT EXISTS` clause in Postgres, so the `DO $$ ... EXCEPTION WHEN duplicate_object` wrapper is what makes re-running this file harmless if it's ever re-applied — this is a deliberate deviation from the original spec's bare `CREATE POLICY` statements (which would error on a second run), consistent with this migration file needing to be safely idempotent per the Global Constraints.

- [ ] **Step 2: Add types to `src/types/index.ts`**

Add near the other narrow string-union types (alongside `SignatureStatus`/`SignatureType` at the top of the file):

```ts
export type CreditMonitoringService = "myfreescorenow" | "identityiq" | "smartcredit";
export type CreditMonitoringPullStatus = "success" | "failed" | "pending";
```

Add the two new nullable-ish fields to the `Agency` interface (after `ghl_webhook_url: string | null;` or anywhere alongside the other GHL/Drive integration fields — place them as their own labeled block like the existing `// Google Drive integration (migration 012)` comment):

```ts
  // Credit monitoring (migration 017)
  credit_monitoring_service: "myfreescorenow" | "identityiq" | "smartcredit" | "none";
  credit_monitoring_api_key: string | null;
  credit_monitoring_api_secret: string | null;
```

Add a new interface near `ScoreHistory` (they serve a related purpose — a raw pull record vs. a normalized score snapshot):

```ts
export interface CreditMonitoringPull {
  id: string;
  agency_id: string;
  client_id: string;
  service: CreditMonitoringService | "manual";
  pulled_at: string;
  score_eq: number | null;
  score_exp: number | null;
  score_tu: number | null;
  raw_response: Record<string, unknown> | null;
  status: CreditMonitoringPullStatus;
  error_message: string | null;
  created_at: string;
}
```

- [ ] **Step 3: Add the plan-gate helper to `src/lib/billing/plans.ts`**

Add this exported function after `maxTeamMembersForPlan`:

```ts
/** True for the plans that unlock the credit-monitoring integration (Agency and Enterprise). */
export function isAgencyPlanOrHigher(plan: Plan): boolean {
  return plan === "agency" || plan === "enterprise";
}
```

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit` — expected clean (in particular, confirm nothing elsewhere in the codebase does an exhaustive/spread construction of `Agency` objects that would now be missing the three new required fields — check any test fixtures or seed scripts; `scripts/seed-demo.ts` is the one script in this repo that inserts agency rows, and since the new columns have DB defaults (`'none'`/`NULL`), an insert that omits them is fine at the DB level and does not need a TypeScript-level object literal update unless `scripts/seed-demo.ts` types its insert payload against the full `Agency` interface — check this and add the three fields there only if TypeScript actually complains).
Run: `npm run lint` — expected clean.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/017_credit_monitoring.sql src/types/index.ts src/lib/billing/plans.ts
git commit -m "feat: add credit monitoring migration, types, and agency plan-gate helper"
```

---

### Task 2: Credit Monitoring Provider Adapters

**Files:**
- Create: `src/lib/credit-monitoring/index.ts`
- Create: `src/lib/credit-monitoring/myfreescorenow.ts`
- Create: `src/lib/credit-monitoring/identityiq.ts`
- Create: `src/lib/credit-monitoring/smartcredit.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks except the `CreditMonitoringService` type from `@/types` (Task 1).
- Produces: `pullCreditScores(service, apiKey, apiSecret, clientData): Promise<ScorePullResult>` and `testConnection(service, apiKey, apiSecret): Promise<{ok: boolean; message: string}>`, both exported from `src/lib/credit-monitoring/index.ts`. `ScorePullResult = {score_eq: number|null, score_exp: number|null, score_tu: number|null, raw_response?: Record<string, unknown>, error?: string}`. `ClientData = {firstName: string; lastName: string; ssnLast4: string; dob: string; address: string; city: string; state: string; zip: string}`. These exact names/shapes are what Task 4's API route imports.

- [ ] **Step 1: Write `src/lib/credit-monitoring/myfreescorenow.ts`**

```ts
export interface ClientData {
  firstName: string;
  lastName: string;
  ssnLast4: string;
  dob: string;
  address: string;
  city: string;
  state: string;
  zip: string;
}

export interface ScorePullResult {
  score_eq: number | null;
  score_exp: number | null;
  score_tu: number | null;
  raw_response?: Record<string, unknown>;
  error?: string;
}

// TODO: Verify endpoint URL and field names with MyFreeScoreNow's partner portal —
// this is the correctly-shaped request/response handling for a Basic-Auth JSON API,
// but the exact path and response field names are placeholders until an agency
// configures real partner credentials and this can be verified against a live call.
export async function pullMyFreeScoreNow(
  apiKey: string,
  apiSecret: string,
  clientData: ClientData
): Promise<ScorePullResult> {
  try {
    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

    const response = await fetch("https://api.myfreescorenow.com/v1/scores", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        first_name: clientData.firstName,
        last_name: clientData.lastName,
        ssn: clientData.ssnLast4,
        dob: clientData.dob,
        address: clientData.address,
        city: clientData.city,
        state: clientData.state,
        zip: clientData.zip,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return { score_eq: null, score_exp: null, score_tu: null, error: `API error: ${response.status}` };
    }

    const data = await response.json();

    return {
      score_eq: data.equifax_score ?? data.scores?.equifax ?? null,
      score_exp: data.experian_score ?? data.scores?.experian ?? null,
      score_tu: data.transunion_score ?? data.scores?.transunion ?? null,
      raw_response: data,
    };
  } catch (err) {
    return { score_eq: null, score_exp: null, score_tu: null, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Lightweight reachability/credential-shape check for the Settings "Test Connection" button. */
export async function testMyFreeScoreNowConnection(apiKey: string, apiSecret: string): Promise<{ ok: boolean; message: string }> {
  if (!apiKey.trim() || !apiSecret.trim()) {
    return { ok: false, message: "Enter both an API key and API secret." };
  }
  try {
    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
    const response = await fetch("https://api.myfreescorenow.com/v1/scores", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(8000),
    });
    // A 401/403 means the endpoint rejected the credentials specifically; anything
    // else responding at all (including a 4xx for the empty body) confirms the
    // host + auth scheme are reachable, which is as far as a keyless test can go.
    if (response.status === 401 || response.status === 403) {
      return { ok: false, message: "Credentials rejected by MyFreeScoreNow." };
    }
    return { ok: true, message: "Reached MyFreeScoreNow with these credentials." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not reach MyFreeScoreNow." };
  }
}
```

- [ ] **Step 2: Write `src/lib/credit-monitoring/identityiq.ts`**

```ts
import type { ClientData, ScorePullResult } from "./myfreescorenow";

// TODO: Verify endpoint URL with IdentityIQ/TransUnion reseller partner portal.
export async function pullIdentityIQ(
  apiKey: string,
  apiSecret: string,
  clientData: ClientData
): Promise<ScorePullResult> {
  try {
    const response = await fetch("https://api.identityiq.com/v2/credit-report", {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "X-API-Secret": apiSecret,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        firstName: clientData.firstName,
        lastName: clientData.lastName,
        ssn4: clientData.ssnLast4,
        dateOfBirth: clientData.dob,
        addressLine1: clientData.address,
        city: clientData.city,
        state: clientData.state,
        postalCode: clientData.zip,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return { score_eq: null, score_exp: null, score_tu: null, error: `API error: ${response.status}` };
    }

    const data = await response.json();

    return {
      score_eq: data.equifaxScore ?? null,
      score_exp: data.experianScore ?? null,
      score_tu: data.transunionScore ?? null,
      raw_response: data,
    };
  } catch (err) {
    return { score_eq: null, score_exp: null, score_tu: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function testIdentityIQConnection(apiKey: string, apiSecret: string): Promise<{ ok: boolean; message: string }> {
  if (!apiKey.trim() || !apiSecret.trim()) {
    return { ok: false, message: "Enter both an API key and API secret." };
  }
  try {
    const response = await fetch("https://api.identityiq.com/v2/credit-report", {
      method: "POST",
      headers: { "X-API-Key": apiKey, "X-API-Secret": apiSecret, "Content-Type": "application/json" },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(8000),
    });
    if (response.status === 401 || response.status === 403) {
      return { ok: false, message: "Credentials rejected by IdentityIQ." };
    }
    return { ok: true, message: "Reached IdentityIQ with these credentials." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not reach IdentityIQ." };
  }
}
```

- [ ] **Step 3: Write `src/lib/credit-monitoring/smartcredit.ts`**

```ts
import type { ClientData, ScorePullResult } from "./myfreescorenow";

// TODO: Verify endpoint URL with SmartCredit's white-label reseller API docs.
export async function pullSmartCredit(
  apiKey: string,
  apiSecret: string,
  clientData: ClientData
): Promise<ScorePullResult> {
  try {
    const response = await fetch("https://api.smartcredit.com/v1/reports", {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
        "X-Api-Secret": apiSecret,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        first_name: clientData.firstName,
        last_name: clientData.lastName,
        ssn_last_4: clientData.ssnLast4,
        dob: clientData.dob,
        address: clientData.address,
        city: clientData.city,
        state: clientData.state,
        zip: clientData.zip,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return { score_eq: null, score_exp: null, score_tu: null, error: `API error: ${response.status}` };
    }

    const data = await response.json();

    return {
      score_eq: data.scores?.equifax ?? null,
      score_exp: data.scores?.experian ?? null,
      score_tu: data.scores?.transunion ?? null,
      raw_response: data,
    };
  } catch (err) {
    return { score_eq: null, score_exp: null, score_tu: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function testSmartCreditConnection(apiKey: string, apiSecret: string): Promise<{ ok: boolean; message: string }> {
  if (!apiKey.trim() || !apiSecret.trim()) {
    return { ok: false, message: "Enter both an API key and API secret." };
  }
  try {
    const response = await fetch("https://api.smartcredit.com/v1/reports", {
      method: "POST",
      headers: { "X-Api-Key": apiKey, "X-Api-Secret": apiSecret, "Content-Type": "application/json" },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(8000),
    });
    if (response.status === 401 || response.status === 403) {
      return { ok: false, message: "Credentials rejected by SmartCredit." };
    }
    return { ok: true, message: "Reached SmartCredit with these credentials." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not reach SmartCredit." };
  }
}
```

- [ ] **Step 4: Write the dispatcher `src/lib/credit-monitoring/index.ts`**

```ts
import type { CreditMonitoringService } from "@/types";
import { pullMyFreeScoreNow, testMyFreeScoreNowConnection } from "./myfreescorenow";
import { pullIdentityIQ, testIdentityIQConnection } from "./identityiq";
import { pullSmartCredit, testSmartCreditConnection } from "./smartcredit";
import type { ClientData, ScorePullResult } from "./myfreescorenow";

export type { ClientData, ScorePullResult };

export async function pullCreditScores(
  service: CreditMonitoringService,
  apiKey: string,
  apiSecret: string,
  clientData: ClientData
): Promise<ScorePullResult> {
  switch (service) {
    case "myfreescorenow":
      return pullMyFreeScoreNow(apiKey, apiSecret, clientData);
    case "identityiq":
      return pullIdentityIQ(apiKey, apiSecret, clientData);
    case "smartcredit":
      return pullSmartCredit(apiKey, apiSecret, clientData);
    default:
      return { score_eq: null, score_exp: null, score_tu: null, error: "Unknown service" };
  }
}

export async function testConnection(
  service: CreditMonitoringService,
  apiKey: string,
  apiSecret: string
): Promise<{ ok: boolean; message: string }> {
  switch (service) {
    case "myfreescorenow":
      return testMyFreeScoreNowConnection(apiKey, apiSecret);
    case "identityiq":
      return testIdentityIQConnection(apiKey, apiSecret);
    case "smartcredit":
      return testSmartCreditConnection(apiKey, apiSecret);
    default:
      return { ok: false, message: "Unknown service" };
  }
}
```

- [ ] **Step 5: Type-check and lint**

Run: `npx tsc --noEmit` — expected clean.
Run: `npm run lint` — expected clean (in particular, this codebase's ESLint config may flag unused `data.equifax_score`-style dynamic property access on an untyped `await response.json()` result as `no-unsafe-member-access` under `@typescript-eslint` — if lint fails on this, type the `data` variable as `Record<string, unknown>` and use bracket-index reads with `Number(...)` coercion instead of dot-chains; match whatever the lint config actually enforces rather than guessing).

- [ ] **Step 6: Commit**

```bash
git add src/lib/credit-monitoring
git commit -m "feat: add credit monitoring provider adapters (MyFreeScoreNow, IdentityIQ, SmartCredit)"
```

---

### Task 3: Settings → Credit Monitoring Tab + Plan Gate

**Files:**
- Create: `src/app/(dashboard)/settings/credit-monitoring/page.tsx`
- Create: `src/app/(dashboard)/settings/credit-monitoring/credit-monitoring-form.tsx`
- Modify: `src/app/(dashboard)/settings/settings-nav.tsx`
- Modify: `src/app/(dashboard)/settings/actions.ts`

**Interfaces:**
- Consumes: `isAgencyPlanOrHigher()` (Task 1), `testConnection()` (Task 2), the existing server-action pattern in `settings/actions.ts` (`getSessionContext()`, `ActionResult`, `revalidatePath`), the existing `Card`/`CardHeader`, `Field`/`Input`/`Select`, `Button`, `useToast` primitives.
- Produces: nothing consumed by later tasks (Task 4's Pull Scores modal reads `agency.credit_monitoring_service`/`credit_monitoring_api_key` directly from the session, not from anything this task exports).

- [ ] **Step 1: Add the nav tab**

In `src/app/(dashboard)/settings/settings-nav.tsx`, the `TABS` array currently is:

```ts
const TABS: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "General", href: "/settings", icon: Building2 },
  { label: "GHL Integration", href: "/settings/ghl", icon: Plug },
  { label: "Documents", href: "/settings/documents", icon: FolderOpen },
  { label: "Branding", href: "/settings/branding", icon: Palette },
  { label: "Billing", href: "/settings/billing", icon: CreditCard },
];
```

Add a new entry after "Documents" (before Branding), and import `LineChart` from `lucide-react` alongside the existing icon imports:

```ts
const TABS: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "General", href: "/settings", icon: Building2 },
  { label: "GHL Integration", href: "/settings/ghl", icon: Plug },
  { label: "Documents", href: "/settings/documents", icon: FolderOpen },
  { label: "Credit Monitoring", href: "/settings/credit-monitoring", icon: LineChart },
  { label: "Branding", href: "/settings/branding", icon: Palette },
  { label: "Billing", href: "/settings/billing", icon: CreditCard },
];
```

- [ ] **Step 2: Add server actions to `settings/actions.ts`**

Append to the end of `src/app/(dashboard)/settings/actions.ts` (the file already imports `getSessionContext`, `createServerSupabaseClient`, `revalidatePath`, `ActionResult` — reuse them, don't re-import):

```ts
import { testConnection } from "@/lib/credit-monitoring";
import type { CreditMonitoringService } from "@/types";

/** Saves the agency's credit-monitoring provider selection + API credentials. */
export async function updateCreditMonitoringSettings(input: {
  service: CreditMonitoringService | "none";
  apiKey: string;
  apiSecret: string;
}): Promise<ActionResult> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("agencies")
    .update({
      credit_monitoring_service: input.service,
      credit_monitoring_api_key: input.apiKey.trim() || null,
      credit_monitoring_api_secret: input.apiSecret.trim() || null,
    })
    .eq("id", session.agency.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/settings/credit-monitoring");
  return { success: true };
}

/** Live credential check for the Credit Monitoring "Test Connection" button. */
export async function testCreditMonitoringConnection(input: {
  service: CreditMonitoringService | "none";
  apiKey: string;
  apiSecret: string;
}): Promise<{ ok: boolean; message: string }> {
  const session = await getSessionContext();
  if (!session) return { ok: false, message: "Not authenticated." };

  if (input.service === "none") {
    return { ok: false, message: "Select a provider first." };
  }

  return testConnection(input.service, input.apiKey, input.apiSecret);
}
```

- [ ] **Step 3: Build the form component**

Create `src/app/(dashboard)/settings/credit-monitoring/credit-monitoring-form.tsx`, mirroring the exact structure of `src/app/(dashboard)/settings/ghl/notification-webhooks-form.tsx` (a `"use client"` form with local state, a save action, and a per-field test action using `useToast`):

```tsx
"use client";

import { useState } from "react";
import { Field, Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { updateCreditMonitoringSettings, testCreditMonitoringConnection } from "../actions";
import type { CreditMonitoringService } from "@/types";

const SERVICE_OPTIONS: { value: CreditMonitoringService | "none"; label: string }[] = [
  { value: "none", label: "None" },
  { value: "myfreescorenow", label: "MyFreeScoreNow (GHL native partner)" },
  { value: "identityiq", label: "IdentityIQ (TransUnion reseller)" },
  { value: "smartcredit", label: "SmartCredit (white-label)" },
];

interface CreditMonitoringFormProps {
  initial: {
    service: CreditMonitoringService | "none";
    apiKey: string;
    apiSecret: string;
  };
}

export function CreditMonitoringForm({ initial }: CreditMonitoringFormProps) {
  const { toast } = useToast();
  const [service, setService] = useState(initial.service);
  const [apiKey, setApiKey] = useState(initial.apiKey);
  const [apiSecret, setApiSecret] = useState(initial.apiSecret);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  async function handleSave() {
    setSaving(true);
    const result = await updateCreditMonitoringSettings({ service, apiKey, apiSecret });
    setSaving(false);
    if (result.success) toast("Credit monitoring settings saved.", "success");
    else toast(result.error ?? "Could not save.", "error");
  }

  async function handleTest() {
    setTesting(true);
    const result = await testCreditMonitoringConnection({ service, apiKey, apiSecret });
    setTesting(false);
    toast(result.message, result.ok ? "success" : "error");
  }

  return (
    <Card>
      <CardHeader
        title="Credit Monitoring Service"
        description="Connect MyFreeScoreNow, IdentityIQ, or SmartCredit to pull scores directly from within ClientDeck Pro. Bring your own provider account and API keys."
      />
      <div className="space-y-5 p-6">
        <Field label="Provider" htmlFor="service">
          <Select
            id="service"
            options={SERVICE_OPTIONS}
            value={service}
            onChange={(e) => setService(e.target.value as CreditMonitoringService | "none")}
          />
        </Field>

        {service !== "none" && (
          <>
            <Field label="API Key" htmlFor="apiKey">
              <Input id="apiKey" value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="font-mono text-xs" />
            </Field>
            <Field label="API Secret" htmlFor="apiSecret">
              <Input id="apiSecret" type="password" value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} className="font-mono text-xs" />
            </Field>
          </>
        )}

        <div className="flex justify-end gap-2">
          {service !== "none" && (
            <Button type="button" variant="secondary" loading={testing} onClick={handleTest}>
              Test Connection
            </Button>
          )}
          <Button onClick={handleSave} loading={saving}>
            Save
          </Button>
        </div>
      </div>
    </Card>
  );
}
```

- [ ] **Step 4: Build the page with the plan gate**

Create `src/app/(dashboard)/settings/credit-monitoring/page.tsx`, following the exact `getSessionContext()` → redirect pattern of `src/app/(dashboard)/settings/page.tsx`, plus the plan gate:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { getSessionContext } from "@/lib/auth/session";
import { isAgencyPlanOrHigher } from "@/lib/billing/plans";
import { Card } from "@/components/ui/card";
import { CreditMonitoringForm } from "./credit-monitoring-form";

export default async function CreditMonitoringSettingsPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");

  const { agency } = session;

  if (!isAgencyPlanOrHigher(agency.plan)) {
    return (
      <Card className="p-8 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
          <Lock className="h-6 w-6 text-gray-400" />
        </span>
        <h2 className="mt-4 text-sm font-semibold text-gray-900">
          Credit Monitoring API — Available on Agency plan
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-gray-500">
          Connect MyFreeScoreNow, IdentityIQ, or SmartCredit to pull scores directly
          from within ClientDeck Pro.
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

  return (
    <CreditMonitoringForm
      initial={{
        service: agency.credit_monitoring_service === "none" ? "none" : agency.credit_monitoring_service,
        apiKey: agency.credit_monitoring_api_key ?? "",
        apiSecret: agency.credit_monitoring_api_secret ?? "",
      }}
    />
  );
}
```

- [ ] **Step 5: Type-check and lint**

Run: `npx tsc --noEmit` — expected clean.
Run: `npm run lint` — expected clean.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/settings/credit-monitoring" src/app/(dashboard)/settings/settings-nav.tsx src/app/(dashboard)/settings/actions.ts
git commit -m "feat: add Credit Monitoring settings tab with Agency-plan gate"
```

---

### Task 4: Pull Scores API Route + Client Detail UI

**Files:**
- Create: `src/app/api/credit-monitoring/pull/route.ts`
- Create: `src/app/(dashboard)/clients/[id]/pull-scores-button.tsx`
- Modify: `src/app/(dashboard)/clients/[id]/client-header.tsx`

**Interfaces:**
- Consumes: `pullCreditScores()` (Task 2), `isAgencyPlanOrHigher()` (Task 1), `moveClientPipelineStage`-style best-effort pattern from `src/lib/ghl/pipeline.ts` (do not call `moveClientPipelineStage` itself — that's for pipeline *stage* moves; instead follow its error-handling shape for a new, small best-effort GHL field push inlined into the route, using `updateGHLContactFields` from `@/lib/ghl/api`, already used identically in `src/app/api/ghl/onboarding/route.ts`).
- Produces: `POST /api/credit-monitoring/pull` accepting `{clientId: string}`, returning `{ok: boolean; score_eq?: number|null; score_exp?: number|null; score_tu?: number|null; error?: string}`. `PullScoresButton({client: Client})` client component — no later task consumes it directly, but Task 5 adds a sibling "Score Pull History" read of the same `credit_monitoring_pulls` table this route writes to, using the exact same row shape (`CreditMonitoringPull` from Task 1).

- [ ] **Step 1: Write the API route**

Create `src/app/api/credit-monitoring/pull/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAgencyPlanOrHigher } from "@/lib/billing/plans";
import { pullCreditScores } from "@/lib/credit-monitoring";
import { updateGHLContactFields } from "@/lib/ghl/api";
import type { Client, CreditMonitoringService } from "@/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const { agency } = session;
  if (!isAgencyPlanOrHigher(agency.plan)) {
    return NextResponse.json({ ok: false, error: "Credit monitoring requires the Agency plan." }, { status: 403 });
  }
  if (agency.credit_monitoring_service === "none" || !agency.credit_monitoring_api_key || !agency.credit_monitoring_api_secret) {
    return NextResponse.json({ ok: false, error: "Connect a credit monitoring provider in Settings first." }, { status: 400 });
  }

  const { clientId } = (await req.json().catch(() => ({}))) as { clientId?: string };
  if (!clientId) {
    return NextResponse.json({ ok: false, error: "Missing clientId." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: clientRow } = await admin
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .eq("agency_id", agency.id)
    .single();

  if (!clientRow) {
    return NextResponse.json({ ok: false, error: "Client not found." }, { status: 404 });
  }
  const client = clientRow as Client;

  const missing: string[] = [];
  if (!client.first_name || !client.last_name) missing.push("name");
  if (!client.ssn_last4) missing.push("SSN last 4");
  if (!client.dob) missing.push("date of birth");
  if (!client.address_line1 || !client.city || !client.state || !client.zip) missing.push("address");
  if (missing.length) {
    return NextResponse.json({ ok: false, error: `Missing required client fields: ${missing.join(", ")}.` }, { status: 400 });
  }

  const service = agency.credit_monitoring_service as CreditMonitoringService;
  const result = await pullCreditScores(service, agency.credit_monitoring_api_key, agency.credit_monitoring_api_secret, {
    firstName: client.first_name,
    lastName: client.last_name,
    ssnLast4: client.ssn_last4!,
    dob: client.dob!,
    address: client.address_line1!,
    city: client.city!,
    state: client.state!,
    zip: client.zip!,
  });

  const succeeded = !result.error && (result.score_eq !== null || result.score_exp !== null || result.score_tu !== null);

  await admin.from("credit_monitoring_pulls").insert({
    agency_id: agency.id,
    client_id: clientId,
    service,
    score_eq: result.score_eq,
    score_exp: result.score_exp,
    score_tu: result.score_tu,
    raw_response: result.raw_response ?? null,
    status: succeeded ? "success" : "failed",
    error_message: result.error ?? null,
  });

  if (!succeeded) {
    return NextResponse.json({ ok: false, error: result.error ?? "No scores returned." });
  }

  await admin
    .from("clients")
    .update({
      score_eq_current: result.score_eq ?? client.score_eq_current,
      score_exp_current: result.score_exp ?? client.score_exp_current,
      score_tu_current: result.score_tu ?? client.score_tu_current,
    })
    .eq("id", clientId);

  await admin.from("score_history").insert({
    client_id: clientId,
    agency_id: agency.id,
    score_eq: result.score_eq,
    score_exp: result.score_exp,
    score_tu: result.score_tu,
    round_number: client.current_round,
    notes: `Credit monitoring pull via ${service}`,
  });

  if (client.ghl_contact_id && agency.ghl_api_key && agency.ghl_location_id) {
    const fields: Record<string, string> = {};
    if (result.score_eq !== null) fields.credit_score_eq_current = String(result.score_eq);
    if (result.score_exp !== null) fields.credit_score_exp_current = String(result.score_exp);
    if (result.score_tu !== null) fields.credit_score_tu_current = String(result.score_tu);
    if (Object.keys(fields).length) {
      await updateGHLContactFields(client.ghl_contact_id, fields, {
        apiKey: agency.ghl_api_key,
        locationId: agency.ghl_location_id,
      }).catch((err) => console.error("[Credit Monitoring] GHL field sync error:", err));
    }
  }

  return NextResponse.json({ ok: true, score_eq: result.score_eq, score_exp: result.score_exp, score_tu: result.score_tu });
}
```

Note: the field names `credit_score_eq_current`/`credit_score_exp_current`/`credit_score_tu_current` match the exact GHL custom-field names already documented in this repo's `CLAUDE.md` under "GHL custom fields the snapshot expects" — reuse those, don't invent new field names.

- [ ] **Step 2: Build the Pull Scores button + modal**

Create `src/app/(dashboard)/clients/[id]/pull-scores-button.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { LineChart } from "lucide-react";
import type { Client } from "@/types";

interface PullScoresButtonProps {
  client: Pick<Client, "id" | "first_name" | "last_name" | "ssn_last4" | "dob" | "address_line1" | "city" | "state" | "zip">;
}

export function PullScoresButton({ client }: PullScoresButtonProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [result, setResult] = useState<{ score_eq: number | null; score_exp: number | null; score_tu: number | null } | null>(null);

  const missing: string[] = [];
  if (!client.ssn_last4) missing.push("SSN last 4");
  if (!client.dob) missing.push("Date of birth");
  if (!client.address_line1 || !client.city || !client.state || !client.zip) missing.push("Address");

  async function handlePull() {
    setPulling(true);
    try {
      const res = await fetch("/api/credit-monitoring/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: client.id }),
      });
      const data = await res.json();
      if (data.ok) {
        setResult({ score_eq: data.score_eq, score_exp: data.score_exp, score_tu: data.score_tu });
        router.refresh();
      } else {
        toast(data.error ?? "Could not pull scores.", "error");
      }
    } catch {
      toast("Could not reach the credit monitoring service.", "error");
    } finally {
      setPulling(false);
    }
  }

  function handleClose() {
    setOpen(false);
    setResult(null);
  }

  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <LineChart className="h-4 w-4" /> Pull Scores
      </Button>
      <Modal open={open} onClose={handleClose} title="Pull Credit Scores" size="md">
        {result ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-green-700">✅ Scores Retrieved</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xs text-gray-500">Equifax</p>
                <p className="text-lg font-semibold text-gray-900">{result.score_eq ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Experian</p>
                <p className="text-lg font-semibold text-gray-900">{result.score_exp ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">TransUnion</p>
                <p className="text-lg font-semibold text-gray-900">{result.score_tu ?? "—"}</p>
              </div>
            </div>
            <p className="text-xs text-gray-500">Scores updated in client profile and score history.</p>
            <div className="flex justify-end">
              <Button onClick={handleClose}>Close</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              This will pull current 3-bureau scores for {client.first_name} {client.last_name}.
            </p>
            {missing.length > 0 ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                Missing required fields: {missing.join(", ")}. Complete the client profile before pulling scores.
              </p>
            ) : (
              <p className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                All required fields are present.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={handleClose}>Cancel</Button>
              <Button onClick={handlePull} loading={pulling} disabled={missing.length > 0}>
                Pull Scores Now →
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
```

- [ ] **Step 3: Wire the button into `client-header.tsx`, gated by plan**

Read `src/app/(dashboard)/clients/[id]/client-header.tsx` and find the existing action-buttons row (`AIStrategyPanel`, Edit Client, Start New Round, `CopyPortalLink`). `ClientHeader`'s current props are `{client: Client, members: {id,name}[]}` — it does not currently receive `agency`, so it cannot check `isAgencyPlanOrHigher` itself. Add a new prop:

```tsx
interface ClientHeaderProps {
  client: Client;
  members: { id: string; name: string }[];
  showCreditMonitoring: boolean;
}
```

and update the function signature to accept `showCreditMonitoring`. Import `PullScoresButton` from `./pull-scores-button`, and render it in the action row only when the prop is true:

```tsx
{showCreditMonitoring && <PullScoresButton client={client} />}
```

Then update `src/app/(dashboard)/clients/[id]/layout.tsx` (the caller of `ClientHeader`) to compute and pass this prop — read the layout file, which already calls `getSessionContext()`-equivalent data or fetches the client via `getClientOr404`; find where it has access to the agency's plan (it must, since it's inside `(dashboard)` which already resolves `getSessionContext()` at the layout level above it — check whether `src/app/(dashboard)/clients/[id]/layout.tsx` itself calls `getSessionContext()` or receives agency data some other way; if it doesn't already have the agency, add a `getSessionContext()` call here, following the same pattern as `src/app/(dashboard)/settings/page.tsx`) and pass:

```tsx
<ClientHeader client={client} members={members} showCreditMonitoring={isAgencyPlanOrHigher(session.agency.plan)} />
```

importing `isAgencyPlanOrHigher` from `@/lib/billing/plans`.

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit` — expected clean.
Run: `npm run lint` — expected clean.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/credit-monitoring/pull "src/app/(dashboard)/clients/[id]/pull-scores-button.tsx" "src/app/(dashboard)/clients/[id]/client-header.tsx" "src/app/(dashboard)/clients/[id]/layout.tsx"
git commit -m "feat: add credit score pull API route and Pull Scores button on client detail"
```

---

### Task 5: Score Pull History + Auto-Pull on New Client + Reports Section

**Files:**
- Modify: `src/app/(dashboard)/clients/[id]/timeline/page.tsx`
- Modify: `src/app/api/ghl/onboarding/route.ts`
- Modify: `src/app/(dashboard)/reports/page.tsx`
- Modify: `src/lib/reports/metrics.ts`

**Interfaces:**
- Consumes: `CreditMonitoringPull` type (Task 1), `pullCreditScores()` (Task 2), `isAgencyPlanOrHigher()` (Task 1).
- Produces: `scoreDistribution(clients: {score_eq_current: number|null}[]): {bucket: string; count: number; pct: number}[]` exported from `src/lib/reports/metrics.ts` — no later task in this plan consumes it, but keep it alongside the file's existing `bureauBreakdown`/`typeBreakdown`/`clientMetrics` exports for consistency.

- [ ] **Step 1: Add Score Pull History to the Timeline tab**

Read `src/app/(dashboard)/clients/[id]/timeline/page.tsx`. Add a query for the client's last 10 `credit_monitoring_pulls` rows alongside whatever activity-log query already exists (same file, same `createServerSupabaseClient()`/`createAdminClient()` — match whichever this file already uses):

```ts
const { data: creditPulls } = await supabase
  .from("credit_monitoring_pulls")
  .select("id, service, pulled_at, score_eq, score_exp, score_tu, status, error_message")
  .eq("client_id", id)
  .order("pulled_at", { ascending: false })
  .limit(10);
```

Render a new section (place it near the top of the timeline content, above or below the activity list — match the existing page's section-ordering convention) using the same `Card`/`CardHeader` primitives already used elsewhere in this codebase:

```tsx
{creditPulls && creditPulls.length > 0 && (
  <Card>
    <CardHeader title="Score Pull History" />
    <ul className="divide-y divide-gray-100">
      {creditPulls.map((pull) => (
        <li key={pull.id} className="flex items-center justify-between px-5 py-3 text-sm">
          <span className="text-gray-500">{formatDate(pull.pulled_at)}</span>
          <span className="capitalize text-gray-700">{pull.service.replace(/_/g, " ")}</span>
          <span className="font-mono text-gray-900">
            {pull.status === "success"
              ? `EQ:${pull.score_eq ?? "—"} EXP:${pull.score_exp ?? "—"} TU:${pull.score_tu ?? "—"}`
              : "—"}
          </span>
          <span>{pull.status === "success" ? "✅" : "❌"}</span>
        </li>
      ))}
    </ul>
  </Card>
)}
```

Import `Card`, `CardHeader` from `@/components/ui/card` and `formatDate` from `@/lib/utils/helpers` if not already imported in this file (check the existing import list first — `formatDate` is very likely already imported given the rest of the timeline renders dates).

- [ ] **Step 2: Add the non-blocking auto-pull hook to the onboarding webhook**

In `src/app/api/ghl/onboarding/route.ts`, the `after(async () => { await Promise.allSettled([...]) })` block currently has three entries (Drive sync, GHL field write-back, staff notification — the third gated `if (!isNewClient) return;`). Add a fourth `Promise.allSettled` entry, gated the same way plus an agency-settings/plan check, calling the pull route's logic directly (do not `fetch()` your own route from within the same server process — import and call the shared pieces directly). Since the pull route in Task 4 is not itself an exported function (it's a Next.js Route Handler), extract the minimal reusable logic inline here rather than importing across route files:

```ts
(async () => {
  if (!isNewClient) return;
  if (!agency.settings?.auto_create_rounds) {
    // auto-pull uses its own flag, added below — this comment is illustrative only, remove it
  }
  const autoPull = (agency.settings as Record<string, unknown> | null)?.auto_pull_scores;
  if (!autoPull) return;
  if (agency.credit_monitoring_service === "none" || !agency.credit_monitoring_api_key || !agency.credit_monitoring_api_secret) return;
  if (!clientData.ssn_last4 || !clientData.dob || !clientData.address_line1 || !clientData.city || !clientData.state || !clientData.zip) return;

  const { pullCreditScores } = await import("@/lib/credit-monitoring");
  const result = await pullCreditScores(
    agency.credit_monitoring_service,
    agency.credit_monitoring_api_key,
    agency.credit_monitoring_api_secret,
    {
      firstName: clientData.first_name,
      lastName: clientData.last_name,
      ssnLast4: clientData.ssn_last4,
      dob: clientData.dob,
      address: clientData.address_line1,
      city: clientData.city,
      state: clientData.state,
      zip: clientData.zip,
    }
  );

  const succeeded = !result.error && (result.score_eq !== null || result.score_exp !== null || result.score_tu !== null);

  await supabase.from("credit_monitoring_pulls").insert({
    agency_id: agency.id,
    client_id: clientId,
    service: agency.credit_monitoring_service,
    score_eq: result.score_eq,
    score_exp: result.score_exp,
    score_tu: result.score_tu,
    raw_response: result.raw_response ?? null,
    status: succeeded ? "success" : "failed",
    error_message: result.error ?? null,
  });

  if (succeeded) {
    await supabase
      .from("clients")
      .update({
        score_eq_current: result.score_eq ?? clientData.score_eq_current,
        score_exp_current: result.score_exp ?? clientData.score_exp_current,
        score_tu_current: result.score_tu ?? clientData.score_tu_current,
      })
      .eq("id", clientId);
  }
})().catch((err) => console.error("[Onboarding] Credit monitoring auto-pull error:", err)),
```

Add this as a fourth element of the existing `Promise.allSettled([...])` array (comma-separated with the other three — don't replace them). Remove the illustrative/dead `if (!agency.settings?.auto_create_rounds)` comment block shown above before committing — it was included only to flag that this is a *new*, separate settings flag (`auto_pull_scores`), not to be confused with the existing `auto_create_rounds` automation flag; the real check is the `autoPull` line directly below it.

Add `auto_pull_scores?: boolean;` to the `AgencySettings` interface in `src/types/index.ts` (in the "Credit monitoring" section you can add alongside the other Session-labeled comment blocks already in that interface, e.g. `// Credit monitoring (Session 7)`), and expose a toggle for it in `CreditMonitoringForm` (Task 3's component) — add a checkbox bound to a new `autoPullOnNewClient` local state, saved via a small addition to `updateCreditMonitoringSettings`'s input/update payload (add `autoPullScores: boolean` to its input type and `auto_pull_scores` to the `settings` JSONB merge, following the exact merge-with-existing-settings pattern already used by `updateAutomationSettings` in the same file: `{...session.agency.settings, auto_pull_scores: input.autoPullScores}`).

- [ ] **Step 3: Add `scoreDistribution` to `src/lib/reports/metrics.ts`**

Read the file's existing exports (`bureauBreakdown`, `typeBreakdown`, `clientMetrics`) to match its style (plain functions, no classes, simple loops). Add:

```ts
export interface ScoreDistributionBucket {
  bucket: string;
  count: number;
  pct: number;
}

const SCORE_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: "300-499", min: 300, max: 499 },
  { label: "500-579", min: 500, max: 579 },
  { label: "580-669", min: 580, max: 669 },
  { label: "670-739", min: 670, max: 739 },
  { label: "740+", min: 740, max: Infinity },
];

/** Buckets active clients' current Equifax score into 5 FICO-ish ranges. */
export function scoreDistribution(clients: { score_eq_current: number | null }[]): ScoreDistributionBucket[] {
  const scored = clients.filter((c) => c.score_eq_current !== null) as { score_eq_current: number }[];
  const total = scored.length;
  return SCORE_BUCKETS.map((b) => {
    const count = scored.filter((c) => c.score_eq_current >= b.min && c.score_eq_current <= b.max).length;
    return { bucket: b.label, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 };
  });
}
```

Note: this reuses the same "EQ-only as a rough proxy" simplification the codebase already accepted for `clientMetrics.avgScoreIncrease` (documented as a known rough-KPI trim in the Session 5 final-review notes) — do not compute a 3-bureau average here, stay consistent with that existing precedent.

- [ ] **Step 4: Add the Credit Score Analytics section to `/reports`**

Read `src/app/(dashboard)/reports/page.tsx`. It already fetches a `clients` array for `clientMetrics`/other sections — reuse that same array (do not add a second clients query) and pass it through `scoreDistribution()`. Also compute average starting/current scores per bureau directly in the page (simple reduce over the same `clients` array — do not add this to `metrics.ts` as the file's existing functions are all single-purpose and this is a two-line inline computation):

```tsx
const avg = (nums: (number | null)[]) => {
  const valid = nums.filter((n): n is number => n !== null);
  return valid.length ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : null;
};
const avgStart = {
  eq: avg(clients.map((c) => c.score_eq_start)),
  exp: avg(clients.map((c) => c.score_exp_start)),
  tu: avg(clients.map((c) => c.score_tu_start)),
};
const avgCurrent = {
  eq: avg(clients.map((c) => c.score_eq_current)),
  exp: avg(clients.map((c) => c.score_exp_current)),
  tu: avg(clients.map((c) => c.score_tu_current)),
};
const distribution = scoreDistribution(clients);
const pullsThisMonth = /* see below */ 0;
```

For `pullsThisMonth`, add one more parallel query alongside this page's existing `Promise.all`/sequential queries (match whichever pattern is already there):

```ts
const monthStart = new Date();
monthStart.setDate(1);
monthStart.setHours(0, 0, 0, 0);
const { count: pullsThisMonthCount } = await supabase
  .from("credit_monitoring_pulls")
  .select("id", { count: "exact", head: true })
  .eq("agency_id", agency.id)
  .gte("pulled_at", monthStart.toISOString());
```

Render a new `Card` section (place it after the existing 3-col "Success Rate by Bureau / Most Common Negative Items / Client Metrics" row):

```tsx
<Card>
  <CardHeader title="Credit Score Analytics" />
  <div className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-2">
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Average Starting Score</p>
      <p className="mt-1 text-sm text-gray-900">
        {avgStart.eq ?? "—"} (EQ) / {avgStart.exp ?? "—"} (EXP) / {avgStart.tu ?? "—"} (TU)
      </p>
      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-gray-500">Average Current Score</p>
      <p className="mt-1 text-sm text-gray-900">
        {avgCurrent.eq ?? "—"} (EQ) / {avgCurrent.exp ?? "—"} (EXP) / {avgCurrent.tu ?? "—"} (TU)
      </p>
      <p className="mt-3 text-xs text-gray-500">{pullsThisMonthCount ?? 0} score pulls this month</p>
    </div>
    <div className="space-y-2">
      {distribution.map((d) => (
        <div key={d.bucket} className="flex items-center gap-2 text-xs">
          <span className="w-16 shrink-0 text-gray-500">{d.bucket}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-blue-600" style={{ width: `${d.pct}%` }} />
          </div>
          <span className="w-20 shrink-0 text-right text-gray-600">{d.pct}% ({d.count})</span>
        </div>
      ))}
    </div>
  </div>
</Card>
```

Import `scoreDistribution` from `@/lib/reports/metrics` in this file.

- [ ] **Step 5: Type-check and lint**

Run: `npx tsc --noEmit` — expected clean.
Run: `npm run lint` — expected clean.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/clients/[id]/timeline/page.tsx" "src/app/api/ghl/onboarding/route.ts" "src/app/(dashboard)/reports/page.tsx" src/lib/reports/metrics.ts src/types/index.ts "src/app/(dashboard)/settings/credit-monitoring/credit-monitoring-form.tsx" src/app/(dashboard)/settings/actions.ts
git commit -m "feat: add score pull history, auto-pull on new client, and credit score analytics report"
```

---

### Task 6: Admin — Credit Monitoring Status

**Files:**
- Modify: `src/lib/admin/agency-panel.ts`
- Modify: `src/app/api/admin/agencies/[id]/route.ts`
- Modify: `src/components/admin/agency-slideover.tsx`
- Create: `src/app/api/admin/tools/test-credit-monitoring/route.ts`

**Interfaces:**
- Consumes: `AgencyPanelData` (existing), `testConnection()` (Task 2), `isAgencyPlanOrHigher()` (Task 1), the existing `ToolsTab` component and `runTool()` pattern in `agency-slideover.tsx`.
- Produces: `AgencyPanelData.creditMonitoring: {pullsThisMonth: number}` — no later task consumes this.

- [ ] **Step 1: Extend `AgencyPanelData`**

In `src/lib/admin/agency-panel.ts`, add a field to the interface:

```ts
export interface AgencyPanelData {
  agency: Agency;
  clientCount: number;
  payments: AgencyPanelPayment[];
  ghl: {
    configured: boolean;
    lastSyncAt: string | null;
  };
  creditMonitoring: {
    pullsThisMonth: number;
  };
}
```

- [ ] **Step 2: Compute it in the GET route**

In `src/app/api/admin/agencies/[id]/route.ts`, add a fourth parallel query to the existing `Promise.all([...])` (which currently fetches `clientCount`, `payments`, `lastSync`):

```ts
const [{ count: clientCount }, { data: payments }, { data: lastSync }, { count: pullsThisMonth }] =
  await Promise.all([
    admin.from("clients").select("id", { count: "exact", head: true }).eq("agency_id", id),
    admin.from("manual_payments").select("id, amount, payment_method, reference_number, notes, created_at").eq("agency_id", id).order("created_at", { ascending: false }).limit(20),
    admin.from("ghl_sync_log").select("attempted_at").eq("agency_id", id).order("attempted_at", { ascending: false }).limit(1).maybeSingle(),
    admin
      .from("credit_monitoring_pulls")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", id)
      .gte("pulled_at", new Date(new Date().setDate(1)).toISOString()),
  ]);
```

(Keep the existing three queries' exact selects/filters unchanged — only add the fourth.) Add `creditMonitoring: { pullsThisMonth: pullsThisMonth ?? 0 }` to the returned `payload` object.

- [ ] **Step 3: Write the admin test route**

Create `src/app/api/admin/tools/test-credit-monitoring/route.ts`, following the exact shape of `src/app/api/admin/tools/resend-welcome/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApi } from "@/lib/admin/tool-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { testConnection } from "@/lib/credit-monitoring";
import type { CreditMonitoringService } from "@/types";

export const dynamic = "force-dynamic";

/** Admin-triggered credential check for an agency's configured credit monitoring provider. */
export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;

  const { agencyId } = await request.json().catch(() => ({ agencyId: "" }));
  if (!agencyId) {
    return NextResponse.json({ ok: false, error: "Missing agencyId" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: agency } = await admin
    .from("agencies")
    .select("credit_monitoring_service, credit_monitoring_api_key, credit_monitoring_api_secret")
    .eq("id", agencyId)
    .single();

  if (!agency || agency.credit_monitoring_service === "none") {
    return NextResponse.json({ ok: false, message: "Credit monitoring is not configured for this agency." });
  }

  const result = await testConnection(
    agency.credit_monitoring_service as CreditMonitoringService,
    agency.credit_monitoring_api_key ?? "",
    agency.credit_monitoring_api_secret ?? ""
  );

  return NextResponse.json({ ok: result.ok, message: result.message });
}
```

- [ ] **Step 4: Add the status block + test button to `ToolsTab`**

In `src/components/admin/agency-slideover.tsx`, `ToolsTab` currently receives `{agencyId, configured, driveEnabled, driveEmail, driveFolderId}`. Add three more props:

```ts
function ToolsTab({
  agencyId,
  configured,
  driveEnabled,
  driveEmail,
  driveFolderId,
  creditMonitoringService,
  creditMonitoringConfigured,
  creditMonitoringPullsThisMonth,
}: {
  agencyId: string;
  configured: boolean;
  driveEnabled: boolean;
  driveEmail: string | null;
  driveFolderId: string | null;
  creditMonitoringService: string;
  creditMonitoringConfigured: boolean;
  creditMonitoringPullsThisMonth: number;
}) {
```

Reuse the existing `runTool` function already defined in this component (no changes needed to it). Add a new status block after the existing Google Drive status block (before the `<p>These tools configure...</p>` paragraph), following the same layout:

```tsx
{/* Credit Monitoring status (display only + test button) */}
<div className="rounded-lg border border-gray-200 p-4">
  <h4 className="text-sm font-semibold text-gray-900">Credit Monitoring</h4>
  <div className="mt-2 flex items-center gap-2 text-sm">
    <span className={cn("h-2 w-2 rounded-full", creditMonitoringConfigured ? "bg-green-500" : "bg-gray-300")} />
    <span className="text-gray-600">
      {creditMonitoringConfigured ? `Connected (${creditMonitoringService})` : "Not connected"}
    </span>
  </div>
  {creditMonitoringConfigured && (
    <p className="mt-1 text-xs text-gray-500">{creditMonitoringPullsThisMonth} pulls this month</p>
  )}
  {creditMonitoringConfigured && (
    <button
      disabled={busy !== null}
      onClick={() => runTool("credit-monitoring", "/api/admin/tools/test-credit-monitoring")}
      className={cn(
        "mt-2 flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium",
        busy !== null ? "cursor-not-allowed bg-gray-100 text-gray-400" : "bg-blue-50 text-blue-700 hover:bg-blue-100"
      )}
    >
      {busy === "credit-monitoring" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
      Test API Connection
    </button>
  )}
  {results["credit-monitoring"] && <p className="mt-1 text-xs font-medium text-gray-700">{results["credit-monitoring"]}</p>}
</div>
```

(`Loader2` and `cn` are already imported in this file for the existing `busy`/tools rendering — no new imports needed for this step.)

- [ ] **Step 5: Update the `ToolsTab` call site**

Find where `<ToolsTab ... />` is invoked (around the existing `configured={current!.ghl.configured}` / `driveEnabled={...}` props) and add the three new props, reading from `current!.agency` and `current!.creditMonitoring`:

```tsx
<ToolsTab
  agencyId={current!.agency.id}
  configured={current!.ghl.configured}
  driveEnabled={Boolean(current!.agency.google_drive_enabled)}
  driveEmail={current!.agency.google_drive_email}
  driveFolderId={current!.agency.google_drive_root_folder_id}
  creditMonitoringService={current!.agency.credit_monitoring_service}
  creditMonitoringConfigured={current!.agency.credit_monitoring_service !== "none" && Boolean(current!.agency.credit_monitoring_api_key)}
  creditMonitoringPullsThisMonth={current!.creditMonitoring.pullsThisMonth}
/>
```

(match whatever the existing `driveEmail`/`driveFolderId` prop-passing already looks like exactly — read the real call site before editing, since the survey only confirmed the `configured`/`driveEnabled` two props verbatim; the others are inferred from the `ToolsTab` prop signature and may already be passed slightly differently.)

- [ ] **Step 6: Type-check and lint**

Run: `npx tsc --noEmit` — expected clean.
Run: `npm run lint` — expected clean.

- [ ] **Step 7: Commit**

```bash
git add src/lib/admin/agency-panel.ts "src/app/api/admin/agencies/[id]/route.ts" src/components/admin/agency-slideover.tsx src/app/api/admin/tools/test-credit-monitoring
git commit -m "feat: add credit monitoring status + test-connection tool to admin agency panel"
```

---

### Task 7: Final Verification + Docs

**Files:**
- Modify: `CLAUDE.md` (repo root)

**Interfaces:** none — this task only verifies and documents.

- [ ] **Step 1: Full clean build**

Run, in order: `npx tsc --noEmit`, `npm run lint`, `npm run build`.
Expected: all three clean/succeed. If `npm run build` fails on anything introduced across Tasks 1–6, fix it here and re-run all three.

- [ ] **Step 2: Sanity-check the plan gate and non-agency path, if a dev server is reasonably available**

Start `npm run dev` (or reuse one already running). If there's a way to set the current session's agency to a non-`agency` plan in this environment (e.g. via the seeded demo data or a Supabase row edit), confirm `/settings/credit-monitoring` shows the upgrade-gate card and the `/api/credit-monitoring/pull` route returns 403 for that agency. Then, if credentials/dev data allow, confirm an `agency`-plan session sees the real form. If no dev server or suitable test agency is reasonably available in this environment, explicitly note that in your report rather than claiming this was verified.

- [ ] **Step 3: Update `CLAUDE.md`**

Add a new bullet to "Shipped since" (after the Session 6 GHL notifications bullet — this plan's work is Session 7 Part B; if Session 7 Part A's own `CLAUDE.md` bullet was already committed by an earlier plan's Task 9, append this as a continuation of the same Session 7 bullet or as a clearly-labeled Part B addendum, matching whatever that earlier bullet's exact wording turns out to be — read `CLAUDE.md` first to see its current state before deciding). Describe: per-agency credit monitoring provider connection (MyFreeScoreNow/IdentityIQ/SmartCredit) gated to the Agency plan, the `credit_monitoring_pulls` audit table (migration 017), the Pull Scores flow on client detail with score-history + GHL field sync, the opt-in non-blocking auto-pull on new-client onboarding, the Reports "Credit Score Analytics" section, and the admin panel's credit-monitoring status/test-connection tool. Keep it to the same density as the existing Session 5/6 bullets.

Also add a short new subsection to `CLAUDE.md` (mirroring the existing "## Google Drive Integration" and "## GHL Notifications & Pipeline Sync (Session 6)" subsections in structure and length) titled "## Credit Monitoring Integration (Session 7)", covering: agency-plan gate via `isAgencyPlanOrHigher()`, the three provider adapters under `src/lib/credit-monitoring/` (with the standing `TODO: verify endpoint` caveat carried over from Task 2 so a future session knows these endpoints are unverified placeholders), the `credit_monitoring_pulls` table, and where the Settings tab and Pull Scores button live.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: record Session 7 Part B (credit monitoring integration) in CLAUDE.md"
```
