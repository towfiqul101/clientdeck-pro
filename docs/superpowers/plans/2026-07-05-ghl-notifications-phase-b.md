# GHL Notifications — Phase B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the GHL notifications feature — pipeline-stage sync, a monthly client-progress notification, a self-serve GHL setup guide, and two small visibility improvements (client timeline badge, admin health widget).

**Architecture:** Extends Phase A's `src/lib/ghl/notifications.ts` service with a 10th notification type (`monthly_progress`) and a new sibling module `src/lib/ghl/pipeline.ts` for best-effort GHL opportunity/pipeline-stage sync, wired into the same event points Phase A already touches. One new migration adds `clients.ghl_opportunity_id`. One new cron sends the monthly digest. Everything is additive and best-effort, matching Phase A's established pattern.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (service-role client for cron/admin work), no test framework (see Global Constraints).

Full design: `docs/superpowers/specs/2026-07-04-ghl-notifications-pipeline-sync-design.md` (Phase B section — read this for the original intent; two corrections below supersede it, explained in each task).

## Global Constraints

- No test framework exists in this repo — do not add one. Verify every task with `npx tsc --noEmit`; the phase-closing task also runs `npm run build`.
- Do not install new npm packages.
- Every GHL/notification call is best-effort — it must never throw past its caller, matching Phase A's `sendGHLNotification` contract (already never-throws; new code in this phase must preserve that, wrapping in try/catch and returning early on failure).
- Follow existing conventions: `"use server"` actions return `{ success, error? }` (`ActionResult`), forms use `Field`/`Input`/`Select`/`Button`/`Card`/`CardHeader` from `src/components/ui/`, toasts via `useToast()`, cron routes gate on `isAuthorizedCron(req)` and use `createAdminClient()`.
- Vercel Hobby plan: `maxDuration` ≤ 60s; cron schedules must not fire more than once per day (a monthly cron firing on one specific day-of-month is fine).
- **Correction to the design spec's pipeline stages:** the spec proposed 10 invented stage keys (`analysis`, `ready_to_dispute`, `round_1_sent`, `round_1_results`, `round_2_sent`, `round_2_results`, `round_3_plus_sent`, `round_3_plus_results`, `goal_achieved`, `review_requested`). This repo's admin "Setup GHL Pipelines" tool (`src/app/api/admin/tools/setup-ghl-pipelines/route.ts` + `src/lib/ghl/setup-config.ts`) already creates a real 6-stage "Active Client" pipeline: `Onboarding → Analysis → Round 1 Sent → Awaiting Response → Round 2+ → Goal Achieved`. Of those 6, only three have a single, unambiguous app event that should move a client into them: sending round 1, sending round 2+, and completing a client. (`Onboarding`/`Analysis` happen before any round exists — no wiring point owns that transition — and `Awaiting Response` has no distinct trigger separate from "round sent.") This plan syncs exactly those three: `round_1_sent`, `round_2_plus`, `goal_achieved`. Staff can still move clients through the other stages manually in GHL.
- **Correction to the design spec's monthly-progress payload:** field names below use the actual `Client`/`NotifiableClient` column names introduced in Phase A, not the spec's inline sketch.

---

### Task 1: Migration + type extensions

**Files:**
- Create: `supabase/migrations/016_opportunity_id.sql`
- Modify: `src/types/index.ts`
- Modify: `src/lib/ghl/notifications.ts`

**Interfaces:**
- Produces: `Client.ghl_opportunity_id: string | null`, `AgencySettings.ghl_pipeline_id?: string`, `AgencySettings.ghl_pipeline_stages?: Partial<Record<PipelineStageKey, string>>`, `GHLNotificationType` gains `"monthly_progress"`, `NOTIFIABLE_CLIENT_COLUMNS`/`NotifiableClient` gain `ghl_opportunity_id` and `total_items_start` — consumed by Tasks 2-6.

- [ ] **Step 1: Create the migration**

```sql
-- 016_opportunity_id.sql — GHL opportunity id cache for pipeline-stage sync
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ghl_opportunity_id TEXT;
CREATE INDEX IF NOT EXISTS idx_clients_opportunity ON clients(ghl_opportunity_id);
```

Run this in the Supabase SQL editor against your project (same as every prior migration in this repo — there is no local migration runner).

- [ ] **Step 2: Add `ghl_opportunity_id` to the `Client` interface**

In `src/types/index.ts`, find the `Client` interface and add the field next to `ghl_contact_id`:

```ts
export interface Client {
  id: string;
  agency_id: string;
  ghl_contact_id: string | null;
  ghl_opportunity_id: string | null;
  first_name: string;
  // ...unchanged...
```

- [ ] **Step 3: Extend `AgencySettings`**

In the same file, find `AgencySettings` (it already has `ghl_webhook_triggers`/`owner_ghl_contact_id` from Phase A) and add:

```ts
export interface AgencySettings {
  // ...existing fields from Phase A unchanged...
  ghl_webhook_triggers?: Partial<Record<
    "round_sent" | "deletion_win" | "round_results_in" | "payment_failed" |
    "goal_achieved" | "portal_link" | "staff_new_client" | "staff_round_overdue" |
    "staff_next_round_ready" | "monthly_progress",
    string
  >>;
  owner_ghl_contact_id?: string;
  // Pipeline sync (Session 6, Phase B)
  ghl_pipeline_id?: string;
  ghl_pipeline_stages?: Partial<Record<
    "round_1_sent" | "round_2_plus" | "goal_achieved",
    string
  >>;
}
```

