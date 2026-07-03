# Week 6 — GHL Snapshot + Onboarding + Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the public-facing product — a marketing landing page at `/`, a GHL snapshot request page, legal pages, a guided agency onboarding experience, real Stripe subscription checkout, and an internal admin view for snapshot delivery.

**Architecture:** Introduce a public `(marketing)` route group (no sidebar) and relocate the dashboard from `/` to `/dashboard`. Onboarding state lives in the existing `agencies.settings` JSONB (no migration) and is auto-marked from existing server actions via a shared `markOnboardingStep()` helper. Stripe subscriptions use a shared plan-config module so pricing/limits are defined once and consumed by the landing page, billing page, checkout, and the webhook. Snapshot requests persist to a new `snapshot_requests` table and notify the owner via the Resend HTTP API (no new dependency).

**Tech Stack:** Next.js 16.2.10 (App Router, RSC, Server Actions), React 19, TypeScript, Tailwind CSS v4, Supabase (SSR + service-role), Stripe v22 (already installed), Resend via `fetch`.

## Global Constraints

- **Next.js is 16.2.10, not 14.** Route handler `params`/`searchParams` are async (`Promise`) — already the codebase norm. Server Components by default; `"use client"` only for interactivity.
- **Stripe v22.3.0 is already installed.** Do NOT run `npm install stripe`. Do NOT pass `apiVersion: '2024-06-20'` — it does not typecheck against v22's literal `apiVersion` union. Construct with `new Stripe(process.env.STRIPE_SECRET_KEY!)` (account-default version), matching the existing `src/app/api/portal/stripe-portal/route.ts`.
- **No new npm packages.** Resend is called via `fetch("https://api.resend.com/emails", …)`. If any task seems to need a package, STOP and ask the user first (per user's global rule).
- **Migration number is `008`, not 007** — `007_fix_team_members_rls_recursion.sql` already exists.
- **Pricing (confirmed): Solo $79 / Pro $149 / Agency $249.** Limits: `solo=15`, `pro=75`, `agency=9999`, `enterprise=9999`. These replace the old `$49/$99/$199` & `15/50/200` values everywhere.
- **Dashboard moves from `/` to `/dashboard`** (confirmed). `/` becomes the public landing page.
- **No test runner exists** (no jest/vitest, zero test files). Verification for every task = `npx tsc --noEmit` passes with **zero errors**, plus `npm run build` at the end of each task-group, plus a manual dev-server check where a route is added. Do not scaffold a test framework.
- **Not a git repository.** "Commit" steps are advisory — if the user later runs `git init`, commit then. Do not run `git` commands.
- Use `cn()` from `src/lib/utils/helpers.ts` for class merging, Lucide icons only, mobile-first responsive. Blue accent `#2563EB`.
- Env vars already present in `.env.local`: all Stripe keys (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_SOLO/PRO/AGENCY`), `RESEND_API_KEY`, `NEXT_PUBLIC_APP_URL`. **New env var required: `ADMIN_EMAIL`** (Task 6) — add to `.env.local`.

---

## File Structure

**New files**
- `supabase/migrations/008_snapshot_requests.sql` — snapshot_requests table
- `src/lib/billing/plans.ts` — single source of truth for plan pricing/limits/price-id mapping
- `src/lib/onboarding/steps.ts` — step keys, types, pure `computeOnboarding()`
- `src/lib/onboarding/mark.ts` — server-only `markOnboardingStep()` (admin write)
- `src/app/(dashboard)/onboarding/actions.ts` — `updateOnboardingStep` server action
- `src/app/(dashboard)/onboarding/page.tsx` — standalone setup guide
- `src/app/(dashboard)/onboarding/snapshot-confirm.tsx` — client checkbox for snapshot_installed
- `src/app/(dashboard)/onboarding/plan/page.tsx` — post-signup plan picker
- `src/app/(dashboard)/onboarding/plan/plan-cards.tsx` — client plan cards → checkout
- `src/components/dashboard/onboarding-banner.tsx` — dashboard checklist banner (client)
- `src/app/(dashboard)/dashboard/page.tsx` — **moved** from `src/app/(dashboard)/page.tsx`
- `src/app/(marketing)/layout.tsx` — public nav/footer shell
- `src/app/(marketing)/page.tsx` — landing page
- `src/app/(marketing)/marketing-nav.tsx` — client nav (mobile menu)
- `src/app/(marketing)/faq-accordion.tsx` — client accordion
- `src/app/(marketing)/snapshot/page.tsx` — GHL snapshot page
- `src/app/(marketing)/snapshot/snapshot-request-form.tsx` — client form
- `src/app/(marketing)/snapshot/actions.ts` — `submitSnapshotRequest` server action + Resend email
- `src/app/(marketing)/terms/page.tsx` — Terms of Service
- `src/app/(marketing)/privacy/page.tsx` — Privacy Policy
- `src/lib/stripe/client.ts` — shared Stripe instance
- `src/app/(dashboard)/settings/billing/checkout-actions.ts` — `createCheckoutSession` server action
- `src/app/api/stripe/webhook/route.ts` — Stripe subscription webhook
- `src/app/(dashboard)/admin/snapshot-requests/page.tsx` — admin table
- `src/app/(dashboard)/admin/snapshot-requests/request-actions.ts` — status update server actions
- `src/app/(dashboard)/admin/snapshot-requests/status-buttons.tsx` — client buttons

**Modified files**
- `src/types/index.ts` — extend `AgencySettings`; add `SnapshotRequest` type
- `src/middleware.ts` — public routes; redirect target `/` → `/dashboard`
- `src/components/dashboard/dashboard-shell.tsx` — Dashboard nav href `/` → `/dashboard`
- `src/app/(auth)/signup/page.tsx` — post-signup redirect `/` → `/onboarding/plan`
- `src/app/(dashboard)/settings/actions.ts` — mark `ghl_connected` on Test Connection success
- `src/app/(dashboard)/clients/actions.ts` — mark `first_client_added` after insert
- `src/app/(dashboard)/clients/[id]/portal-actions.ts` — mark `test_portal_viewed` on link generate
- `src/app/(dashboard)/settings/billing/page.tsx` — use shared PLANS; wire upgrade buttons
- `src/app/(dashboard)/settings/billing/manage-billing-button.tsx` — real portal redirect
- `src/lib/utils/license.ts` — `checkClientLimit` default max → 15 (already), confirm plan-limit source

---

## Task 1: Shared plan config + Stripe client + billing-page pricing fix

Centralizes pricing so every later task consumes one source. Purely additive except the billing page price strings.

**Files:**
- Create: `src/lib/billing/plans.ts`
- Create: `src/lib/stripe/client.ts`
- Modify: `src/app/(dashboard)/settings/billing/page.tsx`

**Interfaces:**
- Produces: `PLANS: PlanConfig[]`, `PLAN_BY_ID: Record<Plan, PlanConfig>`, `planFromPriceId(priceId: string): Plan | null`, `maxClientsForPlan(plan: Plan): number`, `stripePriceIdForPlan(plan: Plan): string | undefined`
- Produces: `stripe` (configured `Stripe` instance)

- [ ] **Step 1: Create `src/lib/billing/plans.ts`**

```typescript
import type { Plan } from "@/types";

export interface PlanConfig {
  id: Plan;
  name: string;
  priceMonthly: number;
  priceLabel: string; // "$79"
  maxClients: number;
  clientsLabel: string;
  features: string[];
  /** Name of the env var holding this plan's Stripe price id. */
  priceEnv: "STRIPE_PRICE_SOLO" | "STRIPE_PRICE_PRO" | "STRIPE_PRICE_AGENCY";
  highlight?: boolean;
}

/** Purchasable plans, in display order. `enterprise` is provisioned manually. */
export const PLANS: PlanConfig[] = [
  {
    id: "solo",
    name: "Solo",
    priceMonthly: 79,
    priceLabel: "$79",
    maxClients: 15,
    clientsLabel: "Up to 15 active clients",
    features: [
      "Up to 15 active clients",
      "AI dispute-letter generation",
      "Branded client portal",
      "GoHighLevel sync",
    ],
    priceEnv: "STRIPE_PRICE_SOLO",
  },
  {
    id: "pro",
    name: "Pro",
    priceMonthly: 149,
    priceLabel: "$149",
    maxClients: 75,
    clientsLabel: "Up to 75 clients + white-label portal",
    features: [
      "Up to 75 active clients",
      "White-label client portal",
      "Team members",
      "Priority letter generation",
    ],
    priceEnv: "STRIPE_PRICE_PRO",
    highlight: true,
  },
  {
    id: "agency",
    name: "Agency",
    priceMonthly: 249,
    priceLabel: "$249",
    maxClients: 9999,
    clientsLabel: "Unlimited clients + custom domain + API",
    features: [
      "Unlimited active clients",
      "Custom portal domain",
      "API access",
      'Removes "Powered by ClientDeck Pro"',
    ],
    priceEnv: "STRIPE_PRICE_AGENCY",
  },
];

export const PLAN_BY_ID: Record<Plan, PlanConfig | undefined> = {
  solo: PLANS[0],
  pro: PLANS[1],
  agency: PLANS[2],
  enterprise: undefined,
};

const PLAN_MAX_CLIENTS: Record<Plan, number> = {
  solo: 15,
  pro: 75,
  agency: 9999,
  enterprise: 9999,
};

export function maxClientsForPlan(plan: Plan): number {
  return PLAN_MAX_CLIENTS[plan] ?? 15;
}

export function stripePriceIdForPlan(plan: Plan): string | undefined {
  const config = PLAN_BY_ID[plan];
  if (!config) return undefined;
  return process.env[config.priceEnv];
}

/** Reverse-maps a Stripe price id back to our internal plan (webhook use). */
export function planFromPriceId(priceId: string): Plan | null {
  for (const plan of PLANS) {
    if (process.env[plan.priceEnv] === priceId) return plan.id;
  }
  return null;
}
```

- [ ] **Step 2: Create `src/lib/stripe/client.ts`**

```typescript
import Stripe from "stripe";

/**
 * Shared Stripe instance. We intentionally do NOT pin `apiVersion` — the
 * installed stripe@22 SDK types reject the older literal from the spec, and
 * omitting it uses the account's default version (matches the portal route).
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");
```

- [ ] **Step 3: Rewrite the billing page's local `PLANS` to consume the shared config**

In `src/app/(dashboard)/settings/billing/page.tsx`, delete the local `const PLANS = […]` block and its inline `Plan` import usage, and import from the shared module. Replace the top imports + PLANS definition:

```typescript
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { Card, CardHeader } from "@/components/ui/card";
import { cn, getStatusColor } from "@/lib/utils/helpers";
import { ManageBillingButton } from "./manage-billing-button";
import { UpgradeButton } from "./upgrade-button";
import { PLANS } from "@/lib/billing/plans";
import { Check } from "lucide-react";

const ACTIVE_STATUSES = ["onboarding", "analysis", "active", "on_hold"];
```

Then in the "Plan comparison" grid, change `plan.price` → `plan.priceLabel` and `plan.features` stays. Under each non-current plan card's feature list add an upgrade button:

```tsx
{!current && <UpgradeButton planId={plan.id} planName={plan.name} />}
```

(The `UpgradeButton` component is created in Task 5, Step 4. Until then, temporarily render nothing — but since Task 5 follows, create a minimal stub now so this typechecks.)

- [ ] **Step 4: Create the `UpgradeButton` stub** `src/app/(dashboard)/settings/billing/upgrade-button.tsx`

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { Plan } from "@/types";
import { createCheckoutSession } from "./checkout-actions";

export function UpgradeButton({
  planId,
  planName,
}: {
  planId: Plan;
  planName: string;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    const result = await createCheckoutSession(planId);
    if (!result.success) {
      setLoading(false);
      toast(result.error, "error");
      return;
    }
    window.location.assign(result.url);
  }

  return (
    <Button
      variant="secondary"
      className="mt-4 w-full"
      loading={loading}
      onClick={handleClick}
    >
      Switch to {planName}
    </Button>
  );
}
```

> Note: this imports `createCheckoutSession` from `./checkout-actions`, created in Task 5. To keep Task 1 typechecking independently, create the `checkout-actions.ts` file now as a stub returning an error, and fully implement it in Task 5:

```typescript
// src/app/(dashboard)/settings/billing/checkout-actions.ts  (stub — completed in Task 5)
"use server";
import type { Plan } from "@/types";
export type CheckoutResult =
  | { success: true; url: string }
  | { success: false; error: string };
export async function createCheckoutSession(_plan: Plan): Promise<CheckoutResult> {
  return { success: false, error: "Checkout not configured yet." };
}
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 6 (advisory): Commit** — "feat: shared plan config + stripe client + spec pricing"

---

## Task 2: Onboarding state model + auto-marking hooks

Extend `AgencySettings`, add the shared marking helpers, and wire the three auto-marked steps into existing actions. `snapshot_installed` is user-confirmed (Task 3-of-onboarding).

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/lib/onboarding/steps.ts`
- Create: `src/lib/onboarding/mark.ts`
- Create: `src/app/(dashboard)/onboarding/actions.ts`
- Modify: `src/app/(dashboard)/settings/actions.ts`
- Modify: `src/app/(dashboard)/clients/actions.ts`
- Modify: `src/app/(dashboard)/clients/[id]/portal-actions.ts`

**Interfaces:**
- Produces: `OnboardingStepKey`, `ONBOARDING_STEP_KEYS`, `computeOnboarding(settings): OnboardingState`
- Produces: `markOnboardingStep(agencyId: string, step: OnboardingStepKey, value?: boolean): Promise<void>`
- Produces: `updateOnboardingStep(agencyId: string, step: OnboardingStepKey, value: boolean): Promise<{ success: boolean; error?: string }>`

- [ ] **Step 1: Extend `AgencySettings` in `src/types/index.ts`**

Replace the `AgencySettings` interface with:

```typescript
export interface OnboardingSteps {
  ghl_connected: boolean;
  first_client_added: boolean;
  snapshot_installed: boolean;
  test_portal_viewed: boolean;
}

export interface AgencySettings {
  timezone: string;
  letter_signature: string;
  default_monthly_fee: number;
  portal_branding_visible: boolean;
  onboarding_completed?: boolean;
  onboarding_completed_at?: string | null;
  onboarding_steps?: OnboardingSteps;
}
```

Also add, near the other row types (e.g. after `ActivityLog`):

```typescript
export type SnapshotRequestStatus = "pending" | "sent" | "installed";

export interface SnapshotRequest {
  id: string;
  name: string;
  email: string;
  ghl_location_id: string | null;
  agency_name: string | null;
  message: string | null;
  status: SnapshotRequestStatus;
  created_at: string;
}
```

- [ ] **Step 2: Create `src/lib/onboarding/steps.ts`**

```typescript
import type { AgencySettings, OnboardingSteps } from "@/types";

export type OnboardingStepKey = keyof OnboardingSteps;

export const ONBOARDING_STEP_KEYS: OnboardingStepKey[] = [
  "ghl_connected",
  "first_client_added",
  "snapshot_installed",
  "test_portal_viewed",
];

export const DEFAULT_STEPS: OnboardingSteps = {
  ghl_connected: false,
  first_client_added: false,
  snapshot_installed: false,
  test_portal_viewed: false,
};

export interface OnboardingState {
  steps: OnboardingSteps;
  completedCount: number;
  total: number;
  allComplete: boolean;
  completed: boolean;
  /** True while the 24h post-completion congrats window is still open. */
  showCongrats: boolean;
  /** True once the banner should be permanently hidden. */
  hidden: boolean;
}

const CONGRATS_WINDOW_MS = 24 * 60 * 60 * 1000;

export function computeOnboarding(settings: AgencySettings): OnboardingState {
  const steps: OnboardingSteps = { ...DEFAULT_STEPS, ...settings.onboarding_steps };
  const total = ONBOARDING_STEP_KEYS.length;
  const completedCount = ONBOARDING_STEP_KEYS.filter((k) => steps[k]).length;
  const allComplete = completedCount === total;
  const completed = Boolean(settings.onboarding_completed);

  let showCongrats = false;
  let hidden = false;
  if (completed) {
    const at = settings.onboarding_completed_at
      ? new Date(settings.onboarding_completed_at).getTime()
      : 0;
    const elapsed = Date.now() - at;
    showCongrats = at > 0 && elapsed < CONGRATS_WINDOW_MS;
    hidden = !showCongrats; // completed + past 24h → hide permanently
  }

  return { steps, completedCount, total, allComplete, completed, showCongrats, hidden };
}
```

- [ ] **Step 3: Create `src/lib/onboarding/mark.ts`**

```typescript
import { createAdminClient } from "@/lib/supabase/admin";
import { computeOnboarding, DEFAULT_STEPS, type OnboardingStepKey } from "./steps";
import type { AgencySettings } from "@/types";

/**
 * Sets a single onboarding step and, when all four are complete, stamps
 * `onboarding_completed` + `onboarding_completed_at`. Server-only; callers must
 * pass an agencyId they've already authorized (session/webhook). Uses the
 * service-role client so it works from any trusted server context.
 */
export async function markOnboardingStep(
  agencyId: string,
  step: OnboardingStepKey,
  value = true
): Promise<void> {
  const supabase = createAdminClient();

  const { data: agency } = await supabase
    .from("agencies")
    .select("settings")
    .eq("id", agencyId)
    .single();
  if (!agency) return;

  const settings = (agency.settings ?? {}) as AgencySettings;
  const steps = { ...DEFAULT_STEPS, ...settings.onboarding_steps, [step]: value };

  const nextSettings: AgencySettings = { ...settings, onboarding_steps: steps };

  const state = computeOnboarding(nextSettings);
  if (state.allComplete && !settings.onboarding_completed) {
    nextSettings.onboarding_completed = true;
    nextSettings.onboarding_completed_at = new Date().toISOString();
  }

  await supabase
    .from("agencies")
    .update({ settings: nextSettings })
    .eq("id", agencyId);
}
```

- [ ] **Step 4: Create the server action `src/app/(dashboard)/onboarding/actions.ts`**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { getSessionContext } from "@/lib/auth/session";
import { markOnboardingStep } from "@/lib/onboarding/mark";
import type { OnboardingStepKey } from "@/lib/onboarding/steps";

/**
 * Public onboarding-step setter. Validates the caller owns the agency, then
 * delegates to markOnboardingStep. Signature matches the spec: (agencyId, step, value).
 */
export async function updateOnboardingStep(
  agencyId: string,
  step: OnboardingStepKey,
  value: boolean
): Promise<{ success: boolean; error?: string }> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };
  if (session.agency.id !== agencyId) {
    return { success: false, error: "Forbidden." };
  }

  await markOnboardingStep(agencyId, step, value);
  revalidatePath("/dashboard");
  revalidatePath("/onboarding");
  return { success: true };
}
```

- [ ] **Step 5: Auto-mark `ghl_connected` in `src/app/(dashboard)/settings/actions.ts`**

Add import at top:

```typescript
import { markOnboardingStep } from "@/lib/onboarding/mark";
```

In `testGHLConnection`, inside the `if (result.ok) {` branch, before `return`:

```typescript
  if (result.ok) {
    await markOnboardingStep(session.agency.id, "ghl_connected", true);
    return {
```

- [ ] **Step 6: Auto-mark `first_client_added` in `src/app/(dashboard)/clients/actions.ts`**

Add import at top:

```typescript
import { markOnboardingStep } from "@/lib/onboarding/mark";
```

In `createClient`, after the score-history seed block and before `revalidatePath("/clients")`:

```typescript
  await markOnboardingStep(session.agency.id, "first_client_added", true);

  revalidatePath("/clients");
```

- [ ] **Step 7: Auto-mark `test_portal_viewed` in `src/app/(dashboard)/clients/[id]/portal-actions.ts`**

Add import at top:

```typescript
import { markOnboardingStep } from "@/lib/onboarding/mark";
```

In `generateAndSyncPortalLink`, after the `activity_log` insert and before `return { success: true, url }`:

```typescript
  await markOnboardingStep(session.agency.id, "test_portal_viewed", true);

  return { success: true, url };
```

- [ ] **Step 8: Verify**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 9 (advisory): Commit** — "feat: onboarding state model + auto-marking hooks"

---

## Task 3: Onboarding banner + standalone `/onboarding` page + plan picker

**Files:**
- Create: `src/components/dashboard/onboarding-banner.tsx`
- Create: `src/app/(dashboard)/onboarding/page.tsx`
- Create: `src/app/(dashboard)/onboarding/snapshot-confirm.tsx`
- Create: `src/app/(dashboard)/onboarding/plan/page.tsx`
- Create: `src/app/(dashboard)/onboarding/plan/plan-cards.tsx`

**Interfaces:**
- Consumes: `computeOnboarding` (Task 2), `updateOnboardingStep` (Task 2), `PLANS` (Task 1), `createCheckoutSession` (Task 1 stub / Task 5 full)

- [ ] **Step 1: Create the banner `src/components/dashboard/onboarding-banner.tsx`**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Rocket, Check, ChevronDown, ChevronUp, PartyPopper } from "lucide-react";
import { cn } from "@/lib/utils/helpers";
import { updateOnboardingStep } from "@/app/(dashboard)/onboarding/actions";
import type { OnboardingSteps } from "@/types";

