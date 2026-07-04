# GHL Notifications + Pipeline Sync — Design

Status: approved, ready for implementation plan
Date: 2026-07-04
Supersedes: Sessions 3 & 4 (deferred per CLAUDE.md "Build Status")

## Goal

Wire every client- and staff-facing notification through the agency's own GHL
account (their own LC phone number / email) instead of ClientDeck Pro sending
anything directly, so messages look agency-branded. Also finish the GHL
pipeline-stage sync that today only has a raw API primitive
(`moveGHLPipelineStage`) with nothing calling it.

## Relationship to existing systems (read this first)

ClientDeck Pro already has a GHL integration layer that this design does
**not** touch or replace:

- `src/lib/ghl/api.ts` — `syncRoundSent`, `syncDeletionAchieved`,
  `syncScoreUpdate`, `syncClientCompleted` update GHL custom fields / tags /
  notes / tasks directly via the API. Wrapped by `runGhlSync()` in
  `src/lib/ghl/sync.ts`, which logs every attempt to `ghl_sync_log` (visible
  in Settings → GHL → sync activity, retried by
  `/api/cron/retry-ghl-syncs`).
- The Session 5 tag-based "Send Review Request" button
  (`send-review-request-button.tsx` → `/api/ghl/send-review-request`) fires
  the `review-requested` tag to trigger the agency's own GHL workflow.

Both stay exactly as they are. This design adds a **second, independent
channel**: `src/lib/ghl/notifications.ts` POSTs directly to an
agency-configured GHL "Custom Webhook" trigger URL (or falls back to Resend)
purely to drive SMS/email content. The two channels run side by side —
wiring call sites fire both via `Promise.allSettled`, never blocking on
either.

Resend today is only used for admin-triggered "resend welcome" and marketing
snapshot-request emails — nothing currently sends client-facing
round/deletion/goal notifications. The Resend fallback built here is net-new
capability for those events, not a migration away from an existing sender.

## Data model changes

- `agencies.settings` (JSONB, no migration needed) gains:
  ```ts
  interface AgencySettings {
    // ...existing fields...
    ghl_webhook_triggers?: Partial<Record<GHLNotificationType, string>>;
    owner_ghl_contact_id?: string;
    ghl_pipeline_id?: string;
    ghl_pipeline_stages?: Partial<Record<PipelineStageKey, string>>;
  }
  ```
- Migration `016_opportunity_id.sql`:
  ```sql
  ALTER TABLE clients ADD COLUMN IF NOT EXISTS ghl_opportunity_id TEXT;
  CREATE INDEX IF NOT EXISTS idx_clients_opportunity ON clients(ghl_opportunity_id);
  ```

## Phase A — Notification service, wiring, config UI, Resend fallback

### A1. `src/lib/ghl/notifications.ts`

`GHLNotificationType`, `GHLNotificationPayload`, `sendGHLNotification()`, and
the pre-built helpers (`notifyRoundSent`, `notifyDeletionWin`,
`notifyRoundResults`, `notifyGoalAchieved`, `notifyPaymentFailed`,
`notifyPortalLink`, `notifyStaffNewClient`, `notifyStaffRoundOverdue`), as in
the original spec, with one correction:

`sendGHLNotification()` takes an explicit internal id pair separate from the
GHL-facing payload:

```ts
export async function sendGHLNotification(
  agency: Agency,
  type: GHLNotificationType,
  payload: GHLNotificationPayload,
  logging: { agencyId: string; clientId: string | null }
): Promise<{ success: boolean; method: "ghl" | "resend" | "none" }>
```

(The original spec's activity-log snippet referenced a bare `clientId` that
was never in scope — this fixes that so the Timeline tab shows correct
per-client entries.) `notify*` helpers already receive `agency`/`client`
objects, so they pass `{ agencyId: agency.id, clientId: client.id }` through
without new parameters at call sites.

On successful send (either method), insert into `activity_log`:
```ts
{
  agency_id: logging.agencyId,
  client_id: logging.clientId,
  actor_type: "system",
  action: "notification_sent",
  description: `${type} notification sent via ${method}`,
  metadata: { notification_type: type, method, contact_id: payload.contactId },
}
```

### A2. Wiring into events

Exactly the 8 call sites from the original spec, each firing the new
`notify*` alongside the existing sync call via `Promise.allSettled` (never
blocking the DB write that triggered it):

1. `markRoundSent` (`src/app/(dashboard)/clients/[id]/rounds/actions.ts`) → `notifyRoundSent`
2. `logResults` (same file) → `notifyDeletionWin` (if deletions > 0) + `notifyRoundResults` (always)
3. `markClientCompleted` (same file) → `notifyGoalAchieved`
4. Portal link regeneration → `notifyPortalLink`
5. `/api/ghl/onboarding` → `notifyStaffNewClient`
6. `/api/cron/check-deadlines` → `notifyStaffRoundOverdue` per overdue round
7. `/api/cron/auto-create-rounds` → `staff_next_round_ready` notification
8. `/api/stripe/webhook` `invoice.payment_failed` → `notifyPaymentFailed`