(Note the `ghl_webhook_triggers` inline union now includes `"monthly_progress"` — keep it in sync with `GHLNotificationType` below, same as the rest of this union has required since Phase A.)

- [ ] **Step 4: Extend `GHLNotificationType`, `NOTIFIABLE_CLIENT_COLUMNS`, `NotifiableClient`**

In `src/lib/ghl/notifications.ts`:

```ts
export type GHLNotificationType =
  | "round_sent"
  | "deletion_win"
  | "round_results_in"
  | "payment_failed"
  | "goal_achieved"
  | "portal_link"
  | "staff_new_client"
  | "staff_round_overdue"
  | "staff_next_round_ready"
  | "monthly_progress";

/** Columns every notify* helper needs off a `clients` row. Select this whenever a call site needs to notify. */
export const NOTIFIABLE_CLIENT_COLUMNS =
  "id, first_name, last_name, email, phone, ghl_contact_id, ghl_opportunity_id, portal_token, monthly_fee, total_items_deleted, total_items_start, service_start_date, score_eq_current, score_exp_current, score_tu_current, score_eq_start, score_exp_start, score_tu_start";

export type NotifiableClient = Pick<
  Client,
  | "id"
  | "first_name"
  | "last_name"
  | "email"
  | "phone"
  | "ghl_contact_id"
  | "ghl_opportunity_id"
  | "portal_token"
  | "monthly_fee"
  | "total_items_deleted"
  | "total_items_start"
  | "service_start_date"
  | "score_eq_current"
  | "score_exp_current"
  | "score_tu_current"
  | "score_eq_start"
  | "score_exp_start"
  | "score_tu_start"
>;
```

(This is the existing `GHLNotificationType`/`NOTIFIABLE_CLIENT_COLUMNS`/`NotifiableClient` from Phase A with `"monthly_progress"`, `ghl_opportunity_id`, and `total_items_start` added — everything else is unchanged.)

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: errors will appear in every file that builds a `NotifiableClient` object literal by hand (`src/app/api/ghl/onboarding/route.ts`, `src/app/api/cron/check-deadlines/route.ts`) because they're now missing `ghl_opportunity_id`/`total_items_start`. This is expected — fix both in this same step:

In `src/app/api/ghl/onboarding/route.ts`, the inline `NotifiableClient` literal (inside the `after()` block) needs two more fields:
```ts
          const notifClient: NotifiableClient = {
            id: clientId,
            first_name: clientData.first_name,
            last_name: clientData.last_name,
            email: clientData.email,
            phone: clientData.phone,
            ghl_contact_id: contactId,
            ghl_opportunity_id: null,
            portal_token: portalLink ? new URL(portalLink).searchParams.get("token") : null,
            monthly_fee: 0,
            total_items_deleted: 0,
            total_items_start: 0,
            service_start_date: new Date().toISOString().split("T")[0],
            score_eq_current: clientData.score_eq_current,
            score_exp_current: clientData.score_exp_current,
            score_tu_current: clientData.score_tu_current,
            score_eq_start: clientData.score_eq_start,
            score_exp_start: clientData.score_exp_start,
            score_tu_start: clientData.score_tu_start,
          };
```

In `src/app/api/cron/check-deadlines/route.ts`, the inline `NotifiableClient` literal similarly needs:
```ts
        const notifClient: NotifiableClient = {
          id: round.client.id,
          first_name: round.client.first_name,
          last_name: round.client.last_name,
          email: round.client.email,
          phone: round.client.phone,
          ghl_contact_id: round.client.ghl_contact_id,
          ghl_opportunity_id: null,
          portal_token: null,
          monthly_fee: 0,
          total_items_deleted: 0,
          total_items_start: 0,
          service_start_date: today,
          score_eq_current: null,
          score_exp_current: null,
          score_tu_current: null,
          score_eq_start: null,
          score_exp_start: null,
          score_tu_start: null,
        };
```

Re-run `npx tsc --noEmit` until clean.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/016_opportunity_id.sql src/types/index.ts src/lib/ghl/notifications.ts src/app/api/ghl/onboarding/route.ts src/app/api/cron/check-deadlines/route.ts
git commit -m "feat: add ghl_opportunity_id column + pipeline/monthly-progress type extensions"
```

---

### Task 2: GHL opportunity lookup + pipeline-stage sync module

**Files:**
- Modify: `src/lib/ghl/api.ts`
- Create: `src/lib/ghl/pipeline.ts`

**Interfaces:**
- Consumes: `ghlFetch` (private to `api.ts`), `moveGHLPipelineStage` (already exists in `api.ts`, unused until now), `createAdminClient` from `@/lib/supabase/admin`.
- Produces: `findOrCreateGHLOpportunity(contactId, pipelineId, opts): Promise<string | null>` (in `api.ts`), `PipelineStageKey`, `PipelineClient`, `moveClientPipelineStage(agency, client, stage): Promise<void>` (in `pipeline.ts`) — consumed by Task 4.

- [ ] **Step 1: Add `findOrCreateGHLOpportunity` to `src/lib/ghl/api.ts`**

Add after `moveGHLPipelineStage` (in the `PIPELINES / OPPORTUNITIES` section):

```ts
/**
 * Finds an existing GHL opportunity for this contact in the given pipeline,
 * or creates one in the pipeline's first stage if none exists. Best-effort —
 * returns null on any failure rather than throwing (mirrors the existing
 * `createGHLPipeline` best-effort pattern in this file).
 */
