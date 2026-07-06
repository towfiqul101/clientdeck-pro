# GHL Tag-Based Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current per-type raw-webhook-URL notification model with GHL's free tag-trigger model: ClientDeck writes event data onto GHL custom fields, adds a `cdp-*` tag (which fires the agency's own GHL workflow), then removes the tag 5 seconds later so it can refire next time — no Resend/webhook cost, no per-agency URL configuration required beyond connecting GHL once.

**Architecture:** `sendGHLNotification()` in `src/lib/ghl/notifications.ts` keeps its exact exported signature (so all 10 `notify*` wrapper functions and their ~10 call sites across rounds/cron/webhook/portal code are untouched) but its internals switch from `fetch(webhookUrl)` to `updateGHLContactFields()` + `addGHLTag()` + delayed `removeGHLTag()`, using the agency's already-stored `ghl_api_key`/`ghl_location_id`. Settings → GHL drops the webhook-URL form for a read-only tag/field reference guide. Agencies get new self-service setup routes under `/api/ghl/setup/*` mirroring the admin-only tools that already exist under `/api/admin/tools/*`.

**Tech Stack:** Next.js 16 Route Handlers, Supabase (RLS-scoped client for agency-facing routes, service-role for admin routes), TypeScript.

## Global Constraints

- `sendGHLNotification(agency, type, payload, logging)`'s signature MUST NOT change — every wrapper (`notifyRoundSent`, `notifyDeletionWin`, etc.) and the one direct call site (`src/app/api/cron/auto-create-rounds/route.ts:118`) depend on it staying stable.
- Tag removal after firing MUST be non-blocking (`setTimeout`, fire-and-forget with a caught `.catch`) — never `await` it before returning from `sendGHLNotification`.
- No new database migrations — everything lives in the existing `agencies.settings` JSONB and GHL's own API; the 7 new custom fields are created in GHL's location, not in Supabase.
- No test framework in this repo — verify with `npx tsc --noEmit`, `npm run lint`, `npm run build`, and a manual click-through.
- Follow the existing `Result = { success: boolean; error?: string }` / `{ ok: boolean; message: string }` conventions already used throughout this codebase for actions vs. routes, respectively.

---

### Task 1: Rework `sendGHLNotification` to the tag+field model

**Files:**
- Modify: `src/lib/ghl/notifications.ts`
- Modify: `src/lib/ghl/setup-config.ts` (add the 7 new field specs)
- Modify: `src/app/api/admin/tools/setup-ghl-fields/route.ts` (use the expanded field list)
- Modify: `src/components/admin/agency-slideover.tsx` (ToolsTab copy: "9" → "16" fields)
- Modify: `src/app/(dashboard)/clients/[id]/timeline/page.tsx` (badge: `"ghl"` → `"ghl_tag"`)

**Interfaces:**
- Produces: `NOTIFICATION_TAGS: Record<GHLNotificationType, string>` (exported from `notifications.ts`) — the 10 `cdp-*` tag names.
- Produces: `CDP_ALL_CUSTOM_FIELDS: GHLCustomFieldSpec[]` (16 items) from `setup-config.ts`, alongside the existing `CDP_CUSTOM_FIELDS` (kept as the original 9, unchanged, for anything that still wants just those).
- `sendGHLNotification`'s return type narrows `method` from `"ghl" | "resend" | "none"` to `"ghl_tag" | "resend" | "none"` — every caller of the wrapper functions ignores the return value already except the Timeline badge, which reads it back out of `activity_log.metadata.method`.

- [ ] **Step 1: Add the 7 new custom-field specs**

In `src/lib/ghl/setup-config.ts`, after the existing `CDP_CUSTOM_FIELDS` array (before `CDP_PIPELINES`), add:

```ts
/**
 * Additional fields carrying tag-notification event data (Session 7 Final).
 * Created alongside CDP_CUSTOM_FIELDS by the same setup tools.
 */
export const CDP_NOTIFICATION_FIELDS: GHLCustomFieldSpec[] = [
  { name: "CDP - Items Disputed", fieldKey: "cdp_items_disputed", dataType: "NUMERICAL" },
  { name: "CDP - Deletions This Round", fieldKey: "cdp_deletions_this_round", dataType: "NUMERICAL" },
  { name: "CDP - Deleted Items List", fieldKey: "cdp_deleted_items_list", dataType: "TEXT" },
  { name: "CDP - Score Improvement", fieldKey: "cdp_score_improvement", dataType: "NUMERICAL" },
  { name: "CDP - Monthly Fee", fieldKey: "cdp_monthly_fee", dataType: "TEXT" },
  { name: "CDP - Agency Phone", fieldKey: "cdp_agency_phone", dataType: "TEXT" },
  { name: "CDP - Google Review Link", fieldKey: "cdp_google_review_link", dataType: "TEXT" },
];

/** All 16 fields — used by both the admin and agency-self-service setup tools. */
export const CDP_ALL_CUSTOM_FIELDS: GHLCustomFieldSpec[] = [
  ...CDP_CUSTOM_FIELDS,
  ...CDP_NOTIFICATION_FIELDS,
];
```

- [ ] **Step 2: Point the admin setup-fields route at the expanded list**

In `src/app/api/admin/tools/setup-ghl-fields/route.ts`, change the import and the loop source:

```ts
import { CDP_ALL_CUSTOM_FIELDS } from "@/lib/ghl/setup-config";
```
(replacing `import { CDP_CUSTOM_FIELDS } from "@/lib/ghl/setup-config";`), and change:
```ts
for (const field of CDP_CUSTOM_FIELDS) {
```
to:
```ts
for (const field of CDP_ALL_CUSTOM_FIELDS) {
```
Also update the doc comment above `POST` from `/** Creates the 9 CDP custom fields ... */` to `/** Creates all 16 CDP custom fields in the agency's GHL location (skips existing). */`.