interface Props {
  agencyId: string;
  steps: OnboardingSteps;
  completedCount: number;
  total: number;
  showCongrats: boolean;
  allComplete: boolean;
  firstClientId: string | null;
}

interface Row {
  key: keyof OnboardingSteps | "account";
  label: string;
  href: string;
  cta: string;
  done: boolean;
}

export function OnboardingBanner({
  steps,
  completedCount,
  total,
  showCongrats,
  allComplete,
  firstClientId,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  // Account creation is implicitly done; show it as a satisfying first ✅.
  const rows: Row[] = [
    { key: "account", label: "Create your account", href: "/settings", cta: "", done: true },
    {
      key: "first_client_added",
      label: "Add your first client",
      href: "/clients/new",
      cta: "Add client",
      done: steps.first_client_added,
    },
    {
      key: "ghl_connected",
      label: "Connect GoHighLevel",
      href: "/settings/ghl",
      cta: "Go to Settings",
      done: steps.ghl_connected,
    },
    {
      key: "snapshot_installed",
      label: "Install GHL Snapshot",
      href: "/onboarding",
      cta: "View Instructions",
      done: steps.snapshot_installed,
    },
    {
      key: "test_portal_viewed",
      label: "View client portal",
      href: firstClientId ? `/clients/${firstClientId}` : "/clients",
      cta: "Open a client",
      done: steps.test_portal_viewed,
    },
  ];

  const pct = Math.round((completedCount / total) * 100);

  if (showCongrats) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
        <PartyPopper className="h-5 w-5 text-green-600" />
        <div>
          <p className="text-sm font-semibold text-green-900">
            You&apos;re all set up! 🎉
          </p>
          <p className="text-sm text-green-700">
            ClientDeck Pro is fully configured. This message disappears
            automatically.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/60 shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Rocket className="h-4 w-4 text-blue-600" />
          Get ClientDeck Pro ready in {total} steps
        </span>
        <span className="flex items-center gap-3">
          <span className="text-xs font-medium text-gray-600">
            {completedCount} of {total} complete
          </span>
          {open ? (
            <ChevronUp className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          )}
        </span>
      </button>

      <div className="px-4">
        <div className="h-2 w-full overflow-hidden rounded-full bg-blue-100">
          <div
            className="h-full rounded-full bg-blue-600 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {open && (
        <ul className="space-y-1 p-4">
          {rows.map((row) => (
            <li
              key={row.key}
              className="flex items-center justify-between rounded-md px-2 py-2"
            >
              <span className="flex items-center gap-2 text-sm text-gray-700">
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full border",
                    row.done
                      ? "border-green-500 bg-green-500 text-white"
                      : "border-gray-300 bg-white"
                  )}
                >
                  {row.done && <Check className="h-3 w-3" />}
                </span>
                <span className={cn(row.done && "text-gray-500 line-through")}>
                  {row.label}
                </span>
              </span>
              {!row.done && row.cta && (
                <Link
                  href={row.href}
                  className="rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  {row.cta}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}

      {open && allComplete && (
        <div className="border-t border-blue-100 p-3 text-right">
          <button
            onClick={() => router.refresh()}
            className="text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            Dismiss — I&apos;ll finish later
          </button>
        </div>
      )}
    </div>
  );
}
```

> Note: the "Dismiss" affordance only appears when `allComplete` (spec: dismissible only when all steps done). Because completing all steps stamps `onboarding_completed`, `router.refresh()` re-renders the dashboard, `computeOnboarding` returns `showCongrats`, and the banner switches to the congrats state.

- [ ] **Step 2: Mount the banner on the dashboard.** (The dashboard file is moved in Task 4; add this now to the current `src/app/(dashboard)/page.tsx` — it moves with the file.)

At the top of `src/app/(dashboard)/page.tsx`, add imports:

```typescript
import { OnboardingBanner } from "@/components/dashboard/onboarding-banner";
import { computeOnboarding } from "@/lib/onboarding/steps";
```

Inside `DashboardPage`, after `const session = await getSessionContext();` guard, compute state and fetch a client id for the "open a client" link (reuse the existing `clients` query result — add `.limit`-free is fine; we already select all clients). After `const clients = clientsRes.data ?? [];` add:

```typescript
  const onboarding = computeOnboarding(session.agency.settings);
  const firstClientId = clients[0]?.id ?? null;
```

Then in the returned JSX, as the **first child** of `<div className="space-y-8">`:

```tsx
      {!onboarding.hidden && (
        <OnboardingBanner
          agencyId={session.agency.id}
          steps={onboarding.steps}
          completedCount={onboarding.completedCount}
          total={onboarding.total}
          showCongrats={onboarding.showCongrats}
          allComplete={onboarding.allComplete}
          firstClientId={firstClientId}
        />
      )}
```

- [ ] **Step 3: Create `src/app/(dashboard)/onboarding/snapshot-confirm.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { updateOnboardingStep } from "./actions";
import { useToast } from "@/components/ui/toast";

export function SnapshotConfirm({
  agencyId,
  initial,
}: {
  agencyId: string;
  initial: boolean;
}) {
  const { toast } = useToast();
  const [checked, setChecked] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    const next = !checked;
    setChecked(next);
    setSaving(true);
    const res = await updateOnboardingStep(agencyId, "snapshot_installed", next);
    setSaving(false);
    if (!res.success) {
      setChecked(!next);
      toast(res.error ?? "Could not save.", "error");
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={saving}
      className="flex items-center gap-3 rounded-md border border-gray-200 bg-white px-4 py-3 text-left text-sm hover:bg-gray-50 disabled:opacity-60"
    >
      <span
        className={`flex h-5 w-5 items-center justify-center rounded border ${
          checked ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300"
        }`}
      >
        {checked && <Check className="h-3 w-3" />}
      </span>
      I&apos;ve installed the snapshot in my GoHighLevel account
    </button>
  );
}
```

- [ ] **Step 4: Create the standalone guide `src/app/(dashboard)/onboarding/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionContext } from "@/lib/auth/session";
import { Card, CardHeader } from "@/components/ui/card";
import { computeOnboarding } from "@/lib/onboarding/steps";
import { SnapshotConfirm } from "./snapshot-confirm";
import {
  Plug,
  Package,
  ListChecks,
  Rocket,
  CheckCircle2,
  Circle,
  ArrowRight,
} from "lucide-react";

const SNAPSHOT_URL = "https://clientdeckpro.com/snapshot"; // Week 7: final URL

const CUSTOM_FIELDS = [
  "dispute_round_current",
  "items_deleted_total",
  "total_negative_items",
  "next_dispute_date",
  "credit_score_eq_current",
  "credit_score_exp_current",
  "credit_score_tu_current",
  "clientdeck_portal_link",
  "clientdeck_client_id",
];

export default async function OnboardingPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");

  const { agency } = session;
  const state = computeOnboarding(agency.settings);
  const ghlConnected = state.steps.ghl_connected;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Setup Guide</h1>
        <p className="text-sm text-gray-500">
          {state.completedCount} of {state.total} steps complete. Follow these to
          get the full ClientDeck Pro + GoHighLevel experience.
        </p>
      </div>

      {/* Step 1: Connect GHL */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Plug className="h-4 w-4 text-blue-600" /> 1. Connect GoHighLevel
            </span>
          }
          action={
            ghlConnected ? (
              <span className="flex items-center gap-1 text-sm font-medium text-green-600">
                <CheckCircle2 className="h-4 w-4" /> Connected
              </span>
            ) : (
              <span className="flex items-center gap-1 text-sm text-gray-400">
                <Circle className="h-4 w-4" /> Not connected
              </span>
            )
          }
        />
        <div className="space-y-3 p-6 text-sm text-gray-600">
          <p>
            In GoHighLevel, go to{" "}
            <strong>Settings → Private Integrations</strong> and create a key
            with contact, opportunity, and custom-field scopes. Copy the key and
            your Location ID.
          </p>
          <Link
            href="/settings/ghl"
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Open GHL Settings & Test Connection
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Card>

      {/* Step 2: Install snapshot */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Package className="h-4 w-4 text-blue-600" /> 2. Install the GHL
              Snapshot
            </span>
          }
        />
        <div className="space-y-3 p-6 text-sm text-gray-600">
          <p>
            The snapshot installs the pipelines, workflows, and custom fields
            ClientDeck Pro syncs into. In GoHighLevel go to{" "}
            <strong>Settings → Snapshots → Import → paste this URL</strong>:
          </p>
          <code className="block rounded-md bg-gray-900 px-3 py-2 font-mono text-xs text-gray-100">
            {SNAPSHOT_URL}
          </code>
          <SnapshotConfirm
            agencyId={agency.id}
            initial={state.steps.snapshot_installed}
          />
        </div>
      </Card>

      {/* Step 3: Verify custom fields */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-blue-600" /> 3. Verify Custom
              Fields
            </span>
          }
        />
        <div className="space-y-3 p-6 text-sm text-gray-600">
          <p>
            The snapshot auto-creates these {CUSTOM_FIELDS.length} custom fields.
            Confirm they exist under{" "}
            <strong>GHL → Settings → Custom Fields</strong>:
          </p>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {CUSTOM_FIELDS.map((f) => (
              <code
                key={f}
                className="rounded bg-gray-100 px-2 py-1 font-mono text-xs text-gray-700"
              >
                {f}
              </code>
            ))}
          </div>
        </div>
      </Card>

      {/* Step 4: Test the flow */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Rocket className="h-4 w-4 text-blue-600" /> 4. Test the Full Flow
            </span>
          }
        />
        <div className="space-y-2 p-6 text-sm">
          <Link
            href="/clients/new"
            className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 hover:bg-gray-50"
          >
            Add a test client <ArrowRight className="h-4 w-4 text-gray-400" />
          </Link>
          <Link
            href="/clients"
            className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 hover:bg-gray-50"
          >
            Generate a portal link & open the branded portal
            <ArrowRight className="h-4 w-4 text-gray-400" />
          </Link>
        </div>
      </Card>
    </div>
  );
}
```

> **Required prerequisite (confirmed):** `CardHeader` in `src/components/ui/card.tsx` currently types `title: string` (line ~28) and `description?: string` (line ~29), but this page passes icon+text `ReactNode` titles. Before creating this page, edit those two prop types to `title: ReactNode;` and `description?: ReactNode;` (the component already renders `{title}`/`{description}` and already imports `ReactNode`). Without this, `npx tsc --noEmit` fails on the onboarding page.

- [ ] **Step 5: Create the plan picker `src/app/(dashboard)/onboarding/plan/plan-cards.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils/helpers";
import { useToast } from "@/components/ui/toast";
import { PLANS } from "@/lib/billing/plans";
import { createCheckoutSession } from "@/app/(dashboard)/settings/billing/checkout-actions";