export async function findOrCreateGHLOpportunity(
  contactId: string,
  pipelineId: string,
  opts: GHLRequestOptions
): Promise<string | null> {
  try {
    const searchData = await ghlFetch(
      `/opportunities/search?location_id=${opts.locationId}&contact_id=${contactId}&pipeline_id=${pipelineId}`,
      opts
    );
    const existing = searchData?.opportunities?.[0];
    if (existing?.id) return existing.id as string;

    const created = await ghlFetch(`/opportunities/`, opts, {
      method: "POST",
      body: JSON.stringify({
        pipelineId,
        locationId: opts.locationId,
        contactId,
        name: "ClientDeck Pro Client",
        status: "open",
      }),
    });
    return created?.opportunity?.id ?? null;
  } catch (err) {
    console.error("findOrCreateGHLOpportunity failed:", err);
    return null;
  }
}
```

- [ ] **Step 2: Create `src/lib/ghl/pipeline.ts`**

```ts
import { createAdminClient } from "@/lib/supabase/admin";
import { findOrCreateGHLOpportunity, moveGHLPipelineStage } from "@/lib/ghl/api";
import type { Agency } from "@/types";

export type PipelineStageKey = "round_1_sent" | "round_2_plus" | "goal_achieved";

export interface PipelineClient {
  id: string;
  ghl_contact_id: string | null;
  ghl_opportunity_id: string | null;
}

/**
 * Moves a client's GHL opportunity to the configured stage for `stage`.
 * Best-effort: no-ops if the agency's pipeline/stage mapping, GHL credentials,
 * or the client's GHL contact id aren't configured. Never throws. Lazily
 * finds-or-creates the opportunity on first use and persists it on the
 * client row so later calls skip the lookup.
 */