### A3. Settings UI — "Notification Webhooks"

New section on Settings → GHL (`src/app/(dashboard)/settings/ghl/`), below
the existing field-mapping section: one URL input + "Test" button per
`GHLNotificationType` (client-facing group + staff-facing group), an "Owner
GHL Contact ID" field, and a "Save Webhook URLs" button that persists into
`agencies.settings.ghl_webhook_triggers` / `owner_ghl_contact_id`.

### A4. Test webhook route — `/api/ghl/test-webhook`

Staff-session gated (`getSessionContext()`, not admin). Accepts
`{ webhookUrl, notificationType }`, POSTs a full dummy payload matching that
type's actual `data` shape (all types covered, not just the 2 sketched in the
original spec), returns `{ success, status }` or `{ success: false, error }`.

### A5. Resend fallback + deprecation banner

`sendResendFallback()` with the templated copy for `round_sent`,
`deletion_win`, `goal_achieved`, `payment_failed` as specced — used only when
no webhook URL is configured for that type and `RESEND_API_KEY` is set.
Settings → GHL shows a banner: "Using Email Fallback — some notifications are
using Resend because GHL webhook URLs aren't fully configured" whenever any
notification type resolves to the Resend path (checked via
`ghl_webhook_triggers` gaps + `RESEND_API_KEY` presence, no runtime check
needed).

## Phase B — Pipeline sync, monthly cron, setup guide, dashboards

### B1. Opportunity ID auto-lookup + pipeline stage sync

New in `src/lib/ghl/api.ts`:
```ts
export async function findOrCreateGHLOpportunity(
  contactId: string,
  pipelineId: string,
  opts: GHLRequestOptions
): Promise<string | null>
```
Searches `/opportunities/search?location_id=...&contact_id=...&pipeline_id=...`;
if none found, creates one in the pipeline's first stage. Best-effort —
returns `null` on any failure, never throws.

New `src/lib/ghl/pipeline.ts`:
```ts
export async function moveClientPipelineStage(
  agency: Agency,
  client: Client,
  stage: PipelineStageKey
): Promise<void>
```
If `client.ghl_opportunity_id` is missing, lazily calls
`findOrCreateGHLOpportunity()` and persists the result onto
`clients.ghl_opportunity_id` before moving the stage. No-ops if
`ghl_pipeline_id`/stage mapping/contact id aren't configured.

Settings → GHL gains a "Pipeline Configuration" section (pipeline id + one
stage-id input per `PipelineStageKey`), stored in
`agencies.settings.ghl_pipeline_id` / `ghl_pipeline_stages`.

Stage-moving calls get added at the same event points as A2's notifications
(round sent, results in, goal achieved, etc.), each a no-op if unconfigured.

### B2. Monthly progress cron

`/api/cron/monthly-progress`, `0 9 1 * *` in `vercel.json`. Iterates active
clients across all agencies with a `ghl_contact_id`, dispatching
`monthly_progress` notifications in `Promise.allSettled` batches (not a
sequential per-client loop) to fit Vercel Hobby's 60s `maxDuration`. Note in
code: if the client base grows large enough to blow that budget, this will
need pagination/chunking across invocations — not built now, flagged as a
known ceiling.

### B3. GHL setup guide page

`/onboarding/ghl-setup`, linked from Settings → GHL. Full documented list of
all workflow types (trigger fields, suggested SMS/email copy) as in the
original spec.

### B4. Notification timeline entries

No new component — A1's `activity_log` insert (`action: "notification_sent"`)
already renders in the existing client-detail Timeline tab. Add an icon +
method badge (✅ GHL / ⚠️ Resend fallback) to that timeline row's existing
renderer for the `notification_sent` action.

### B5. Admin notification health widget

Agency slide-over panel, GHL Config tab: counts non-empty entries in
`agency.settings.ghl_webhook_triggers` (`n of 10 configured`), link to the
setup guide.

## Known risks / open ceilings

- Monthly-progress cron may need pagination once client volume is large
  enough to risk the 60s Hobby cap (see B2).
- `findOrCreateGHLOpportunity`'s search endpoint reliability may vary by GHL
  plan, same caveat already noted for `createGHLPipeline` in the existing
  codebase — treated as best-effort throughout, never blocks the triggering
  action.

## Build order

**Phase A:** 1) migration 016 is Phase B only — Phase A needs no migration. →
2) A1 (notification service) → 3) A2 (wiring) → 4) A3 (config UI) → 5) A4
(test route) → 6) A5 (Resend fallback + banner). Ends with `npm run build`
passing.

**Phase B** (separate review/merge): 1) migration 016 → 2) B1 (opportunity
lookup + pipeline sync + settings UI) → 3) B2 (monthly cron) → 4) B3 (setup
guide page) → 5) B4 (timeline badge) → 6) B5 (admin widget). Ends with
`npm run build` passing.