- [ ] **Step 3: Rewrite the core of `notifications.ts`**

In `src/lib/ghl/notifications.ts`, add the tag map and imports, and replace `sendGHLNotification`'s body. First, update the top imports:

```ts
import { createAdminClient } from "@/lib/supabase/admin";
import { addGHLTag, removeGHLTag, updateGHLContactFields } from "@/lib/ghl/api";
import type { Agency, Client } from "@/types";
```

Then, immediately after the `GHLNotificationType` union (before `NOTIFIABLE_CLIENT_COLUMNS`), add:

```ts
/** GHL contact tags that fire each event's agency-built workflow. Removed 5s after being added so they can refire next time. */
export const NOTIFICATION_TAGS: Record<GHLNotificationType, string> = {
  round_sent: "cdp-round-sent",
  deletion_win: "cdp-deletion-win",
  round_results_in: "cdp-round-complete",
  goal_achieved: "cdp-goal-achieved",
  payment_failed: "cdp-payment-failed",
  portal_link: "cdp-portal-sent",
  staff_new_client: "cdp-staff-new-client",
  staff_round_overdue: "cdp-staff-overdue",
  staff_next_round_ready: "cdp-next-round-ready",
  monthly_progress: "cdp-monthly-update",
};
```

Now replace the entire `sendGHLNotification` function body (from `export async function sendGHLNotification(` through its closing `}` — the block currently spanning the `webhookUrl` fetch and the Resend fallback check) with:

```ts
export async function sendGHLNotification(
  agency: Agency,
  type: GHLNotificationType,
  payload: GHLNotificationPayload,
  logging: NotificationLogIds
): Promise<{ success: boolean; method: "ghl_tag" | "resend" | "none" }> {
  let result: { success: boolean; method: "ghl_tag" | "resend" | "none" } = {
    success: false,
    method: "none",
  };

  const hasGhl = Boolean(agency.ghl_api_key && agency.ghl_location_id && payload.contactId);

  if (hasGhl) {
    try {
      const opts = { apiKey: agency.ghl_api_key!, locationId: agency.ghl_location_id! };
      const tag = NOTIFICATION_TAGS[type];
      const fields = buildNotificationFields(type, payload.data);

      if (Object.keys(fields).length > 0) {
        await updateGHLContactFields(payload.contactId, fields, opts);
      }
      await addGHLTag(payload.contactId, [tag], opts);

      // Remove the tag shortly after so the same workflow can refire next
      // time this event happens for this contact. Never blocks the caller.
      setTimeout(() => {
        removeGHLTag(payload.contactId, [tag], opts).catch((err) => {
          console.error(`[GHL Notification] Tag removal failed for ${type}:`, err);
        });
      }, 5000);

      result = { success: true, method: "ghl_tag" };
    } catch (err) {
      console.error(`[GHL Notification] ${type} tag/field update failed:`, err);
    }
  }

  if (result.method === "none" && process.env.RESEND_API_KEY && payload.email) {
    try {
      const sent = await sendResendFallback(type, payload, agency);
      if (sent) {
        result = { success: true, method: "resend" };
      }
    } catch (err) {
      console.error(`[Resend Fallback] ${type} failed:`, err);
    }
  }

  if (result.method === "none") {
    console.log(`[Notification] ${type} for ${payload.firstName} — no notification method configured`);
    return result;
  }

  try {
    const admin = createAdminClient();
    await admin.from("activity_log").insert({
      agency_id: logging.agencyId,
      client_id: logging.clientId,
      actor_type: "system",
      action: "notification_sent",
      description: `${type} notification sent via ${result.method}`,
      metadata: {
        notification_type: type,
        method: result.method,
        contact_id: payload.contactId,
      },
    });
  } catch (err) {
    console.error(`[Notification] Failed to log ${type} to activity_log:`, err);
  }

  return result;
}

/**
 * Maps each notification's payload data onto the GHL custom-field keys a
 * workflow can read via merge tags. Staff alerts fire on the OWNER's own GHL
 * contact (not the client's) — writing client-specific data there would
 * clobber the owner's own field values, so those three are tag-only.
 */
function buildNotificationFields(
  type: GHLNotificationType,
  data: GHLNotificationPayload["data"]
): Record<string, string | number> {
  switch (type) {
    case "round_sent":
      return {
        dispute_round_current: Number(data.round_number),
        cdp_items_disputed: Number(data.items_disputed),
        next_dispute_date: String(data.response_deadline),
        clientdeck_portal_link: String(data.portal_link),
      };
    case "deletion_win":
      return {
        cdp_deletions_this_round: Number(data.deletions_this_round),
        items_deleted_total: Number(data.total_deletions),
        cdp_deleted_items_list: String(data.deleted_items_list),
        credit_score_eq_current: Number(data.score_eq),
        credit_score_exp_current: Number(data.score_exp),
        credit_score_tu_current: Number(data.score_tu),
        clientdeck_portal_link: String(data.portal_link),
      };
    case "round_results_in":
      return {
        dispute_round_current: Number(data.round_number),
        items_deleted_total: Number(data.total_deletions),
        total_negative_items: Number(data.total_items_disputed),
        clientdeck_portal_link: String(data.portal_link),
      };
    case "goal_achieved":
      return {
        items_deleted_total: Number(data.total_deletions),
        cdp_score_improvement: Number(data.score_improvement),
        credit_score_eq_current: Number(data.final_score_eq),
        credit_score_exp_current: Number(data.final_score_exp),
        credit_score_tu_current: Number(data.final_score_tu),
        clientdeck_portal_link: String(data.portal_link),
        cdp_google_review_link: String(data.review_link ?? ""),
      };
    case "payment_failed":
      return {
        cdp_monthly_fee: Number(data.monthly_fee),
        clientdeck_portal_link: String(data.portal_link),
        cdp_agency_phone: String(data.agency_phone ?? ""),
      };
    case "portal_link":
      return { clientdeck_portal_link: String(data.portal_link) };
    case "monthly_progress":
      return {
        credit_score_eq_current: Number(data.score_eq),
        credit_score_exp_current: Number(data.score_exp),
        credit_score_tu_current: Number(data.score_tu),
        items_deleted_total: Number(data.total_deletions),
        total_negative_items: Number(data.total_items),
        dispute_round_current: Number(data.current_round),
        clientdeck_portal_link: String(data.portal_link),
      };
    case "staff_new_client":
    case "staff_round_overdue":
    case "staff_next_round_ready":
      return {};
    default:
      return {};
  }
}
```