export async function moveClientPipelineStage(
  agency: Agency,
  client: PipelineClient,
  stage: PipelineStageKey
): Promise<void> {
  const pipelineId = agency.settings?.ghl_pipeline_id;
  const stageId = agency.settings?.ghl_pipeline_stages?.[stage];
  if (
    !pipelineId ||
    !stageId ||
    !agency.ghl_api_key ||
    !agency.ghl_location_id ||
    !client.ghl_contact_id
  ) {
    return;
  }

  const opts = { apiKey: agency.ghl_api_key, locationId: agency.ghl_location_id };

  try {
    let opportunityId = client.ghl_opportunity_id;
    if (!opportunityId) {
      opportunityId = await findOrCreateGHLOpportunity(client.ghl_contact_id, pipelineId, opts);
      if (opportunityId) {
        const admin = createAdminClient();
        await admin.from("clients").update({ ghl_opportunity_id: opportunityId }).eq("id", client.id);
      }
    }
    if (!opportunityId) return;
    await moveGHLPipelineStage(opportunityId, stageId, opts);
  } catch (err) {
    console.error(`[Pipeline] Failed to move client ${client.id} to stage ${stage}:`, err);
  }
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/ghl/api.ts src/lib/ghl/pipeline.ts
git commit -m "feat: add GHL opportunity lookup and pipeline-stage sync"
```

---

### Task 3: Pipeline Configuration settings UI

**Files:**
- Modify: `src/app/(dashboard)/settings/actions.ts`
- Create: `src/app/(dashboard)/settings/ghl/pipeline-config-form.tsx`
- Modify: `src/app/(dashboard)/settings/ghl/page.tsx`

**Interfaces:**
- Produces: `updatePipelineConfig()` server action, `<PipelineConfigForm>` component.

- [ ] **Step 1: Add the server action**

In `src/app/(dashboard)/settings/actions.ts`, add the import and action (after `updateNotificationWebhooks`):

```ts
import type { PipelineStageKey } from "@/lib/ghl/pipeline";
```

```ts
/** Saves the agency's GHL pipeline id + stage-id mapping (agencies.settings). */
export async function updatePipelineConfig(input: {
  pipelineId: string;
  stages: Partial<Record<PipelineStageKey, string>>;
}): Promise<ActionResult> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  const cleanStages: Partial<Record<PipelineStageKey, string>> = {};
  for (const [key, value] of Object.entries(input.stages)) {
    if (typeof value === "string" && value.trim()) {
      cleanStages[key as PipelineStageKey] = value.trim();
    }
  }

  const supabase = await createServerSupabaseClient();
  const nextSettings: AgencySettings = {
    ...session.agency.settings,
    ghl_pipeline_id: input.pipelineId.trim() || undefined,
    ghl_pipeline_stages: cleanStages,
  };

  const { error } = await supabase
    .from("agencies")
    .update({ settings: nextSettings })
    .eq("id", session.agency.id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/settings/ghl");
  return { success: true };
}
```

- [ ] **Step 2: Create `pipeline-config-form.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { updatePipelineConfig } from "../actions";
import type { PipelineStageKey } from "@/lib/ghl/pipeline";

const STAGES: { key: PipelineStageKey; label: string }[] = [
  { key: "round_1_sent", label: "Round 1 Sent" },
  { key: "round_2_plus", label: "Round 2+ Sent" },
  { key: "goal_achieved", label: "Goal Achieved" },
];

interface PipelineConfigFormProps {
  initial: {
    pipelineId: string;
    stages: Partial<Record<PipelineStageKey, string>>;
  };
}

export function PipelineConfigForm({ initial }: PipelineConfigFormProps) {
  const { toast } = useToast();
  const [pipelineId, setPipelineId] = useState(initial.pipelineId);
  const [stages, setStages] = useState(initial.stages);
  const [pending, setPending] = useState(false);

  function setStage(key: PipelineStageKey, value: string) {
    setStages((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setPending(true);
    const result = await updatePipelineConfig({ pipelineId, stages });
    setPending(false);
    if (result.success) toast("Pipeline configuration saved.", "success");
    else toast(result.error ?? "Could not save.", "error");
  }

  return (
    <Card>
      <CardHeader
        title="Pipeline Configuration"
        description="Automatically move a client's GHL opportunity into the right stage of your Active Client pipeline as rounds progress. Paste the pipeline id and stage ids from GHL — Settings → Pipelines → open the pipeline, and copy ids from the URL/API."
      />
      <div className="space-y-4 p-6">
        <Field label="Pipeline ID" htmlFor="pipelineId">
          <Input
            id="pipelineId"
            value={pipelineId}
            onChange={(e) => setPipelineId(e.target.value)}
            placeholder="e.g. 5f9c2b1a3e4d5f6a7b8c9d0e"
            className="font-mono text-xs"
          />
        </Field>
        {STAGES.map(({ key, label }) => (
          <Field key={key} label={label} htmlFor={key}>
            <Input
              id={key}
              value={stages[key] ?? ""}
              onChange={(e) => setStage(key, e.target.value)}
              placeholder="Stage id from GHL"
              className="font-mono text-xs"
            />
          </Field>
        ))}
        <div className="flex justify-end">
          <Button onClick={handleSave} loading={pending}>
            Save Pipeline Config
          </Button>
        </div>
      </div>
    </Card>
  );
}
```

- [ ] **Step 3: Wire it into the GHL settings page**

In `src/app/(dashboard)/settings/ghl/page.tsx`, add the import and render it after `<NotificationWebhooksForm />` and before `<GHLSyncActivity />`:

```tsx
import { PipelineConfigForm } from "./pipeline-config-form";
```

```tsx
      <NotificationWebhooksForm
        initial={{
          triggers: agency.settings?.ghl_webhook_triggers ?? {},
          ownerGhlContactId: agency.settings?.owner_ghl_contact_id ?? "",
        }}
      />
      <PipelineConfigForm
        initial={{
          pipelineId: agency.settings?.ghl_pipeline_id ?? "",
          stages: agency.settings?.ghl_pipeline_stages ?? {},
        }}
      />
      <GHLSyncActivity />
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual verification**

Run `npm run dev`, open Settings → GHL, fill in a pipeline id and one stage id, save, reload, confirm persisted values. Confirm blank stage inputs are dropped (not saved as empty strings) by checking the saved `agencies.settings.ghl_pipeline_stages` only contains keys you actually filled in.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(dashboard\)/settings/actions.ts src/app/\(dashboard\)/settings/ghl/pipeline-config-form.tsx src/app/\(dashboard\)/settings/ghl/page.tsx
git commit -m "feat: add pipeline configuration UI"
```

---

### Task 4: Wire pipeline-stage sync into round-sent and client-completed events

**Files:**
- Modify: `src/app/(dashboard)/clients/[id]/rounds/actions.ts`

**Interfaces:**
- Consumes: `moveClientPipelineStage`, `type PipelineStageKey` from `@/lib/ghl/pipeline` (Task 2).

- [ ] **Step 1: Add the import**

```ts
import { moveClientPipelineStage } from "@/lib/ghl/pipeline";
```

- [ ] **Step 2: Add pipeline sync to `markRoundSent`'s existing `Promise.allSettled` block**

Find the `Promise.allSettled([...])` array built in `markRoundSent` (added in Phase A's final fix round — contains the `runGhlSync` IIFE and the `notifyRoundSent` IIFE). Add a third element:

```ts
    (async () => {
      if (notifClient) {
        await moveClientPipelineStage(
          session.agency,
          notifClient,
          round.round_number === 1 ? "round_1_sent" : "round_2_plus"
        );
      }
    })(),
```

(`notifClient` already satisfies `PipelineClient`'s shape — `{id, ghl_contact_id, ghl_opportunity_id}` — since Task 1 added `ghl_opportunity_id` to `NotifiableClient`.)

- [ ] **Step 3: Add pipeline sync to `markClientCompleted`'s existing `Promise.allSettled` block**

Find the `Promise.allSettled([...])` array in `markClientCompleted`. Add a third element:

```ts
    (async () => {
      if (notifClient) {
        await moveClientPipelineStage(session.agency, notifClient, "goal_achieved");
      }
    })(),
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual verification**

With `.env.local` available, run `npm run dev`. Since pipeline config is unset for any seeded agency (Task 3's form was only smoke-tested, not saved for real use), `moveClientPipelineStage` will no-op via its first guard (`!pipelineId`). Confirm by code review that this guard is the first check in the function, so calling it in these two flows before configuring a pipeline has zero effect and cannot error. If you configure a real pipeline id/stage ids for a seeded agency with real GHL credentials, mark a round sent and confirm no errors in the console.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(dashboard\)/clients/\[id\]/rounds/actions.ts
git commit -m "feat: wire pipeline-stage sync into round-sent and client-completed events"
```

---

### Task 5: Monthly-progress notification type + config UI + test payload

**Files:**
- Modify: `src/lib/ghl/notifications.ts`
- Modify: `src/app/api/ghl/test-webhook/route.ts`
- Modify: `src/app/(dashboard)/settings/ghl/notification-webhooks-form.tsx`

**Interfaces:**
- Produces: `MonthlyProgressSummary`, `notifyMonthlyProgress(agency, client, summary)` — consumed by Task 6.

- [ ] **Step 1: Add `notifyMonthlyProgress` to `notifications.ts`**

Add after `notifyStaffRoundOverdue` (the last helper in the file):

```ts
export interface MonthlyProgressSummary {
  scoreEq: number | null;
  scoreExp: number | null;
  scoreTu: number | null;
  totalDeletions: number;
  totalItems: number;
  currentRound: number;
  monthsInProgram: number;
}

export async function notifyMonthlyProgress(
  agency: Agency,
  client: NotifiableClient,
  summary: MonthlyProgressSummary
) {
  return sendGHLNotification(
    agency,
    "monthly_progress",
    {
      contactId: client.ghl_contact_id ?? "",
      firstName: client.first_name,
      lastName: client.last_name,
      email: client.email ?? undefined,
      data: {
        score_eq: summary.scoreEq ?? 0,
        score_exp: summary.scoreExp ?? 0,
        score_tu: summary.scoreTu ?? 0,
        total_deletions: summary.totalDeletions,
        total_items: summary.totalItems,
        current_round: summary.currentRound,
        months_in_program: summary.monthsInProgram,
        portal_link: portalLinkFor(client),
      },
    },
    { agencyId: agency.id, clientId: client.id }
  );
}
```

(No Resend template is added for this type — it's an optional periodic digest, not a transactional event, so it correctly falls through to log-only when neither GHL nor a template exists. This matches Phase A's existing `RESEND_TEMPLATED_TYPES` list in `resend-fallback-banner.tsx`, which should NOT be edited in this task — `monthly_progress` deliberately stays outside it.)

- [ ] **Step 2: Add the test payload**

In `src/app/api/ghl/test-webhook/route.ts`, add an entry to `TEST_PAYLOADS` (TypeScript will require this since it's typed `Record<GHLNotificationType, ...>` and now has 10 keys):

```ts
  monthly_progress: {
    score_eq: 650,
    score_exp: 645,
    score_tu: 648,
    total_deletions: 3,
    total_items: 8,
    current_round: 2,
    months_in_program: 4,
    portal_link: "https://app.clientdeckpro.com/portal?token=test",
  },
```

- [ ] **Step 3: Add the UI field**

In `src/app/(dashboard)/settings/ghl/notification-webhooks-form.tsx`, add `monthly_progress` to `CLIENT_TYPES`:

```ts
const CLIENT_TYPES: { key: GHLNotificationType; label: string }[] = [
  { key: "round_sent", label: "Round Sent to Bureaus" },
  { key: "deletion_win", label: "Deletion Win" },
  { key: "round_results_in", label: "Round Results In" },
  { key: "goal_achieved", label: "Goal Achieved" },
  { key: "payment_failed", label: "Payment Failed" },
  { key: "portal_link", label: "Portal Link Sent" },
  { key: "monthly_progress", label: "Monthly Progress Update" },
];
```

No other change is needed in this file — the existing `.map()` rendering already covers any entry added to `CLIENT_TYPES`.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors (this step will also surface if Step 2's `TEST_PAYLOADS` entry was missed, since the type is exhaustive).

- [ ] **Step 5: Manual verification**

Run `npm run dev`, open Settings → GHL, confirm "Monthly Progress Update" now appears as a 7th field under Client Notifications with a working Test button (test against `https://httpbin.org/post` or similar).

- [ ] **Step 6: Commit**

```bash
git add src/lib/ghl/notifications.ts src/app/api/ghl/test-webhook/route.ts src/app/\(dashboard\)/settings/ghl/notification-webhooks-form.tsx
git commit -m "feat: add monthly-progress notification type"
```

---

### Task 6: Monthly-progress cron

**Files:**
- Create: `src/app/api/cron/monthly-progress/route.ts`
- Modify: `vercel.json`

**Interfaces:**
- Consumes: `notifyMonthlyProgress`, `NOTIFIABLE_CLIENT_COLUMNS`, `type NotifiableClient` from `@/lib/ghl/notifications`.

- [ ] **Step 1: Create the cron route**

```ts
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { notifyMonthlyProgress, NOTIFIABLE_CLIENT_COLUMNS, type NotifiableClient } from "@/lib/ghl/notifications";
import type { Agency } from "@/types";

export const maxDuration = 60;

function monthsSince(dateStr: string): number {
  const start = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30));
}

/**
 * Sends a monthly progress-summary notification to every active client with
 * a GHL contact id, across every agency. Runs on the 1st of each month.
 * Dispatches concurrently per agency (Promise.allSettled) to stay inside the
 * Hobby-plan 60s budget; if the client base grows large enough to risk that
 * ceiling, this will need pagination/chunking across invocations — not
 * built now (YAGNI).
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();

  const { data: agencies } = await admin.from("agencies").select("*");
  let sent = 0;
  let attempted = 0;

  for (const agency of agencies ?? []) {
    const { data: clients } = await admin
      .from("clients")
      .select(`${NOTIFIABLE_CLIENT_COLUMNS}, current_round`)
      .eq("agency_id", agency.id)
      .eq("status", "active")
      .not("ghl_contact_id", "is", null);

    if (!clients || clients.length === 0) continue;
    attempted += clients.length;

    const results = await Promise.allSettled(
      clients.map((client) =>
        notifyMonthlyProgress(agency as Agency, client as NotifiableClient, {
          scoreEq: client.score_eq_current,
          scoreExp: client.score_exp_current,
          scoreTu: client.score_tu_current,
          totalDeletions: client.total_items_deleted,
          totalItems: client.total_items_start,
          currentRound: client.current_round,
          monthsInProgram: monthsSince(client.service_start_date),
        })
      )
    );
    sent += results.filter((r) => r.status === "fulfilled").length;
  }

  return NextResponse.json({ attempted, sent });
}
```

- [ ] **Step 2: Add the cron schedule**

In `vercel.json`, add to the `crons` array:

```json
{
  "crons": [
    { "path": "/api/cron/check-deadlines", "schedule": "0 13 * * *" },
    { "path": "/api/cron/retry-ghl-syncs", "schedule": "0 1 * * *" },
    { "path": "/api/cron/auto-create-rounds", "schedule": "0 14 * * *" },
    { "path": "/api/cron/monthly-progress", "schedule": "0 9 1 * *" }
  ]
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Run: `curl "http://localhost:3000/api/cron/monthly-progress?secret=$CRON_SECRET"` against a dev server. Expect `{ "attempted": <n>, "sent": <n> }` with no thrown errors, `n` reflecting however many active, GHL-linked clients exist in the seeded database (0 is a valid result).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/monthly-progress/route.ts vercel.json
git commit -m "feat: add monthly-progress cron"
```

---

### Task 7: GHL setup guide page

**Files:**
- Create: `src/app/(dashboard)/onboarding/ghl-setup/page.tsx`
- Modify: `src/app/(dashboard)/settings/ghl/page.tsx`

**Interfaces:**
- None (static documentation page + one link).

- [ ] **Step 1: Create the setup guide page**

Follow the existing `Card`/`CardHeader` pattern already used in `src/app/(dashboard)/onboarding/page.tsx` (read that file for the exact visual style before writing this one). Create:

```tsx
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { ArrowLeft, MessageSquare } from "lucide-react";

interface WorkflowDoc {
  title: string;
  fields: string[];
  suggestedCopy: string;
}

const WORKFLOWS: WorkflowDoc[] = [
  {
    title: "Round Sent to Bureaus (Client SMS)",
    fields: ["{{contact.first_name}}", "{{round_number}}", "{{items_disputed}}", "{{response_deadline}}", "{{portal_link}}"],
    suggestedCopy:
      "Hi {{contact.first_name}}! Your Round {{round_number}} dispute letters have been sent to all 3 bureaus ({{items_disputed}} items). They have until {{response_deadline}} to respond. Track your progress: {{portal_link}}",
  },
  {
    title: "Deletion Win (Client SMS)",
    fields: ["{{deletions_this_round}}", "{{total_deletions}}", "{{deleted_items_list}}", "{{portal_link}}"],
    suggestedCopy:
      "Great news, {{contact.first_name}}! {{deletions_this_round}} item(s) were removed this round. Total deleted so far: {{total_deletions}}. View your progress: {{portal_link}}",
  },
  {
    title: "Round Results In (Client SMS)",
    fields: ["{{round_number}}", "{{total_deletions}}", "{{total_verified}}", "{{total_no_response}}", "{{has_wins}}", "{{portal_link}}"],
    suggestedCopy:
      "Hi {{contact.first_name}}, your Round {{round_number}} results are in — {{total_deletions}} deleted, {{total_verified}} verified. Full details: {{portal_link}}",
  },
  {
    title: "Goal Achieved (Client SMS + Email)",
    fields: ["{{total_deletions}}", "{{score_improvement}}", "{{months_in_program}}", "{{review_link}}", "{{portal_link}}"],
    suggestedCopy:
      "Congratulations {{contact.first_name}}! You've reached your credit goal — {{total_deletions}} items removed, +{{score_improvement}} points. It's been an honor working with you. Mind leaving us a review? {{review_link}}",
  },
  {
    title: "Payment Failed (Client SMS)",
    fields: ["{{monthly_fee}}", "{{portal_link}}", "{{agency_phone}}"],
    suggestedCopy:
      "Hi {{contact.first_name}}, your payment of ${{monthly_fee}}/month didn't go through. Update your payment method here: {{portal_link}} or call us at {{agency_phone}}.",
  },
  {
    title: "Portal Link Sent (Client SMS)",
    fields: ["{{portal_link}}", "{{agency_name}}"],
    suggestedCopy: "Hi {{contact.first_name}}, here's your {{agency_name}} client portal link: {{portal_link}}",
  },
  {
    title: "Monthly Progress Update (Client SMS)",
    fields: ["{{score_eq}}", "{{score_exp}}", "{{score_tu}}", "{{total_deletions}}", "{{total_items}}", "{{current_round}}", "{{portal_link}}"],
    suggestedCopy:
      "Hi {{contact.first_name}}, your monthly update: {{total_deletions}} of {{total_items}} items resolved, currently on Round {{current_round}}. View details: {{portal_link}}",
  },
  {
    title: "New Client Onboarded (Staff alert)",
    fields: ["{{client_name}}", "{{client_email}}", "{{client_phone}}", "{{dashboard_link}}"],
    suggestedCopy: "New client onboarded: {{client_name}} ({{client_email}}, {{client_phone}}). Review: {{dashboard_link}}",
  },
  {
    title: "Round Overdue Alert (Staff alert)",
    fields: ["{{client_name}}", "{{round_number}}", "{{days_overdue}}", "{{dashboard_link}}"],
    suggestedCopy: "{{client_name}}'s Round {{round_number}} is {{days_overdue}} days overdue — bureau hasn't responded. Escalate: {{dashboard_link}}",
  },
  {
    title: "Next Round Ready (Staff alert)",
    fields: ["{{client_name}}", "{{round_number}}", "{{dashboard_link}}"],
    suggestedCopy: "Round {{round_number}} is ready for {{client_name}} — review and generate letters: {{dashboard_link}}",
  },
];

export default function GHLSetupGuidePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/settings/ghl"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back to GHL Settings
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">GHL Workflow Setup Guide</h1>
        <p className="mt-1 text-sm text-gray-500">
          ClientDeck Pro sends notifications to your own GHL workflows via webhooks, so
          SMS and email look like they come from your agency — not from ClientDeck Pro.
        </p>
      </div>

      <Card>
        <CardHeader title="How it works" />
        <div className="space-y-2 p-6 text-sm text-gray-600">
          <p>1. In GHL, create a workflow with <strong>Custom Webhook</strong> as the trigger.</p>
          <p>2. Build SMS/email actions using the data fields listed below for each event.</p>
          <p>3. Copy the workflow&apos;s webhook trigger URL from GHL.</p>
          <p>
            4. Paste it into{" "}
            <Link href="/settings/ghl" className="font-medium text-blue-600 hover:text-blue-700">
              Settings → GHL → Notification Webhooks
            </Link>
            .
          </p>
        </div>
      </Card>

      {WORKFLOWS.map((wf) => (
        <Card key={wf.title}>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-blue-600" /> {wf.title}
              </span>
            }
          />
          <div className="space-y-3 p-6 text-sm">
            <div>
              <p className="mb-1.5 font-medium text-gray-700">Data fields available in GHL:</p>
              <div className="flex flex-wrap gap-1.5">
                {wf.fields.map((f) => (
                  <code key={f} className="rounded bg-gray-100 px-2 py-1 font-mono text-xs text-gray-700">
                    {f}
                  </code>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 font-medium text-gray-700">Suggested SMS/email copy:</p>
              <code className="block rounded-md bg-gray-900 px-3 py-2 font-mono text-xs leading-relaxed text-gray-100">
                {wf.suggestedCopy}
              </code>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Link to it from Settings → GHL**

In `src/app/(dashboard)/settings/ghl/page.tsx`, add a link near the top of the page (right after the opening `<div className="space-y-6">`):

```tsx
import Link from "next/link";
import { BookOpen } from "lucide-react";
```

```tsx
  return (
    <div className="space-y-6">
      <Link
        href="/onboarding/ghl-setup"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
      >
        <BookOpen className="h-4 w-4" /> View the full GHL workflow setup guide
      </Link>
      <GHLForm
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Run `npm run dev`, visit `/onboarding/ghl-setup` directly and via the new link on `/settings/ghl`, confirm the page renders all 10 workflow cards without errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/onboarding/ghl-setup/page.tsx src/app/\(dashboard\)/settings/ghl/page.tsx
git commit -m "feat: add GHL workflow setup guide page"
```

---

### Task 8: Notification badge in the client Timeline tab

**Files:**
- Modify: `src/app/(dashboard)/clients/[id]/timeline/page.tsx`

**Interfaces:**
- None (reads `ActivityLog.metadata` already produced by Phase A's `sendGHLNotification`: `{ notification_type: string, method: "ghl" | "resend" | "none", contact_id: string }`).

- [ ] **Step 1: Add a method badge to `notification_sent` entries**

Replace the `<li>` rendering block:

```tsx
            <li key={entry.id} className="relative">
              <span
                className={cn(
                  "absolute -left-[2.15rem] flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white",
                  meta.className
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium text-gray-900">
                  {entry.action}
                </p>
                <time className="shrink-0 text-xs text-gray-400">
                  {formatTimestamp(entry.created_at)}
                </time>
              </div>
              {entry.description && (
                <p className="mt-0.5 text-sm text-gray-500">
                  {entry.description}
                </p>
              )}
              <span className="mt-1 inline-block text-xs text-gray-400">
                {meta.label}
              </span>
            </li>
```

with:

```tsx
            <li key={entry.id} className="relative">
              <span
                className={cn(
                  "absolute -left-[2.15rem] flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white",
                  meta.className
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium text-gray-900">
                  {entry.action}
                </p>
                <time className="shrink-0 text-xs text-gray-400">
                  {formatTimestamp(entry.created_at)}
                </time>
              </div>
              {entry.description && (
                <p className="mt-0.5 text-sm text-gray-500">
                  {entry.description}
                </p>
              )}
              <div className="mt-1 flex items-center gap-2">
                <span className="inline-block text-xs text-gray-400">
                  {meta.label}
                </span>
                {entry.action === "notification_sent" && (
                  <NotificationMethodBadge
                    method={(entry.metadata as { method?: string } | null)?.method}
                  />
                )}
              </div>
            </li>
```

- [ ] **Step 2: Add the badge component**

Add this function above `ClientTimelinePage` in the same file:

```tsx
function NotificationMethodBadge({ method }: { method?: string }) {
  if (method === "ghl") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
        ✓ GHL
      </span>
    );
  }
  if (method === "resend") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
        ⚠ Email fallback
      </span>
    );
  }
  return null;
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Open a client's Timeline tab that has at least one `notification_sent` activity_log entry (created during Phase A's own manual testing, if any seeded client has one) and confirm the green "✓ GHL" or amber "⚠ Email fallback" badge renders next to the actor label. If no such row exists in the seeded database, verify by temporarily inserting a test row via the Supabase SQL editor (`insert into activity_log (agency_id, client_id, actor_type, action, description, metadata) values (...)` with `action = 'notification_sent'` and `metadata = '{"method":"ghl"}'`), reload the page, confirm the badge, then delete the test row.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/clients/\[id\]/timeline/page.tsx
git commit -m "feat: show GHL/Resend method badge on notification timeline entries"
```

---

### Task 9: Admin notification health widget + phase close-out

**Files:**
- Modify: `src/components/admin/agency-slideover.tsx`

**Interfaces:**
- None (reads `data.agency.settings.ghl_webhook_triggers`, already present on the full `Agency` row `AgencyPanelData.agency` already carries — no backend change needed).

This is also the PHASE-CLOSING task — after implementing, run the FULL build (`npm run build`), not just `npx tsc --noEmit`, since it's the last task before the whole-branch review.

- [ ] **Step 1: Add a notification-health block to the `GhlTab` component**

In `src/components/admin/agency-slideover.tsx`, find the `GhlTab` function. Add this constant near the top of the file (with the other module-level constants like `TABS`):

```ts
const WIRED_NOTIFICATION_TYPES = [
  "round_sent",
  "deletion_win",
  "round_results_in",
  "goal_achieved",
  "payment_failed",
  "portal_link",
  "staff_new_client",
  "staff_round_overdue",
  "staff_next_round_ready",
  "monthly_progress",
] as const;
```

Then, inside `GhlTab`, right after the existing "Connected / Not configured" status block (`<div className="flex items-center gap-2 text-sm"> ... last sync ...`) and before the `<div className="flex gap-2">` (Test Connection / Save buttons), add:

```tsx
      <div className="rounded-lg border border-gray-200 p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Notification Status
        </h4>
        <dl className="mt-2 space-y-1 text-sm">
          {WIRED_NOTIFICATION_TYPES.map((type) => {
            const configured = Boolean(a.settings?.ghl_webhook_triggers?.[type]);
            return (
              <div key={type} className="flex items-center justify-between gap-2">
                <dt className="text-gray-600">{type}</dt>
                <dd className="flex items-center gap-1.5">
                  <span className={cn("h-1.5 w-1.5 rounded-full", configured ? "bg-green-500" : "bg-gray-300")} />
                  <span className={configured ? "text-green-700" : "text-gray-400"}>
                    {configured ? "Configured" : "Not set"}
                  </span>
                </dd>
              </div>
            );
          })}
        </dl>
        <p className="mt-3 text-xs text-gray-500">
          {WIRED_NOTIFICATION_TYPES.filter((t) => a.settings?.ghl_webhook_triggers?.[t]).length} of{" "}
          {WIRED_NOTIFICATION_TYPES.length} configured
        </p>
      </div>
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Full build (phase-closing gate)**

Run: `npm run build`
Expected: build succeeds with no new errors or warnings introduced by this phase.

- [ ] **Step 4: Manual verification**

Log into `/admin` (via `ADMIN_PASSWORD`), open the agency slide-over for any agency, click the "GHL Config" tab, confirm the "Notification Status" block renders 10 rows with correct configured/not-set dots matching whatever that agency's `ghl_webhook_triggers` actually has saved (cross-check against what Settings → GHL shows for that same agency, if you have access, or against the raw `agencies.settings` JSONB via Supabase).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/agency-slideover.tsx
git commit -m "feat: add admin notification health widget"
```

---

## Phase B Self-Review Notes (for the executor)

- Every B-item from the design doc is covered: B1 (pipeline sync, Tasks 1-2 + 4), B2 (monthly cron, Tasks 5-6), B3 (setup guide, Task 7), B4 (timeline badge, Task 8), B5 (admin widget, Task 9). Task 3 (pipeline config UI) wasn't separately enumerated in the original spec's B-list but is required for B1 to be usable by an agency — folded in here as its own task since it's a distinct, independently-testable UI surface.
- Two corrections from the original design spec are called out explicitly in Global Constraints: the pipeline stage list (3 real, automatable stages instead of 10 invented ones) and the monthly-progress payload's field names (matching Phase A's actual `NotifiableClient` shape).
- No test framework is added, per Global Constraints — every task verifies via `npx tsc --noEmit`, with `npm run build` as the final phase-closing gate in Task 9.