export function PlanCards() {
  const { toast } = useToast();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function choose(planId: (typeof PLANS)[number]["id"]) {
    setLoadingId(planId);
    const result = await createCheckoutSession(planId);
    if (!result.success) {
      setLoadingId(null);
      toast(result.error, "error");
      return;
    }
    window.location.assign(result.url);
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {PLANS.map((plan) => (
        <div
          key={plan.id}
          className={cn(
            "flex flex-col rounded-lg border bg-white p-6 shadow-sm",
            plan.highlight ? "border-blue-500 ring-1 ring-blue-500" : "border-gray-200"
          )}
        >
          {plan.highlight && (
            <span className="mb-2 self-start rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
              Most popular
            </span>
          )}
          <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {plan.priceLabel}
            <span className="text-sm font-normal text-gray-500">/mo</span>
          </p>
          <p className="mt-1 text-sm text-gray-500">{plan.clientsLabel}</p>
          <ul className="mt-4 flex-1 space-y-2">
            {plan.features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                {f}
              </li>
            ))}
          </ul>
          <button
            onClick={() => choose(plan.id)}
            disabled={loadingId !== null}
            className={cn(
              "mt-5 w-full rounded-md px-4 py-2 text-sm font-medium",
              plan.highlight
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
              "disabled:opacity-60"
            )}
          >
            {loadingId === plan.id ? "Redirecting…" : "Start 14-day free trial"}
          </button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Create `src/app/(dashboard)/onboarding/plan/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionContext } from "@/lib/auth/session";
import { PlanCards } from "./plan-cards";

export default async function PlanSelectionPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");

  return (
    <div className="mx-auto max-w-4xl space-y-6 py-4">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-gray-900">
          Choose your plan
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Every plan starts with a 14-day free trial. No credit card charged
          today — cancel anytime.
        </p>
      </div>

      <PlanCards />

      <p className="text-center text-sm text-gray-500">
        Not ready?{" "}
        <Link href="/dashboard" className="font-medium text-blue-600 hover:text-blue-700">
          Skip for now and explore the app
        </Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 7: Verify + manual check**

Run: `npx tsc --noEmit` → zero errors.
Run: `npm run dev`, sign in, visit `/onboarding` and `/onboarding/plan`. Confirm banner renders on `/dashboard` (after Task 4 move) — for now it renders at `/`.

- [ ] **Step 8 (advisory): Commit** — "feat: onboarding banner, setup guide, plan picker"

---

## Task 4: Move dashboard to `/dashboard`, marketing route group + landing page

This is the highest-blast-radius task. Do it as one unit so the app is never in a broken half-moved state.

**Files:**
- Move: `src/app/(dashboard)/page.tsx` → `src/app/(dashboard)/dashboard/page.tsx`
- Modify: `src/middleware.ts`
- Modify: `src/components/dashboard/dashboard-shell.tsx`
- Modify: `src/app/(auth)/signup/page.tsx`
- Create: `src/app/(marketing)/layout.tsx`
- Create: `src/app/(marketing)/marketing-nav.tsx`
- Create: `src/app/(marketing)/faq-accordion.tsx`
- Create: `src/app/(marketing)/page.tsx`

- [ ] **Step 1: Move the dashboard page file**

Move `src/app/(dashboard)/page.tsx` to `src/app/(dashboard)/dashboard/page.tsx` (content unchanged except the Task-3 banner edits already applied). Use the filesystem move; the component code is identical. After moving, `(dashboard)` has no root `page.tsx`, freeing `/` for the marketing group.

- [ ] **Step 2: Update `src/middleware.ts`**

Add a public-routes constant under `AUTH_ROUTES`:

```typescript
// Public marketing/legal pages — reachable while signed out.
const PUBLIC_ROUTES = ["/", "/snapshot", "/terms", "/privacy"];
```

Replace the signed-out guard so public routes are allowed:

```typescript
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  // Signed-out user hitting a protected route → login (carry refreshed cookies).
  if (!user && !isAuthRoute && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectedFrom", pathname);
    return redirectWithCookies(url, response);
  }
```

Change the signed-in-on-auth-route redirect target from `/` to `/dashboard`:

```typescript
  // Signed-in user hitting /login or /signup → dashboard.
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return redirectWithCookies(url, response);
  }
```

> Signed-in users visiting `/` are intentionally NOT redirected — the landing page shows a "Go to Dashboard" button (spec).

- [ ] **Step 3: Update the sidebar nav in `src/components/dashboard/dashboard-shell.tsx`**

Change line 30 nav item and the `isActive` special case:

```typescript
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
```

```typescript
function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}
```

(Any logo/home `Link` in the shell pointing to `/` should also point to `/dashboard` — grep the file for `href="/"` and update.)

- [ ] **Step 4: Update post-signup redirect in `src/app/(auth)/signup/page.tsx`**

Change line 46:

```typescript
      window.location.assign("/onboarding/plan");
```

- [ ] **Step 5: Create the FAQ accordion `src/app/(marketing)/faq-accordion.tsx`**

```tsx
"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/helpers";

const FAQS: { q: string; a: string }[] = [
  {
    q: "Do I need GoHighLevel?",
    a: "GHL is required for the sync features. If you don't have GHL, the dispute management and client portal still work, but automations won't fire.",
  },
  {
    q: "Can I import clients from CDM/DisputeFox?",
    a: "Yes — CSV import is available.",
  },
  {
    q: "Is this legal / FCRA compliant?",
    a: "ClientDeck Pro is practice management software. Letters are templates for professional review. You are responsible for compliance in your jurisdiction.",
  },
  {
    q: "What happens to my data if I cancel?",
    a: "Export everything before cancelling. We retain data for 30 days after cancellation.",
  },
  {
    q: "Do you offer a white-label?",
    a: "Yes — the Pro plan includes white-label portal branding. The Agency plan removes 'Powered by ClientDeck Pro' entirely.",
  },
];

export function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="mx-auto max-w-2xl divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
      {FAQS.map((faq, i) => (
        <div key={faq.q}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
          >
            <span className="text-sm font-medium text-gray-900">{faq.q}</span>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-gray-400 transition-transform",
                open === i && "rotate-180"
              )}
            />
          </button>
          {open === i && (
            <p className="px-5 pb-4 text-sm text-gray-600">{faq.a}</p>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Create the marketing nav `src/app/(marketing)/marketing-nav.tsx`**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/ui/logo";

export function MarketingNav({ loggedIn }: { loggedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const links = [
    { href: "/#features", label: "Features" },
    { href: "/#pricing", label: "Pricing" },
    { href: "/snapshot", label: "GHL Snapshot" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-gray-800 bg-gray-950/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5">
        <Link href="/" className="flex items-center gap-2 text-white">
          <Logo className="h-6 w-auto" />
          <span className="font-semibold">ClientDeck Pro</span>
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm text-gray-300 hover:text-white"
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {loggedIn ? (
            <Link
              href="/dashboard"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="text-sm text-gray-300 hover:text-white">
                Login
              </Link>
              <Link
                href="/signup"
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Start Free Trial
              </Link>
            </>
          )}
        </div>

        <button
          className="text-gray-300 md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {open && (
        <div className="space-y-1 border-t border-gray-800 px-4 py-3 md:hidden">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="block py-2 text-sm text-gray-300"
              onClick={() => setOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          {loggedIn ? (
            <Link href="/dashboard" className="block py-2 text-sm font-medium text-blue-400">
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="block py-2 text-sm text-gray-300">
                Login
              </Link>
              <Link href="/signup" className="block py-2 text-sm font-medium text-blue-400">
                Start Free Trial
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
```

> Verify `Logo` accepts a `className` prop (read `src/components/ui/logo.tsx`). If it doesn't, either add `className?: string` to it or drop the prop.

- [ ] **Step 7: Create the marketing layout `src/app/(marketing)/layout.tsx`**

```tsx
import Link from "next/link";
import { getSessionContext } from "@/lib/auth/session";
import { MarketingNav } from "./marketing-nav";

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionContext();
  const loggedIn = Boolean(session);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <MarketingNav loggedIn={loggedIn} />
      <main className="flex-1">{children}</main>

      <footer className="border-t border-gray-800 bg-gray-950 text-gray-400">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="flex flex-col justify-between gap-8 md:flex-row">
            <div className="max-w-sm space-y-3">
              <span className="font-semibold text-white">ClientDeck Pro</span>
              <p className="text-sm">
                Practice management software for credit professionals. It is not
                a credit repair service and does not provide legal or financial
                advice.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-3">
              <div className="space-y-2">
                <p className="font-medium text-white">Product</p>
                <Link href="/#features" className="block hover:text-white">Features</Link>
                <Link href="/#pricing" className="block hover:text-white">Pricing</Link>
                <Link href="/snapshot" className="block hover:text-white">GHL Snapshot</Link>
              </div>
              <div className="space-y-2">
                <p className="font-medium text-white">Account</p>
                <Link href="/login" className="block hover:text-white">Login</Link>
                <Link href="/signup" className="block hover:text-white">Sign Up</Link>
              </div>
              <div className="space-y-2">
                <p className="font-medium text-white">Legal</p>
                <Link href="/terms" className="block hover:text-white">Terms of Service</Link>
                <Link href="/privacy" className="block hover:text-white">Privacy Policy</Link>
              </div>
            </div>
          </div>
          <p className="mt-10 border-t border-gray-800 pt-6 text-xs text-gray-500">
            © 2025 ClientDeck Pro. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
```

- [ ] **Step 8: Create the landing page `src/app/(marketing)/page.tsx`**

```tsx
import Link from "next/link";
import { getSessionContext } from "@/lib/auth/session";
import { PLANS } from "@/lib/billing/plans";
import { FaqAccordion } from "./faq-accordion";
import {
  Sparkles,
  RefreshCw,
  LayoutDashboard,
  Check,
  X,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";

const FEATURES = [
  {
    icon: Sparkles,
    title: "AI Letter Generation",
    body: "Claude AI writes FCRA-compliant dispute letters in seconds. Staff reviews, edits, and sends. No template library to maintain.",
  },
  {
    icon: RefreshCw,
    title: "Native GHL Sync",
    body: "When a deletion is logged, GHL automatically moves the pipeline, sends the win SMS, and updates the client portal. One action. Everything updates.",
  },
  {
    icon: LayoutDashboard,
    title: "Branded Client Portal",
    body: "Your clients get a magic-link portal with their scores, round history, and documents. Looks like your brand. Zero maintenance from your team.",
  },
];

const STEPS = [
  { n: 1, title: "Add the client", body: "Import from GHL or add manually — items entered in minutes." },
  { n: 2, title: "Generate round letters", body: "AI drafts the letters, you review, export the PDF, and mail." },
  { n: 3, title: "Log results", body: "The client gets notified and GHL updates automatically." },
];

type Cell = "yes" | "no" | "partial" | string;
const COMPARISON: { feature: string; cd: Cell; cdm: Cell; fox: Cell; bee: Cell }[] = [
  { feature: "Native GHL Integration", cd: "yes", cdm: "no", fox: "no", bee: "no" },
  { feature: "AI Letter Generation", cd: "yes", cdm: "yes", fox: "partial", bee: "no" },
  { feature: "Branded Client Portal", cd: "yes", cdm: "yes", fox: "yes", bee: "partial" },
  { feature: "Two-way CRM Sync", cd: "yes", cdm: "no", fox: "no", bee: "no" },
  { feature: "Auto Pipeline Updates", cd: "yes", cdm: "no", fox: "no", bee: "no" },
  { feature: "Starting Price", cd: "$79", cdm: "$97", fox: "$108", bee: "$49" },
];

function Mark({ v }: { v: Cell }) {
  if (v === "yes") return <Check className="mx-auto h-5 w-5 text-green-600" />;
  if (v === "no") return <X className="mx-auto h-5 w-5 text-gray-300" />;
  if (v === "partial") return <AlertTriangle className="mx-auto h-4 w-4 text-amber-500" />;
  return <span className="font-medium text-gray-900">{v}</span>;
}

export default async function LandingPage() {
  const session = await getSessionContext();
  const primaryCta = session
    ? { href: "/dashboard", label: "Go to Dashboard" }
    : { href: "/signup", label: "Start Free Trial" };

  return (
    <>
      {/* Hero */}
      <section className="bg-gray-950 text-white">
        <div className="mx-auto max-w-4xl px-4 py-24 text-center">
          <p className="mb-4 text-sm font-medium text-blue-400">
            Trusted by credit professionals using GoHighLevel
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            The Dispute Management Platform Built for GoHighLevel Agencies
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-300">
            AI-powered correspondence, automated client updates, and a branded
            client portal — all synced natively with the GHL you already run on.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={primaryCta.href}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              {primaryCta.label} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/snapshot"
              className="rounded-md border border-gray-700 px-6 py-3 text-sm font-semibold text-gray-200 hover:bg-gray-900"
            >
              Watch Demo — 3 min
            </Link>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="bg-white">
        <div className="mx-auto max-w-3xl px-4 py-20">
          <h2 className="text-center text-2xl font-semibold text-gray-900">
            Running credit repair on GHL + CDM means:
          </h2>
          <ul className="mx-auto mt-8 max-w-xl space-y-3">
            {[
              "Two systems, double the data entry",
              "Manual copy-paste to update clients",
              "Generic portals your clients never check",
              "No visibility into what's actually working",
            ].map((p) => (
              <li key={p} className="flex items-start gap-3 text-gray-700">
                <X className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                {p}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Solution / features */}
      <section id="features" className="bg-gray-50">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <h2 className="text-center text-2xl font-semibold text-gray-900">
            One platform. Everything synced.
          </h2>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                <f.icon className="h-8 w-8 text-blue-600" />
                <h3 className="mt-4 font-semibold text-gray-900">{f.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white">
        <div className="mx-auto max-w-5xl px-4 py-20">
          <h2 className="text-center text-2xl font-semibold text-gray-900">How it works</h2>
          <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="text-center">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 text-lg font-semibold text-white">
                  {s.n}
                </div>
                <h3 className="mt-4 font-semibold text-gray-900">{s.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-gray-50">
        <div className="mx-auto max-w-5xl px-4 py-20">
          <h2 className="text-center text-2xl font-semibold text-gray-900">
            Simple, transparent pricing
          </h2>
          <p className="mt-2 text-center text-sm text-gray-500">
            14 days free, no credit card required.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`flex flex-col rounded-lg border bg-white p-6 shadow-sm ${
                  plan.highlight ? "border-blue-500 ring-1 ring-blue-500" : "border-gray-200"
                }`}
              >
                <h3 className="font-semibold text-gray-900">{plan.name}</h3>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {plan.priceLabel}
                  <span className="text-sm font-normal text-gray-500">/mo</span>
                </p>
                <p className="mt-1 text-sm text-gray-500">{plan.clientsLabel}</p>
                <ul className="mt-4 flex-1 space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className={`mt-5 rounded-md px-4 py-2 text-center text-sm font-medium ${
                    plan.highlight
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  Start Free Trial
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="bg-white">
        <div className="mx-auto max-w-4xl px-4 py-20">
          <h2 className="text-center text-2xl font-semibold text-gray-900">
            How ClientDeck Pro compares
          </h2>
          <div className="mt-10 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="px-3 py-3 text-left font-medium">Feature</th>
                  <th className="px-3 py-3 text-center font-semibold text-blue-600">ClientDeck Pro</th>
                  <th className="px-3 py-3 text-center font-medium">CDM</th>
                  <th className="px-3 py-3 text-center font-medium">DisputeFox</th>
                  <th className="px-3 py-3 text-center font-medium">DisputeBee</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => (
                  <tr key={row.feature} className="border-b border-gray-100">
                    <td className="px-3 py-3 text-gray-700">{row.feature}</td>
                    <td className="bg-blue-50/50 px-3 py-3 text-center"><Mark v={row.cd} /></td>
                    <td className="px-3 py-3 text-center"><Mark v={row.cdm} /></td>
                    <td className="px-3 py-3 text-center"><Mark v={row.fox} /></td>
                    <td className="px-3 py-3 text-center"><Mark v={row.bee} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-gray-50">
        <div className="mx-auto max-w-3xl px-4 py-20">
          <h2 className="mb-10 text-center text-2xl font-semibold text-gray-900">
            Frequently asked questions
          </h2>
          <FaqAccordion />
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-gray-950 text-white">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <h2 className="text-3xl font-bold">Ready to run credit repair the modern way?</h2>
          <p className="mt-3 text-gray-300">Start your 14-day free trial. No credit card required.</p>
          <Link
            href={primaryCta.href}
            className="mt-8 inline-flex items-center gap-2 rounded-md bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            {primaryCta.label} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  );
}
```

- [ ] **Step 9: Verify + manual check**

Run: `npx tsc --noEmit` → zero errors.
Run: `npm run build` → succeeds (catches route-group `/` collisions).
Run: `npm run dev`. Signed OUT: `/` shows landing (no redirect to login), `/dashboard` redirects to login. Signed IN: `/` shows landing with "Go to Dashboard", `/dashboard` shows the app with the onboarding banner. Confirm sidebar "Dashboard" link highlights on `/dashboard`.

- [ ] **Step 10 (advisory): Commit** — "feat: marketing route group, landing page, dashboard moved to /dashboard"

---

## Task 5: Stripe subscriptions — checkout + webhook + billing wiring

**Files:**
- Modify: `src/app/(dashboard)/settings/billing/checkout-actions.ts` (replace Task-1 stub)
- Create: `src/app/api/stripe/webhook/route.ts`
- Modify: `src/app/(dashboard)/settings/billing/manage-billing-button.tsx`
- Create: `src/app/api/settings/billing-portal/route.ts` (agency-side customer portal)
- Modify: `src/lib/utils/license.ts` (confirm default limit)

**Interfaces:**
- Consumes: `stripe` (Task 1), `PLANS`/`stripePriceIdForPlan`/`planFromPriceId`/`maxClientsForPlan` (Task 1)
- Produces: `createCheckoutSession(plan: Plan): Promise<CheckoutResult>`

- [ ] **Step 1: Implement `createCheckoutSession` in `src/app/(dashboard)/settings/billing/checkout-actions.ts`**

```typescript
"use server";

import { getSessionContext } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";
import { stripePriceIdForPlan } from "@/lib/billing/plans";
import type { Plan } from "@/types";

export type CheckoutResult =
  | { success: true; url: string }
  | { success: false; error: string };

function appUrl(path: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://app.clientdeckpro.com";
  return `${base}${path}`;
}

export async function createCheckoutSession(plan: Plan): Promise<CheckoutResult> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };
  if (!process.env.STRIPE_SECRET_KEY) {
    return { success: false, error: "Billing is not configured yet." };
  }

  const priceId = stripePriceIdForPlan(plan);
  if (!priceId) {
    return { success: false, error: "That plan is not purchasable online." };
  }

  const { agency } = session;

  // Reuse or create the Stripe customer, and persist it immediately.
  let customerId = agency.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: agency.owner_email,
      name: agency.name,
      metadata: { agency_id: agency.id },
    });
    customerId = customer.id;
    const admin = createAdminClient();
    await admin
      .from("agencies")
      .update({ stripe_customer_id: customerId })
      .eq("id", agency.id);
  }

  try {
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 14,
        metadata: { agency_id: agency.id, plan },
      },
      metadata: { agency_id: agency.id, plan },
      success_url: appUrl("/settings/billing?checkout=success"),
      cancel_url: appUrl("/settings/billing?checkout=cancelled"),
      allow_promotion_codes: true,
    });
    if (!checkout.url) {
      return { success: false, error: "Stripe did not return a checkout URL." };
    }
    return { success: true, url: checkout.url };
  } catch (e) {
    console.error("createCheckoutSession failed:", e);
    return { success: false, error: "Could not start checkout. Try again." };
  }
}
```

- [ ] **Step 2: Create the webhook `src/app/api/stripe/webhook/route.ts`**

```typescript
import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { planFromPriceId, maxClientsForPlan } from "@/lib/billing/plans";
import type { Plan, PlanStatus } from "@/types";

// Stripe requires the raw, unparsed body for signature verification.
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "unconfigured" }, { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "no signature" }, { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (e) {
    console.error("Stripe signature verification failed:", e);
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }

  const admin = createAdminClient();

  async function findAgencyId(customerId: string | null | undefined) {
    if (!customerId) return null;
    const { data } = await admin
      .from("agencies")
      .select("id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    return data?.id ?? null;
  }

  async function applyPlan(
    agencyId: string,
    plan: Plan,
    status: PlanStatus,
    subscriptionId?: string
  ) {
    const update: Record<string, unknown> = {
      plan,
      plan_status: status,
      max_clients: maxClientsForPlan(plan),
    };
    if (subscriptionId) update.stripe_subscription_id = subscriptionId;
    await admin.from("agencies").update(update).eq("id", agencyId);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        const agencyId =
          (s.metadata?.agency_id as string | undefined) ??
          (await findAgencyId(s.customer as string));
        const plan = (s.metadata?.plan as Plan | undefined) ?? null;
        if (agencyId && plan) {
          await applyPlan(
            agencyId,
            plan,
            "active",
            (s.subscription as string) ?? undefined
          );
          await admin
            .from("agencies")
            .update({ stripe_customer_id: s.customer as string })
            .eq("id", agencyId);
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const agencyId = await findAgencyId(sub.customer as string);
        const priceId = sub.items.data[0]?.price?.id ?? null;
        const plan = priceId ? planFromPriceId(priceId) : null;
        if (agencyId && plan) {
          const status: PlanStatus =
            sub.status === "trialing"
              ? "trialing"
              : sub.status === "past_due"
              ? "past_due"
              : sub.status === "active"
              ? "active"
              : sub.status === "canceled"
              ? "cancelled"
              : "paused";
          await applyPlan(agencyId, plan, status, sub.id);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const agencyId = await findAgencyId(sub.customer as string);
        if (agencyId) {
          await admin
            .from("agencies")
            .update({ plan_status: "cancelled" })
            .eq("id", agencyId);
        }
        break;
      }

      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        const agencyId = await findAgencyId(inv.customer as string);
        if (agencyId) {
          await admin
            .from("agencies")
            .update({ plan_status: "past_due" })
            .eq("id", agencyId);
          await admin.from("activity_log").insert({
            agency_id: agencyId,
            actor_type: "system",
            action: "Payment failed",
            description: "A subscription invoice payment failed (past_due).",
          });
        }
        break;
      }

      default:
        break;
    }
  } catch (e) {
    console.error(`Error handling ${event.type}:`, e);
    return NextResponse.json({ error: "handler failure" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
```

> `actor_type: "system"` must be a valid `activity_log.actor_type` value. Check `001_initial_schema.sql` for the CHECK constraint on `actor_type`. If `"system"` isn't allowed, use the allowed value (e.g. `"staff"`) with `actor_id: null`, or whatever the existing GHL/cron code uses for automated entries.

- [ ] **Step 3: Confirm `checkClientLimit` limit source in `src/lib/utils/license.ts`**

`checkClientLimit` already reads `agency.max_clients` (kept current by the webhook's `applyPlan`). No code change needed beyond confirming the default fallback stays `15`. Leave as-is.

- [ ] **Step 4: Wire the agency customer-portal button.** Create `src/app/api/settings/billing-portal/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { stripe } from "@/lib/stripe/client";

function appUrl(path: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://app.clientdeckpro.com";
  return `${base}${path}`;
}

export async function GET() {
  const session = await getSessionContext();
  if (!session) return NextResponse.redirect(appUrl("/login"));

  const customerId = session.agency.stripe_customer_id;
  if (!customerId || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.redirect(appUrl("/settings/billing?error=no_customer"));
  }

  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: appUrl("/settings/billing"),
    });
    return NextResponse.redirect(portal.url);
  } catch (e) {
    console.error("Agency billing portal failed:", e);
    return NextResponse.redirect(appUrl("/settings/billing?error=stripe"));
  }
}
```

Rewrite `src/app/(dashboard)/settings/billing/manage-billing-button.tsx`:

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

export function ManageBillingButton() {
  return (
    <Button
      variant="secondary"
      onClick={() => window.location.assign("/api/settings/billing-portal")}
    >
      <ExternalLink className="h-4 w-4" />
      Manage Billing
    </Button>
  );
}
```

- [ ] **Step 5: Ensure the Stripe webhook route isn't body-parsed/cached.** Add to the top of `src/app/api/stripe/webhook/route.ts` (App Router reads raw body via `req.text()` already; just pin dynamic):

```typescript
export const dynamic = "force-dynamic";
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit` → zero errors.
Run: `npm run build` → succeeds.
Manual (optional, needs Stripe CLI): `stripe listen --forward-to localhost:3000/api/stripe/webhook` then trigger `checkout.session.completed` and confirm the agency row's `plan`, `plan_status`, `max_clients` update.

- [ ] **Step 7 (advisory): Commit** — "feat: Stripe subscription checkout + webhook + billing portal"

---

## Task 6: Snapshot table + public snapshot page + admin view

**Files:**
- Create: `supabase/migrations/008_snapshot_requests.sql`
- Create: `src/app/(marketing)/snapshot/actions.ts`
- Create: `src/app/(marketing)/snapshot/snapshot-request-form.tsx`
- Create: `src/app/(marketing)/snapshot/page.tsx`
- Create: `src/app/(dashboard)/admin/snapshot-requests/page.tsx`
- Create: `src/app/(dashboard)/admin/snapshot-requests/request-actions.ts`
- Create: `src/app/(dashboard)/admin/snapshot-requests/status-buttons.tsx`
- Create: `src/app/(marketing)/terms/page.tsx`
- Create: `src/app/(marketing)/privacy/page.tsx`
- Modify: `.env.local` — add `ADMIN_EMAIL`

- [ ] **Step 1: Create the migration `supabase/migrations/008_snapshot_requests.sql`**

```sql
CREATE TABLE snapshot_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  ghl_location_id TEXT,
  agency_name TEXT,
  message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'installed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reads/writes only through the service-role client (public insert via server
-- action, admin read via service role). RLS on with no policies = deny all to
-- anon/authenticated; service role bypasses RLS.
ALTER TABLE snapshot_requests ENABLE ROW LEVEL SECURITY;
```

Apply it to the linked Supabase project (via the Supabase MCP `apply_migration`, or `supabase db push`). Confirm the table exists before proceeding.

- [ ] **Step 2: Add `ADMIN_EMAIL` to `.env.local`**

Append under `# App`:

```
ADMIN_EMAIL=towfiqul5040@gmail.com
```

- [ ] **Step 3: Create `src/app/(marketing)/snapshot/actions.ts`**

```typescript
"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export interface SnapshotRequestResult {
  success: boolean;
  error?: string;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function submitSnapshotRequest(input: {
  name: string;
  email: string;
  ghlLocationId: string;
  agencyName: string;
  message: string;
}): Promise<SnapshotRequestResult> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();

  if (!name) return { success: false, error: "Name is required." };
  if (!isValidEmail(email)) return { success: false, error: "Enter a valid email." };

  const admin = createAdminClient();
  const { error } = await admin.from("snapshot_requests").insert({
    name,
    email,
    ghl_location_id: input.ghlLocationId.trim() || null,
    agency_name: input.agencyName.trim() || null,
    message: input.message.trim() || null,
  });

  if (error) {
    console.error("snapshot request insert failed:", error);
    return { success: false, error: "Could not submit your request. Try again." };
  }

  await notifyOwner({ name, email, ...input });
  return { success: true };
}

/** Best-effort owner notification via the Resend HTTP API (no SDK dependency). */
async function notifyOwner(input: {
  name: string;
  email: string;
  ghlLocationId: string;
  agencyName: string;
  message: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ADMIN_EMAIL;
  if (!apiKey || !to) return;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "ClientDeck Pro <onboarding@clientdeckpro.com>",
        to: [to],
        subject: `New snapshot request — ${input.name}`,
        text: [
          `Name: ${input.name}`,
          `Email: ${input.email}`,
          `Agency: ${input.agencyName || "—"}`,
          `GHL Location ID: ${input.ghlLocationId || "—"}`,
          `Message: ${input.message || "—"}`,
        ].join("\n"),
      }),
    });
  } catch (e) {
    console.error("Resend notification failed:", e);
  }
}
```

> `from` must be a Resend-verified domain sender. `onboarding@clientdeckpro.com` is a placeholder — if the domain isn't verified yet, Resend will reject; the `try/catch` keeps the request succeeding regardless.

- [ ] **Step 4: Create the form `src/app/(marketing)/snapshot/snapshot-request-form.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { submitSnapshotRequest } from "./actions";

export function SnapshotRequestForm() {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    const result = await submitSnapshotRequest({
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      ghlLocationId: String(formData.get("ghlLocationId") ?? ""),
      agencyName: String(formData.get("agencyName") ?? ""),
      message: String(formData.get("message") ?? ""),
    });
    setLoading(false);
    if (!result.success) {
      setError(result.error ?? "Something went wrong.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-8 text-center">
        <CheckCircle2 className="h-8 w-8 text-green-600" />
        <h3 className="font-semibold text-green-900">Request received</h3>
        <p className="text-sm text-green-700">
          We&apos;ll email you the snapshot import link shortly.
        </p>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <Field label="Name" htmlFor="name">
        <Input id="name" name="name" required autoComplete="name" />
      </Field>
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </Field>
      <Field label="Agency name" htmlFor="agencyName">
        <Input id="agencyName" name="agencyName" />
      </Field>
      <Field label="GHL Location ID" htmlFor="ghlLocationId" hint="Found in GHL → Settings → Business Info.">
        <Input id="ghlLocationId" name="ghlLocationId" />
      </Field>
      <Field label="Anything else?" htmlFor="message">
        <Textarea id="message" name="message" rows={3} />
      </Field>
      <Button type="submit" loading={loading} className="w-full">
        Request the Snapshot
      </Button>
    </form>
  );
}
```

> Verify `Field`/`Input`/`Textarea` exports in `src/components/ui/field.tsx`. If `Textarea` doesn't exist, use a plain `<textarea>` with the same classes as `Input`, or add a `Textarea` export mirroring `Input`.

- [ ] **Step 5: Create the public page `src/app/(marketing)/snapshot/page.tsx`**

```tsx
import { SnapshotRequestForm } from "./snapshot-request-form";
import { GitBranch, Workflow, ListChecks, Mail, MessageSquare, FileInput } from "lucide-react";

const INCLUDED = [
  { icon: GitBranch, label: "2 pipelines", detail: "Dispute lifecycle + onboarding" },
  { icon: Workflow, label: "8 workflows", detail: "Win SMS, round reminders, portal delivery" },
  { icon: ListChecks, label: "15+ custom fields", detail: "Scores, round state, portal link" },
  { icon: Mail, label: "12 email templates", detail: "Client updates & milestones" },
  { icon: MessageSquare, label: "15 SMS templates", detail: "Wins, reminders, check-ins" },
  { icon: FileInput, label: "Intake form", detail: "Auto-creates the client in ClientDeck Pro" },
];

export default function SnapshotPage() {
  return (
    <>
      <section className="bg-gray-950 text-white">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <h1 className="text-3xl font-bold sm:text-4xl">
            The GoHighLevel Snapshot for Credit Professionals
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-gray-300">
            Import a complete, ready-to-run credit-repair operating system into
            your GHL location — pre-wired to sync with ClientDeck Pro.
          </p>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <h2 className="text-center text-2xl font-semibold text-gray-900">What&apos;s included</h2>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {INCLUDED.map((item) => (
              <div key={item.label} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <item.icon className="h-6 w-6 text-blue-600" />
                <p className="mt-3 font-semibold text-gray-900">{item.label}</p>
                <p className="text-sm text-gray-600">{item.detail}</p>
              </div>
            ))}
          </div>

          {/* Pipeline mockup (SVG placeholder) */}
          <div className="mt-12 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-6">
            <div className="flex min-w-[640px] gap-3">
              {["New Lead", "Analysis", "Round 1 Sent", "Awaiting", "Deletion Won", "Completed"].map(
                (stage, i) => (
                  <div key={stage} className="flex-1">
                    <div className="rounded-t-md bg-blue-600 px-3 py-2 text-center text-xs font-medium text-white">
                      {stage}
                    </div>
                    <div className="space-y-2 rounded-b-md bg-white p-2 shadow-sm">
                      {Array.from({ length: 3 - (i % 3) }).map((_, j) => (
                        <div key={j} className="h-8 rounded border border-gray-100 bg-gray-50" />
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-gray-50">
        <div className="mx-auto max-w-lg px-4 py-16">
          <h2 className="mb-2 text-center text-2xl font-semibold text-gray-900">Request the Snapshot</h2>
          <p className="mb-8 text-center text-sm text-gray-500">
            Sign up for ClientDeck Pro and we&apos;ll send your personal import link.
          </p>
          <SnapshotRequestForm />
        </div>
      </section>
    </>
  );
}
```

- [ ] **Step 6: Create the admin server actions `src/app/(dashboard)/admin/snapshot-requests/request-actions.ts`**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { getSessionContext } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SnapshotRequestStatus } from "@/types";

async function requireAdmin(): Promise<boolean> {
  const session = await getSessionContext();
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  return Boolean(
    session && adminEmail && session.agency.owner_email.toLowerCase() === adminEmail
  );
}

export async function updateSnapshotRequestStatus(
  id: string,
  status: SnapshotRequestStatus
): Promise<{ success: boolean; error?: string }> {
  if (!(await requireAdmin())) return { success: false, error: "Forbidden." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("snapshot_requests")
    .update({ status })
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/snapshot-requests");
  return { success: true };
}
```

> The admin identity check uses `session.agency.owner_email` (a signed-in agency owner whose email matches `ADMIN_EMAIL`). Confirm that matches how you'll log in; if the admin is a `team_members` email rather than the owner, compare against `session.teamMember.email` instead.

- [ ] **Step 7: Create the status buttons `src/app/(dashboard)/admin/snapshot-requests/status-buttons.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/toast";
import type { SnapshotRequestStatus } from "@/types";
import { updateSnapshotRequestStatus } from "./request-actions";

export function StatusButtons({
  id,
  status,
}: {
  id: string;
  status: SnapshotRequestStatus;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function set(next: SnapshotRequestStatus) {
    setBusy(true);
    const res = await updateSnapshotRequestStatus(id, next);
    setBusy(false);
    if (!res.success) toast(res.error ?? "Failed.", "error");
  }

  return (
    <div className="flex gap-2">
      <button
        disabled={busy || status === "sent"}
        onClick={() => set("sent")}
        className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
      >
        Mark Sent
      </button>
      <button
        disabled={busy || status === "installed"}
        onClick={() => set("installed")}
        className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
      >
        Mark Installed
      </button>
    </div>
  );
}
```

- [ ] **Step 8: Create the admin page `src/app/(dashboard)/admin/snapshot-requests/page.tsx`**

```tsx
import { notFound, redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardHeader } from "@/components/ui/card";
import { cn, getStatusColor } from "@/lib/utils/helpers";
import { StatusButtons } from "./status-buttons";
import type { SnapshotRequest } from "@/types";

export default async function SnapshotRequestsAdminPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");

  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  if (!adminEmail || session.agency.owner_email.toLowerCase() !== adminEmail) {
    notFound();
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("snapshot_requests")
    .select("*")
    .order("created_at", { ascending: false });
  const requests = (data ?? []) as SnapshotRequest[];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Snapshot Requests"
          description="Internal queue for delivering the GHL snapshot."
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Agency</th>
                <th className="px-5 py-3 font-medium">GHL Location</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-gray-500">
                    No requests yet.
                  </td>
                </tr>
              ) : (
                requests.map((r) => (
                  <tr key={r.id}>
                    <td className="px-5 py-3 font-medium text-gray-900">{r.name}</td>
                    <td className="px-5 py-3 text-gray-600">{r.email}</td>
                    <td className="px-5 py-3 text-gray-600">{r.agency_name ?? "—"}</td>
                    <td className="px-5 py-3 font-mono text-xs text-gray-600">
                      {r.ghl_location_id ?? "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                          getStatusColor(r.status)
                        )}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3">
                      <StatusButtons id={r.id} status={r.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
```

> `getStatusColor` may not have mappings for `pending`/`sent`/`installed`; if it returns a default that's fine. Verify it exists in `helpers.ts` and accepts a string.

- [ ] **Step 9: Create the legal pages.** `src/app/(marketing)/terms/page.tsx`:

```tsx
export const metadata = { title: "Terms of Service — ClientDeck Pro" };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-2xl font-semibold text-gray-900">Terms of Service</h1>
      <p className="mt-2 text-sm text-gray-500">Last updated: 2025</p>
      <div className="prose prose-sm mt-8 max-w-none space-y-6 text-gray-700">
        <section>
          <h2 className="text-lg font-semibold text-gray-900">1. License</h2>
          <p>ClientDeck Pro is licensed software, not sold. No redistribution is permitted.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-gray-900">2. Nature of the Software</h2>
          <p>
            ClientDeck Pro is practice management software only. It is not legal
            or financial advice. Letters generated are templates; review by a
            qualified professional is recommended before sending.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-gray-900">3. Compliance</h2>
          <p>
            The buyer is responsible for their own CROA / FCRA compliance and any
            other applicable regulations in their jurisdiction.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-gray-900">4. Limitation of Liability</h2>
          <p>[Placeholder — to be completed by counsel.]</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-gray-900">5. Data Processing</h2>
          <p>[Placeholder — to be completed by counsel.]</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-gray-900">6. Cancellation Policy</h2>
          <p>[Placeholder — to be completed by counsel.]</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-gray-900">7. Governing Law</h2>
          <p>[Placeholder — to be completed by counsel.]</p>
        </section>
      </div>
    </div>
  );
}
```

`src/app/(marketing)/privacy/page.tsx`:

```tsx
export const metadata = { title: "Privacy Policy — ClientDeck Pro" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-2xl font-semibold text-gray-900">Privacy Policy</h1>
      <p className="mt-2 text-sm text-gray-500">Last updated: 2025</p>
      <div className="mt-8 max-w-none space-y-6 text-gray-700">
        <section>
          <h2 className="text-lg font-semibold text-gray-900">Data We Collect</h2>
          <p>
            Agency account information, and client data entered by the agency. We
            never store full Social Security Numbers — only the last four digits.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-gray-900">Where Data Lives</h2>
          <p>Data is hosted on Supabase (US region). Payments are processed by Stripe.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-gray-900">Data Deletion</h2>
          <p>
            To request deletion of your data, email us. We retain data for 30 days
            after cancellation, after which it is permanently removed.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-gray-900">Contact</h2>
          <p>towfiqul5040@gmail.com</p>
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 10: Verify + manual check**

Run: `npx tsc --noEmit` → zero errors.
Run: `npm run build` → succeeds.
Manual: visit `/snapshot` (signed out) and submit the form → confirm a row lands in `snapshot_requests`. Visit `/admin/snapshot-requests` signed in as `ADMIN_EMAIL` → see the row + status buttons work; signed in as a non-admin → `notFound()`. Visit `/terms` and `/privacy`.

- [ ] **Step 11 (advisory): Commit** — "feat: snapshot request page + admin queue + legal pages"

---

## Self-Review Notes (for the executor)

Cross-checks — all five were verified against the codebase while writing this plan:

1. **`CardHeader` title type** — ✅ CONFIRMED it's `title: string` and must be widened to `ReactNode` (Task 3, Step 4 — now a required prerequisite, not optional).
2. **`Textarea` / `Field` exports** — ✅ VERIFIED present in `src/components/ui/field.tsx` (`Field`, `Input`, `Select`, `Textarea` all exported). No change needed.
3. **`Logo` className** — ✅ VERIFIED `Logo({ className, variant })` accepts `className`. (Optional: pass `variant="light"` for the dark marketing nav.)
4. **`activity_log.actor_type` constraint** — ✅ VERIFIED the CHECK allows `'system'`, `'staff'`, `'client'`, `'ghl'`, `'stripe'`. The webhook's `actor_type: "system"` is valid; you may prefer `'stripe'` for the payment-failed row.
5. **`getStatusColor`** — ✅ VERIFIED signature is `getStatusColor(status: string): string` — tolerates any status. No change needed.
6. **Route-group `/` collision** — after moving the dashboard out of `(dashboard)`, only `(marketing)/page.tsx` defines `/`. `npm run build` will fail loudly if two route groups both define `/`; that's the guard.
7. **Naming consistency** — `markOnboardingStep(agencyId, step, value)` and `updateOnboardingStep(agencyId, step, value)` share the same arg order; `OnboardingStepKey` is used uniformly; `createCheckoutSession(plan)` returns `{ success, url } | { success, error }` and is consumed identically by `UpgradeButton` and `PlanCards`.

## Spec Coverage Map

- Task 1 (spec) Onboarding flow → Plan Tasks 2 + 3
- Task 2 (spec) Snapshot page + `snapshot_requests` → Plan Task 6 (migration renumbered 008)
- Task 3 (spec) Landing page + `(marketing)` layout → Plan Task 4
- Task 4 (spec) Terms + Privacy → Plan Task 6, Step 9
- Task 5 (spec) Stripe subscriptions + plan enforcement → Plan Tasks 1 + 5 (Stripe already installed; `/onboarding/plan` picker in Task 3)
- Task 6 (spec) Admin snapshot requests view → Plan Task 6, Steps 6–8
- Middleware `/` public + dashboard relocation → Plan Task 4, Steps 1–4