Leave `sendResendFallback`, `portalLinkFor`, `dashboardLinkFor`, `monthsSince`, and all 10 `notify*` wrapper functions below this point completely unchanged.

- [ ] **Step 4: Update the admin ToolsTab field-count copy**

In `src/components/admin/agency-slideover.tsx`, in the `tools` array inside `ToolsTab`, change:

```ts
      desc: "Creates all 9 custom fields in their GHL location.",
```
to:
```ts
      desc: "Creates all 16 custom fields in their GHL location.",
```

- [ ] **Step 5: Update the Timeline notification badge**

In `src/app/(dashboard)/clients/[id]/timeline/page.tsx`, change:

```tsx
function NotificationMethodBadge({ method }: { method?: string }) {
  if (method === "ghl") {
```
to:
```tsx
function NotificationMethodBadge({ method }: { method?: string }) {
  if (method === "ghl_tag") {
```

- [ ] **Step 6: Verify types and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/ghl/notifications.ts src/lib/ghl/setup-config.ts src/app/api/admin/tools/setup-ghl-fields/route.ts src/components/admin/agency-slideover.tsx "src/app/(dashboard)/clients/[id]/timeline/page.tsx"
git commit -m "feat: switch GHL notifications from webhook URLs to free contact tags"
```

---

### Task 2: Update the admin slide-over's GHL Config notification status + drop `ghl_webhook_triggers` from the type

**Files:**
- Modify: `src/components/admin/agency-slideover.tsx`
- Modify: `src/types/index.ts` (remove `ghl_webhook_triggers` from `AgencySettings`)

**Interfaces:**
- Consumes: `NOTIFICATION_TAGS` from `@/lib/ghl/notifications` (Task 1).
- Removes: `AgencySettings.ghl_webhook_triggers` — no longer read or written anywhere after this task (existing DB rows keep the stale JSONB key harmlessly; JSONB is schemaless so no migration is needed).

- [ ] **Step 1: Replace the per-type webhook-configured list with a tag-based status card**

In `src/components/admin/agency-slideover.tsx`, remove the `WIRED_NOTIFICATION_TYPES` constant and its import of `GHLNotificationType` (no longer needed once the check below is rewritten), and replace the "Notification Status" block inside `GhlTab` — currently:

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

with:

```tsx
      <div className="rounded-lg border border-gray-200 p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Notifications
        </h4>
        <p className="mt-2 text-sm text-gray-600">
          Notifications fire automatically via free GHL contact tags (e.g.{" "}
          <code className="rounded bg-gray-100 px-1 text-xs">cdp-round-sent</code>) once GHL
          is connected — no per-type setup needed here. The agency configures their own GHL
          workflows to watch these tags.
        </p>
        {!a.settings?.owner_ghl_contact_id && (
          <p className="mt-2 text-xs text-amber-600">
            No owner GHL contact set — staff alerts (overdue rounds, new clients) won&apos;t
            fire until the agency sets one in Settings → GHL.
          </p>
        )}
      </div>
```

- [ ] **Step 2: Remove `ghl_webhook_triggers` from `AgencySettings`**

In `src/types/index.ts`, inside `AgencySettings`, remove:

```ts
  // GHL notification webhooks (Session 6)
  ghl_webhook_triggers?: Partial<Record<
    "round_sent" | "deletion_win" | "round_results_in" | "payment_failed" |
    "goal_achieved" | "portal_link" | "staff_new_client" | "staff_round_overdue" |
    "staff_next_round_ready" | "monthly_progress",
    string
  >>;
  owner_ghl_contact_id?: string;
```
replacing it with just:
```ts
  // Owner's own GHL contact id — staff alert tags land on this contact (Session 6)
  owner_ghl_contact_id?: string;
```

- [ ] **Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: errors surface anywhere still referencing `ghl_webhook_triggers` — fix by continuing into Task 3, which removes the last two references (`notification-webhooks-form.tsx`, `resend-fallback-banner.tsx`, and `updateNotificationWebhooks` in `settings/actions.ts`). It's fine for this step to show those as pending errors; Task 3 clears them.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/agency-slideover.tsx src/types/index.ts
git commit -m "refactor: replace per-type webhook status with tag-based notification status in admin panel"
```

---

### Task 3: Settings → GHL — replace the webhook form with a tag/field reference guide

**Files:**
- Delete: `src/app/(dashboard)/settings/ghl/notification-webhooks-form.tsx`
- Delete: `src/app/(dashboard)/settings/ghl/resend-fallback-banner.tsx`
- Delete: `src/app/api/ghl/test-webhook/route.ts`
- Create: `src/app/(dashboard)/settings/ghl/tag-notification-guide.tsx`
- Modify: `src/app/(dashboard)/settings/ghl/page.tsx`
- Modify: `src/app/(dashboard)/settings/actions.ts` (replace `updateNotificationWebhooks` with `updateOwnerGhlContactId`)

**Interfaces:**
- Consumes: `NOTIFICATION_TAGS` from `@/lib/ghl/notifications` (Task 1); `Field`, `Input`, `Button`, `Card`, `CardHeader` from `@/components/ui/*`; `useToast`.
- Produces: `updateOwnerGhlContactId(ownerGhlContactId: string): Promise<ActionResult>` replacing `updateNotificationWebhooks`.
- Produces: `<TagNotificationGuide ownerGhlContactId={string} />` client component.

- [ ] **Step 1: Replace `updateNotificationWebhooks` with a smaller action**

In `src/app/(dashboard)/settings/actions.ts`, replace the whole `updateNotificationWebhooks` function (and its now-unused `GHLNotificationType` import) with:

```ts
/** Saves just the owner's GHL contact id — staff alert tags land on this contact. */
export async function updateOwnerGhlContactId(
  ownerGhlContactId: string
): Promise<ActionResult> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  const supabase = await createServerSupabaseClient();
  const nextSettings: AgencySettings = {
    ...session.agency.settings,
    owner_ghl_contact_id: ownerGhlContactId.trim() || undefined,
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

Also remove the now-unused `import type { GHLNotificationType } from "@/lib/ghl/notifications";` line from the top of this file (nothing else in it references that type).

- [ ] **Step 2: Delete the old webhook-URL UI and test route**

```bash
rm "src/app/(dashboard)/settings/ghl/notification-webhooks-form.tsx"
rm "src/app/(dashboard)/settings/ghl/resend-fallback-banner.tsx"
rm "src/app/api/ghl/test-webhook/route.ts"
```

- [ ] **Step 3: Build the tag/field reference guide component**

Create `src/app/(dashboard)/settings/ghl/tag-notification-guide.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, Check } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { NOTIFICATION_TAGS, type GHLNotificationType } from "@/lib/ghl/notifications";
import { updateOwnerGhlContactId } from "../actions";

const ROWS: { key: GHLNotificationType; event: string; fields: string }[] = [
  { key: "round_sent", event: "Round Sent", fields: "dispute_round_current, cdp_items_disputed, clientdeck_portal_link" },
  { key: "deletion_win", event: "Deletion Win", fields: "cdp_deletions_this_round, items_deleted_total, cdp_deleted_items_list" },
  { key: "round_results_in", event: "Round Complete", fields: "dispute_round_current, items_deleted_total, total_negative_items" },
  { key: "goal_achieved", event: "Goal Achieved", fields: "cdp_score_improvement, cdp_google_review_link" },
  { key: "payment_failed", event: "Payment Failed", fields: "cdp_monthly_fee, cdp_agency_phone" },
  { key: "portal_link", event: "Portal Link Sent", fields: "clientdeck_portal_link" },
  { key: "monthly_progress", event: "Monthly Update", fields: "credit_score_eq_current, credit_score_exp_current, credit_score_tu_current" },
  { key: "staff_new_client", event: "Staff: New Client", fields: "(fires on your owner contact — no fields written)" },
  { key: "staff_round_overdue", event: "Staff: Round Overdue", fields: "(fires on your owner contact — no fields written)" },
  { key: "staff_next_round_ready", event: "Staff: Next Round Ready", fields: "(fires on your owner contact — no fields written)" },
];

export function TagNotificationGuide({ ownerGhlContactId }: { ownerGhlContactId: string }) {
  const { toast } = useToast();
  const [contactId, setContactId] = useState(ownerGhlContactId);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleSave() {
    setPending(true);
    const result = await updateOwnerGhlContactId(contactId);
    setPending(false);
    if (result.success) toast("Owner GHL contact saved.", "success");
    else toast(result.error ?? "Could not save.", "error");
  }

  function copyAllTags() {
    navigator.clipboard?.writeText(Object.values(NOTIFICATION_TAGS).join(", "));
    setCopied(true);
    toast("All tag names copied.", "success");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <CardHeader
        title="GHL Notifications (Free — No Per-Execution Cost)"
        description='ClientDeck Pro notifies clients using GHL contact tags. When an event happens, we update the contact’s custom fields with the event data, then add a tag like "cdp-round-sent" — your GHL workflow (Tag trigger, free in GHL) picks it up and sends SMS/email from your own number.'
      />
      <div className="space-y-4 p-6">
        <div className="overflow-x-auto rounded-md border border-gray-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2 font-medium">Event</th>
                <th className="px-3 py-2 font-medium">Tag to watch</th>
                <th className="px-3 py-2 font-medium">Data fields available</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ROWS.map((r) => (
                <tr key={r.key}>
                  <td className="px-3 py-2 text-gray-900">{r.event}</td>
                  <td className="px-3 py-2 font-mono text-xs text-blue-700">{NOTIFICATION_TAGS[r.key]}</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-500">{r.fields}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-3">
          <Button type="button" variant="secondary" onClick={copyAllTags}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            Copy All Tags
          </Button>
          <Link
            href="/onboarding/ghl-setup"
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Full setup guide →
          </Link>
        </div>

        <Field
          label="Owner GHL Contact ID"
          htmlFor="ownerGhlContactId"
          hint="Your own contact in GHL — staff alert tags (overdue rounds, new clients) land here. Find it: GHL → Contacts → your profile → copy the id from the URL."
        >
          <Input
            id="ownerGhlContactId"
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
            placeholder="e.g. abc123XYZ"
          />
        </Field>
        <div className="flex justify-end">
          <Button onClick={handleSave} loading={pending}>
            Save
          </Button>
        </div>
      </div>
    </Card>
  );
}
```

- [ ] **Step 4: Wire it into the settings page**

In `src/app/(dashboard)/settings/ghl/page.tsx`, remove the imports and usages of `NotificationWebhooksForm` and `ResendFallbackBanner`, and add `TagNotificationGuide`:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen } from "lucide-react";
import { getSessionContext } from "@/lib/auth/session";
import { GHLForm } from "./ghl-form";
import { GHLSyncActivity } from "./sync-activity";
import { GhlFieldMapping } from "./ghl-field-mapping";
import { OnboardingWebhookCard } from "./onboarding-webhook-card";
import { TagNotificationGuide } from "./tag-notification-guide";
import { PipelineConfigForm } from "./pipeline-config-form";
import { GhlSetupTools } from "./setup-tools";

export default async function GHLSettingsPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");

  const { agency } = session;
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://app.clientdeckpro.com";
  const webhookUrl = `${appUrl}/api/ghl/webhook`;
  const onboardingWebhookUrl = `${appUrl}/api/ghl/onboarding`;

  return (
    <div className="space-y-6">
      <Link
        href="/onboarding/ghl-setup"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
      >
        <BookOpen className="h-4 w-4" /> View the full GHL workflow setup guide
      </Link>
      <GHLForm
        initial={{
          locationId: agency.ghl_location_id ?? "",
          apiKey: agency.ghl_api_key ?? "",
        }}
        webhookUrl={webhookUrl}
      />
      <GhlFieldMapping initial={agency.ghl_field_keys ?? {}} />
      <GhlSetupTools />
      <OnboardingWebhookCard webhookUrl={onboardingWebhookUrl} />
      <TagNotificationGuide ownerGhlContactId={agency.settings?.owner_ghl_contact_id ?? ""} />
      <PipelineConfigForm
        initial={{
          pipelineId: agency.settings?.ghl_pipeline_id ?? "",
          stages: agency.settings?.ghl_pipeline_stages ?? {},
        }}
      />
      <GHLSyncActivity />
    </div>
  );
}
```

(`GhlSetupTools` is created in Task 5 — this step references it in advance; if executing Task 3 before Task 5, temporarily comment out that one import/usage line and restore it when Task 5 lands, or execute Task 5 first. Subagent-driven execution should do Task 5 before wiring this line, or do both in the same pass.)

- [ ] **Step 5: Verify types and lint**

Run: `npx tsc --noEmit`
Expected: no errors (all `ghl_webhook_triggers` / deleted-file references are now gone).

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/settings/actions.ts" "src/app/(dashboard)/settings/ghl/tag-notification-guide.tsx" "src/app/(dashboard)/settings/ghl/page.tsx"
git add -u "src/app/(dashboard)/settings/ghl/notification-webhooks-form.tsx" "src/app/(dashboard)/settings/ghl/resend-fallback-banner.tsx" "src/app/api/ghl/test-webhook/route.ts"
git commit -m "feat: replace webhook-URL notification settings with a tag/field reference guide"
```

---

### Task 4: Rework the `/onboarding/ghl-setup` guide page for the tag model

**Files:**
- Modify: `src/app/(dashboard)/onboarding/ghl-setup/page.tsx`

**Interfaces:**
- Consumes: `NOTIFICATION_TAGS` from `@/lib/ghl/notifications` (Task 1).

- [ ] **Step 1: Replace the webhook-trigger workflow docs with tag-trigger docs**

Replace the whole `WORKFLOWS` array and the "How it works" `Card` body in `src/app/(dashboard)/onboarding/ghl-setup/page.tsx`. First, change the imports and `WorkflowDoc` shape:

```tsx
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { NOTIFICATION_TAGS, type GHLNotificationType } from "@/lib/ghl/notifications";

interface WorkflowDoc {
  key: GHLNotificationType;
  title: string;
  mergeFields: string[];
  suggestedCopy: string;
}
```

Replace the `WORKFLOWS` array with (merge fields now reference GHL custom fields we write via `updateGHLContactFields`, not webhook JSON body keys):

```tsx
const WORKFLOWS: WorkflowDoc[] = [
  {
    key: "round_sent",
    title: "Round Sent to Bureaus (Client SMS)",
    mergeFields: ["{{contact.first_name}}", "{{contact.dispute_round_current}}", "{{contact.cdp_items_disputed}}", "{{contact.clientdeck_portal_link}}"],
    suggestedCopy:
      "Hi {{contact.first_name}}! Your Round {{contact.dispute_round_current}} dispute letters have been sent to all 3 bureaus ({{contact.cdp_items_disputed}} items). Track your progress: {{contact.clientdeck_portal_link}}",
  },
  {
    key: "deletion_win",
    title: "Deletion Win (Client SMS)",
    mergeFields: ["{{contact.cdp_deletions_this_round}}", "{{contact.items_deleted_total}}", "{{contact.cdp_deleted_items_list}}", "{{contact.clientdeck_portal_link}}"],
    suggestedCopy:
      "Great news, {{contact.first_name}}! {{contact.cdp_deletions_this_round}} item(s) were removed this round. Total deleted so far: {{contact.items_deleted_total}}. View your progress: {{contact.clientdeck_portal_link}}",
  },
  {
    key: "round_results_in",
    title: "Round Results In (Client SMS)",
    mergeFields: ["{{contact.dispute_round_current}}", "{{contact.items_deleted_total}}", "{{contact.total_negative_items}}", "{{contact.clientdeck_portal_link}}"],
    suggestedCopy:
      "Hi {{contact.first_name}}, your Round {{contact.dispute_round_current}} results are in. Full details: {{contact.clientdeck_portal_link}}",
  },
  {
    key: "goal_achieved",
    title: "Goal Achieved (Client SMS + Email)",
    mergeFields: ["{{contact.items_deleted_total}}", "{{contact.cdp_score_improvement}}", "{{contact.cdp_google_review_link}}"],
    suggestedCopy:
      "Congratulations {{contact.first_name}}! You've reached your credit goal — {{contact.items_deleted_total}} items removed, +{{contact.cdp_score_improvement}} points. Mind leaving us a review? {{contact.cdp_google_review_link}}",
  },
  {
    key: "payment_failed",
    title: "Payment Failed (Client SMS)",
    mergeFields: ["{{contact.cdp_monthly_fee}}", "{{contact.clientdeck_portal_link}}", "{{contact.cdp_agency_phone}}"],
    suggestedCopy:
      "Hi {{contact.first_name}}, your payment of ${{contact.cdp_monthly_fee}}/month didn't go through. Update it here: {{contact.clientdeck_portal_link}} or call {{contact.cdp_agency_phone}}.",
  },
  {
    key: "portal_link",
    title: "Portal Link Sent (Client SMS)",
    mergeFields: ["{{contact.clientdeck_portal_link}}"],
    suggestedCopy: "Hi {{contact.first_name}}, here's your client portal link: {{contact.clientdeck_portal_link}}",
  },
  {
    key: "monthly_progress",
    title: "Monthly Progress Update (Client SMS)",
    mergeFields: ["{{contact.credit_score_eq_current}}", "{{contact.credit_score_exp_current}}", "{{contact.credit_score_tu_current}}", "{{contact.items_deleted_total}}", "{{contact.dispute_round_current}}"],
    suggestedCopy:
      "Hi {{contact.first_name}}, your monthly update: {{contact.items_deleted_total}} items resolved, currently on Round {{contact.dispute_round_current}}. Details: {{contact.clientdeck_portal_link}}",
  },
  {
    key: "staff_new_client",
    title: "New Client Onboarded (Staff alert)",
    mergeFields: ["(fires on YOUR contact — build the message from a GHL workflow lookup, not merge fields)"],
    suggestedCopy: "New client onboarded — check your ClientDeck Pro dashboard for details.",
  },
  {
    key: "staff_round_overdue",
    title: "Round Overdue Alert (Staff alert)",
    mergeFields: ["(fires on YOUR contact — no client fields attached)"],
    suggestedCopy: "A client's round is overdue for a bureau response — check your ClientDeck Pro dashboard.",
  },
  {
    key: "staff_next_round_ready",
    title: "Next Round Ready (Staff alert)",
    mergeFields: ["(fires on YOUR contact — no client fields attached)"],
    suggestedCopy: "A client's next round is ready to prepare — check your ClientDeck Pro dashboard.",
  },
];
```

Replace the page body's intro and "How it works" card:

```tsx
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
          ClientDeck Pro notifies your clients using free GHL contact tags — your own GHL
          workflow sends the SMS/email, so it looks like it comes from your agency.
        </p>
      </div>

      <Card>
        <CardHeader title="How it works" />
        <div className="space-y-2 p-6 text-sm text-gray-600">
          <p>1. Run <strong>Create Custom Fields</strong> from Settings → GHL (or use the CDP snapshot).</p>
          <p>2. In GHL, create a workflow with <strong>Tag Added</strong> as the trigger, watching the tag listed below for each event.</p>
          <p>3. Build SMS/email actions using the contact merge fields listed below.</p>
          <p>
            4. Set your owner GHL contact id in{" "}
            <Link href="/settings/ghl" className="font-medium text-blue-600 hover:text-blue-700">
              Settings → GHL
            </Link>{" "}
            so staff alerts have somewhere to land.
          </p>
        </div>
      </Card>

      {WORKFLOWS.map((wf) => (
        <Card key={wf.key}>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-blue-600" /> {wf.title}
              </span>
            }
            description={
              <>
                Trigger: <strong>Tag Added</strong> —{" "}
                <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs">
                  {NOTIFICATION_TAGS[wf.key]}
                </code>
              </>
            }
          />
          <div className="space-y-3 p-6 text-sm">
            <div>
              <p className="mb-1.5 font-medium text-gray-700">Merge fields available:</p>
              <div className="flex flex-wrap gap-1.5">
                {wf.mergeFields.map((f) => (
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

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors (confirms `CardHeader`'s `description` prop accepts a `ReactNode`, matching its existing usage elsewhere in this file with a `title` node).

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/onboarding/ghl-setup/page.tsx"
git commit -m "docs: rework the GHL setup guide page for tag-based notifications"
```

---

### Task 5: Agency self-service GHL setup routes + Settings UI

**Files:**
- Modify: `src/lib/ghl/api.ts` (extend `getGHLPipelines`'s return type with stages)
- Create: `src/app/api/ghl/setup/create-fields/route.ts`
- Create: `src/app/api/ghl/setup/find-pipeline/route.ts`
- Create: `src/app/api/ghl/setup/sync-clients/route.ts`
- Create: `src/app/(dashboard)/settings/ghl/setup-tools.tsx`
- Modify: `src/app/(dashboard)/settings/ghl/page.tsx` (uncomment/finalize the `GhlSetupTools` wiring from Task 3, Step 4)

**Interfaces:**
- Produces: `GHLPipelineListItem { id: string; name: string; stages?: { id: string; name: string }[] }` and updates `getGHLPipelines(opts): Promise<GHLPipelineListItem[]>` (previously `{id,name}[]`, additive/backward-compatible).
- Produces: three session-authenticated `POST` routes at `/api/ghl/setup/create-fields`, `/api/ghl/setup/find-pipeline`, `/api/ghl/setup/sync-clients`, each returning `{ ok: boolean; message: string; error?: string }`.
- Produces: `<GhlSetupTools />` client component with no props (reads the signed-in agency via the routes it calls).

- [ ] **Step 1: Extend `getGHLPipelines` to expose stages**

In `src/lib/ghl/api.ts`, replace:

```ts
/** Lists existing pipelines so setup can skip ones already present. */
export async function getGHLPipelines(
  opts: GHLRequestOptions
): Promise<{ id: string; name: string }[]> {
  try {
    const data = await ghlFetch(
      `/opportunities/pipelines?locationId=${opts.locationId}`,
      opts
    );
    return (data?.pipelines ?? []) as { id: string; name: string }[];
  } catch {
    return [];
  }
}
```
with:
```ts
export interface GHLPipelineListItem {
  id: string;
  name: string;
  stages?: { id: string; name: string }[];
}

/** Lists existing pipelines (with their stages) so setup can skip/match by name. */
export async function getGHLPipelines(
  opts: GHLRequestOptions
): Promise<GHLPipelineListItem[]> {
  try {
    const data = await ghlFetch(
      `/opportunities/pipelines?locationId=${opts.locationId}`,
      opts
    );
    return (data?.pipelines ?? []) as GHLPipelineListItem[];
  } catch {
    return [];
  }
}
```

- [ ] **Step 2: Agency self-service "create fields" route**

Create `src/app/api/ghl/setup/create-fields/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { getGHLCustomFields, createGHLCustomField } from "@/lib/ghl/api";
import { CDP_ALL_CUSTOM_FIELDS } from "@/lib/ghl/setup-config";

export const dynamic = "force-dynamic";

/** Creates all 16 CDP custom fields in the signed-in agency's own GHL location. */
export async function POST() {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const { ghl_api_key, ghl_location_id } = session.agency;
  if (!ghl_api_key || !ghl_location_id) {
    return NextResponse.json(
      { ok: false, error: "Connect GHL (Location ID + API key) first." },
      { status: 400 }
    );
  }
  const opts = { apiKey: ghl_api_key, locationId: ghl_location_id };

  let existingNames: Set<string>;
  try {
    const existing = await getGHLCustomFields(opts);
    existingNames = new Set(existing.map((f) => f.name?.toLowerCase()));
  } catch {
    return NextResponse.json(
      { ok: false, error: "Could not reach GHL. Check the API key." },
      { status: 502 }
    );
  }

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];
  for (const field of CDP_ALL_CUSTOM_FIELDS) {
    if (existingNames.has(field.name.toLowerCase())) {
      skipped++;
      continue;
    }
    const res = await createGHLCustomField(field, opts);
    if (res.created) created++;
    else errors.push(`${field.name}: ${res.error ?? "failed"}`);
  }

  return NextResponse.json({
    ok: errors.length === 0,
    message: `Created ${created} field(s), skipped ${skipped} already present.`,
    errors,
  });
}
```

- [ ] **Step 3: Agency self-service "find & connect pipeline" route**

Create `src/app/api/ghl/setup/find-pipeline/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getGHLPipelines } from "@/lib/ghl/api";
import type { AgencySettings } from "@/types";
import type { PipelineStageKey } from "@/lib/ghl/pipeline";

export const dynamic = "force-dynamic";

const STAGE_NAME_MAP: Record<PipelineStageKey, string> = {
  round_1_sent: "round 1 sent",
  round_2_plus: "round 2+",
  goal_achieved: "goal achieved",
};

/** Auto-detects the agency's "Active Client" GHL pipeline and maps its 3 stage ids by name. */
export async function POST() {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const { ghl_api_key, ghl_location_id } = session.agency;
  if (!ghl_api_key || !ghl_location_id) {
    return NextResponse.json(
      { ok: false, error: "Connect GHL (Location ID + API key) first." },
      { status: 400 }
    );
  }

  const pipelines = await getGHLPipelines({ apiKey: ghl_api_key, locationId: ghl_location_id });
  const match = pipelines.find((p) => p.name.toLowerCase().includes("active client"));
  if (!match) {
    return NextResponse.json({
      ok: false,
      error:
        'No pipeline named "Active Client" found. Install the CDP snapshot or create it manually in GHL, then run this again.',
    });
  }

  const stages: Partial<Record<PipelineStageKey, string>> = {};
  for (const [key, wantedName] of Object.entries(STAGE_NAME_MAP) as [PipelineStageKey, string][]) {
    const stage = match.stages?.find((s) => s.name.toLowerCase() === wantedName);
    if (stage) stages[key] = stage.id;
  }

  const supabase = await createServerSupabaseClient();
  const nextSettings: AgencySettings = {
    ...session.agency.settings,
    ghl_pipeline_id: match.id,
    ghl_pipeline_stages: { ...session.agency.settings.ghl_pipeline_stages, ...stages },
  };
  const { error } = await supabase
    .from("agencies")
    .update({ settings: nextSettings })
    .eq("id", session.agency.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const mappedCount = Object.keys(stages).length;
  return NextResponse.json({
    ok: true,
    message: `Connected pipeline "${match.name}" — mapped ${mappedCount} of 3 stages by name.`,
  });
}
```

- [ ] **Step 4: Agency self-service "sync all clients" route**

Create `src/app/api/ghl/setup/sync-clients/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createGHLContact, updateGHLContactFields } from "@/lib/ghl/api";
import type { Client } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Pushes all of the signed-in agency's own clients to GHL as contacts (best-effort). RLS scopes this to the agency automatically. */
export async function POST() {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const { ghl_api_key, ghl_location_id } = session.agency;
  if (!ghl_api_key || !ghl_location_id) {
    return NextResponse.json(
      { ok: false, error: "Connect GHL (Location ID + API key) first." },
      { status: 400 }
    );
  }
  const opts = { apiKey: ghl_api_key, locationId: ghl_location_id };

  const supabase = await createServerSupabaseClient();
  const { data: clients } = await supabase.from("clients").select("*");
  const list = (clients ?? []) as Client[];
  if (list.length === 0) {
    return NextResponse.json({ ok: true, message: "No clients to sync." });
  }

  let created = 0;
  let updated = 0;
  const errors: string[] = [];
  const BATCH = 3;
  for (let i = 0; i < list.length; i += BATCH) {
    const batch = list.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (client) => {
        try {
          const fields: Record<string, string | number> = {
            clientdeck_client_id: client.id,
            dispute_round_current: client.current_round ?? 0,
            items_deleted_total: client.total_items_deleted ?? 0,
            total_negative_items: client.total_items_current ?? 0,
          };
          if (client.score_eq_current) fields.credit_score_eq_current = client.score_eq_current;
          if (client.score_exp_current) fields.credit_score_exp_current = client.score_exp_current;
          if (client.score_tu_current) fields.credit_score_tu_current = client.score_tu_current;

          if (client.ghl_contact_id) {
            await updateGHLContactFields(client.ghl_contact_id, fields, opts);
            updated++;
            return;
          }

          const contactId = await createGHLContact(
            {
              firstName: client.first_name,
              lastName: client.last_name,
              email: client.email,
              phone: client.phone,
              address1: client.address_line1,
              city: client.city,
              state: client.state,
              postalCode: client.zip,
            },
            opts
          );
          if (!contactId) {
            errors.push(`${client.first_name} ${client.last_name}: create failed`);
            return;
          }

          await supabase.from("clients").update({ ghl_contact_id: contactId }).eq("id", client.id);
          await updateGHLContactFields(contactId, fields, opts);
          created++;
        } catch (e) {
          errors.push(`${client.first_name} ${client.last_name}: ${e instanceof Error ? e.message : "failed"}`);
        }
      })
    );
  }

  return NextResponse.json({
    ok: errors.length === 0,
    message: `Synced ${created + updated} of ${list.length} clients (${created} new, ${updated} updated).`,
    errors: errors.slice(0, 10),
  });
}
```

- [ ] **Step 5: Agency-facing Setup Tools UI**

Create `src/app/(dashboard)/settings/ghl/setup-tools.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Wrench, Database, RefreshCw } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils/helpers";

const TOOLS = [
  {
    key: "fields",
    icon: Wrench,
    title: "Create Custom Fields",
    desc: "Creates all 16 CDP custom fields in your GHL location automatically.",
    path: "/api/ghl/setup/create-fields",
  },
  {
    key: "pipeline",
    icon: Database,
    title: "Find & Connect Pipeline",
    desc: 'Auto-detects your "Active Client" GHL pipeline and maps stage ids for automatic stage moves.',
    path: "/api/ghl/setup/find-pipeline",
  },
  {
    key: "sync",
    icon: RefreshCw,
    title: "Sync All Clients to GHL",
    desc: "Pushes all your ClientDeck clients to GHL as contacts with all custom fields.",
    path: "/api/ghl/setup/sync-clients",
  },
];

export function GhlSetupTools() {
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});

  async function run(key: string, path: string) {
    setBusy(key);
    try {
      const res = await fetch(path, { method: "POST" });
      const json = await res.json();
      const msg = json.message || json.error || (json.ok ? "Done." : "Failed.");
      setResults((r) => ({ ...r, [key]: msg }));
      toast(msg, json.ok ? "success" : "error");
    } catch {
      toast("Request failed.", "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader
        title="GHL Setup Tools"
        description="Run these to automatically configure your GHL account. Requires your GHL API key to be saved above."
      />
      <div className="space-y-3 p-6">
        {TOOLS.map((t) => {
          const Icon = t.icon;
          return (
            <div key={t.key} className="rounded-lg border border-gray-200 p-4">
              <button
                disabled={busy !== null}
                onClick={() => run(t.key, t.path)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
                  busy !== null
                    ? "cursor-not-allowed bg-gray-100 text-gray-400"
                    : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                )}
              >
                <Icon className="h-4 w-4" />
                {busy === t.key ? "Running…" : t.title}
              </button>
              <p className="mt-2 text-xs text-gray-500">{t.desc}</p>
              {results[t.key] && <p className="mt-1 text-xs font-medium text-gray-700">{results[t.key]}</p>}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
```

- [ ] **Step 6: Verify types, lint, and build**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new errors.

Run: `npm run build`
Expected: build succeeds (confirms the `/api/ghl/setup/*` routes and the settings page wiring from Task 3 all resolve).

- [ ] **Step 7: Manual check**

Run `npm run dev`, sign in as an agency with GHL connected, visit `/settings/ghl` → confirm the "GHL Setup Tools" card appears with 3 working buttons, the "GHL Notifications" tag/field table renders all 10 rows, and the old webhook-URL inputs are gone.

- [ ] **Step 8: Commit**

```bash
git add src/lib/ghl/api.ts "src/app/api/ghl/setup" "src/app/(dashboard)/settings/ghl/setup-tools.tsx" "src/app/(dashboard)/settings/ghl/page.tsx"
git commit -m "feat: add agency self-service GHL setup tools (fields, pipeline, client sync)"
```

---

## Self-Review Notes

- **Spec coverage:** spec Task 3 (tag service + fields) → Task 1; spec Task 4 (Settings UI) → Tasks 2-3; spec Task 5 (setup guide) → Task 4; spec Task 8 (setup routes, agency + admin) → Task 5 for the agency side — the admin side already existed under `/api/admin/tools/*` before this plan and needed no new routes, only the expanded 16-field list (Task 1, Steps 1-2).
- **Reconciled spec/code mismatches:** the spec's `NOTIFICATION_TAGS` object includes `review_request`/`onboarding_welcome` keys that don't correspond to any of the 10 existing `GHLNotificationType` values or any existing call site — adding them would mean inventing new notification types with no producer. Case-completion review requests already exist as a separate, working flow (`/api/ghl/send-review-request`, CLAUDE.md Session 5) — left untouched and out of scope here to avoid a duplicate/conflicting mechanism. The spec's assumed "9 original fields" and "16 total" claim is confirmed accurate against the real `CDP_CUSTOM_FIELDS` array.
- **Type consistency:** `NOTIFICATION_TAGS`'s key set (`GHLNotificationType`, 10 values) matches `buildNotificationFields`'s `switch` cases and the `TagNotificationGuide`/setup-guide `ROWS`/`WORKFLOWS` arrays exactly — no type is referenced that doesn't exist in the union.
