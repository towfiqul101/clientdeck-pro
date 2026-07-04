# GHL Notifications — Phase A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the GHL-webhook notification service and wire it into all 9 client/staff events (round sent, deletion win, round results, goal achieved, payment failed, portal link, staff new client, staff round overdue, staff next round ready), plus the Settings UI to configure and test the webhook URLs.

**Architecture:** New independent channel (`src/lib/ghl/notifications.ts`) that POSTs to an agency-configured GHL "Custom Webhook" trigger URL, falling back to Resend email, falling back to a log-only no-op — entirely separate from and additive to the existing tag/field GHL sync (`src/lib/ghl/api.ts` + `src/lib/ghl/sync.ts`), which is untouched. Every send is logged to `activity_log` so it surfaces in the existing client Timeline tab.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (service-role client for logging), no test framework (see Global Constraints).

Full design: `docs/superpowers/specs/2026-07-04-ghl-notifications-pipeline-sync-design.md` (Phase A section).

## Global Constraints

- No test framework exists in this repo (confirmed: no Jest/Vitest, no `test` script). Do not add one. Verify every task with `npx tsc --noEmit`, and the phase-closing task with `npm run build`. Where a task adds an HTTP route or user-facing flow, verify manually (curl or dev server) as described in that task's steps.
- Do not install new npm packages. Everything in this plan uses only what's already a dependency.
- Never let a notification failure block the DB write that triggered it — every call site wraps the new `notify*`/`sendGHLNotification` call so it cannot throw past the caller (the functions themselves never throw; call sites still avoid `await`-ing them in a way that would propagate an error).
- Use `createAdminClient()` (service role) inside `src/lib/ghl/notifications.ts` for the `activity_log` insert — this function is called from both authenticated server actions and unauthenticated cron/webhook routes, so it cannot rely on the request-scoped `createServerSupabaseClient()`.
- Follow existing code conventions: `"use server"` actions return `{ success, error? }` (`ActionResult`), Server Components fetch via `getSessionContext()`, forms use `Field`/`Input`/`Button`/`Card` from `src/components/ui/`, toasts via `useToast()`.
- `GHLNotificationType` only includes the 9 types actually wired in this plan. Phase B will extend the union by one (`monthly_progress`) when that cron is built — do not pre-declare unused types.

---

### Task 1: Notification service foundation

**Files:**
- Modify: `src/types/index.ts` (extend `AgencySettings`)
- Create: `src/lib/ghl/notifications.ts`

**Interfaces:**
- Produces: `GHLNotificationType`, `NotifiableClient`, `NOTIFIABLE_CLIENT_COLUMNS`, `sendGHLNotification()`, `notifyRoundSent()`, `notifyDeletionWin()`, `notifyRoundResults()`, `notifyGoalAchieved()`, `notifyPaymentFailed()`, `notifyPortalLink()`, `notifyStaffNewClient()`, `notifyStaffRoundOverdue()` — all consumed by Tasks 2–8.

- [ ] **Step 1: Extend `AgencySettings` in `src/types/index.ts`**

Find the `AgencySettings` interface (around line 94) and add two fields:

```ts
export interface AgencySettings {
  timezone: string;
  letter_signature: string;
  default_monthly_fee: number;
  portal_branding_visible: boolean;
  onboarding_completed?: boolean;
  onboarding_completed_at?: string | null;
  onboarding_steps?: OnboardingSteps;
  // Automation + completion (Session 5)
  auto_create_rounds?: boolean;
  auto_round_delay_days?: number;
  google_review_link?: string;
  referral_bonus?: string;
  referral_link?: string;
  // GHL notification webhooks (Session 6)
  ghl_webhook_triggers?: Partial<Record<
    "round_sent" | "deletion_win" | "round_results_in" | "payment_failed" |
    "goal_achieved" | "portal_link" | "staff_new_client" | "staff_round_overdue" |
    "staff_next_round_ready",
    string
  >>;
  owner_ghl_contact_id?: string;
}
```

(The inline union here intentionally mirrors `GHLNotificationType` from `src/lib/ghl/notifications.ts` — `types/index.ts` doesn't import from `lib/`, so it's spelled out. Keep the two lists in sync if either changes.)

- [ ] **Step 2: Create `src/lib/ghl/notifications.ts`**

```ts
import { createAdminClient } from "@/lib/supabase/admin";
import type { Agency, Client } from "@/types";

export type GHLNotificationType =
  | "round_sent"
  | "deletion_win"
  | "round_results_in"
  | "payment_failed"
  | "goal_achieved"
  | "portal_link"
  | "staff_new_client"
  | "staff_round_overdue"
  | "staff_next_round_ready";

/** Columns every notify* helper needs off a `clients` row. Select this whenever a call site needs to notify. */
export const NOTIFIABLE_CLIENT_COLUMNS =
  "id, first_name, last_name, email, phone, ghl_contact_id, portal_token, monthly_fee, total_items_deleted, service_start_date, score_eq_current, score_exp_current, score_tu_current, score_eq_start, score_exp_start, score_tu_start";

export type NotifiableClient = Pick<
  Client,
  | "id"
  | "first_name"
  | "last_name"
  | "email"
  | "phone"
  | "ghl_contact_id"
  | "portal_token"
  | "monthly_fee"
  | "total_items_deleted"
  | "service_start_date"
  | "score_eq_current"
  | "score_exp_current"
  | "score_tu_current"
  | "score_eq_start"
  | "score_exp_start"
  | "score_tu_start"
>;

export interface GHLNotificationPayload {
  contactId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  data: Record<string, string | number | boolean>;
}

interface NotificationLogIds {
  agencyId: string;
  clientId: string | null;
}

/**
 * Fires a notification through the agency's configured GHL webhook, falling
 * back to Resend email, falling back to a log-only no-op. Never throws —
 * callers can fire-and-forget or await without try/catch.
 */
export async function sendGHLNotification(
  agency: Agency,
  type: GHLNotificationType,
  payload: GHLNotificationPayload,
  logging: NotificationLogIds
): Promise<{ success: boolean; method: "ghl" | "resend" | "none" }> {
  const triggers = agency.settings?.ghl_webhook_triggers ?? {};
  const webhookUrl = triggers[type];

  let result: { success: boolean; method: "ghl" | "resend" | "none" } = {
    success: false,
    method: "none",
  };

  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_id: payload.contactId,
          first_name: payload.firstName,
          last_name: payload.lastName,
          ...payload.data,
          triggered_at: new Date().toISOString(),
          source: "clientdeck_pro",
        }),
      });
      result = { success: true, method: "ghl" };
    } catch (err) {
      console.error(`[GHL Notification] ${type} webhook failed:`, err);
    }
  }

  if (result.method === "none" && process.env.RESEND_API_KEY && payload.email) {
    try {
      await sendResendFallback(type, payload, agency);
      result = { success: true, method: "resend" };
    } catch (err) {
      console.error(`[Resend Fallback] ${type} failed:`, err);
    }
  }

  if (result.method === "none") {
    console.log(`[Notification] ${type} for ${payload.firstName} — no notification method configured`);
    return result;
  }

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

  return result;
}

async function sendResendFallback(
  type: GHLNotificationType,
  payload: GHLNotificationPayload,
  agency: Agency
): Promise<void> {
  if (!process.env.RESEND_API_KEY || !payload.email) return;

  const templates: Partial<Record<GHLNotificationType, { subject: string; body: string }>> = {
    round_sent: {
      subject: `Your Round ${payload.data.round_number} dispute letters have been sent`,
      body: `Hi ${payload.firstName},\n\nYour Round ${payload.data.round_number} dispute letters have been sent to all three credit bureaus. Bureaus have up to 35 days to respond.\n\nView your progress: ${payload.data.portal_link}\n\n${agency.name} Team`,
    },
    deletion_win: {
      subject: `Great news — ${payload.data.deletions_this_round} item(s) deleted from your credit report`,
      body: `Hi ${payload.firstName},\n\nGreat news! ${payload.data.deletions_this_round} item(s) have been deleted from your credit report this round.\n\nTotal items deleted so far: ${payload.data.total_deletions}\n\nView your full progress: ${payload.data.portal_link}\n\n${agency.name} Team`,
    },
    goal_achieved: {
      subject: `Congratulations ${payload.firstName} — you've achieved your credit goal`,
      body: `Hi ${payload.firstName},\n\nCongratulations! You've achieved your credit goal.\n\nTotal items removed: ${payload.data.total_deletions}\nScore improvement: +${payload.data.score_improvement} points\n\nIt's been an honor working with you.\n\n${agency.name} Team`,
    },
    payment_failed: {
      subject: `Action required: payment failed for your credit repair service`,
      body: `Hi ${payload.firstName},\n\nYour payment of $${payload.data.monthly_fee}/month didn't go through. Please update your payment method to keep your service active: ${payload.data.portal_link}\n\nContact us: ${payload.data.agency_phone}\n\n${agency.name} Team`,
    },
  };

  const template = templates[type];
  if (!template) return;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${agency.name} <noreply@clientdeckpro.com>`,
      to: payload.email,
      subject: template.subject,
      text: template.body,
    }),
  });
}

function portalLinkFor(client: NotifiableClient): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://app.clientdeckpro.com";
  return `${base}/portal?token=${client.portal_token}`;
}

function dashboardLinkFor(clientId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://app.clientdeckpro.com";
  return `${base}/clients/${clientId}`;
}

function monthsSince(dateStr: string): number {
  const start = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30));
}

export interface RoundSentSummary {
  round_number: number;
  total_items_disputed: number;
  response_deadline: string;
}

export async function notifyRoundSent(agency: Agency, client: NotifiableClient, round: RoundSentSummary) {
  return sendGHLNotification(
    agency,
    "round_sent",
    {
      contactId: client.ghl_contact_id ?? "",
      firstName: client.first_name,
      lastName: client.last_name,
      email: client.email ?? undefined,
      data: {
        round_number: round.round_number,
        items_disputed: round.total_items_disputed,
        response_deadline: round.response_deadline,
        portal_link: portalLinkFor(client),
      },
    },
    { agencyId: agency.id, clientId: client.id }
  );
}

export async function notifyDeletionWin(
  agency: Agency,
  client: NotifiableClient,
  deletionsThisRound: number,
  totalDeletions: number,
  deletedItemNames: string[]
) {
  return sendGHLNotification(
    agency,
    "deletion_win",
    {
      contactId: client.ghl_contact_id ?? "",
      firstName: client.first_name,
      lastName: client.last_name,
      email: client.email ?? undefined,
      data: {
        deletions_this_round: deletionsThisRound,
        total_deletions: totalDeletions,
        deleted_items_list: deletedItemNames.join(", "),
        score_eq: client.score_eq_current ?? 0,
        score_exp: client.score_exp_current ?? 0,
        score_tu: client.score_tu_current ?? 0,
        portal_link: portalLinkFor(client),
      },
    },
    { agencyId: agency.id, clientId: client.id }
  );
}

export interface RoundResultsSummary {
  round_number: number;
  total_items_disputed: number;
  total_deletions: number;
  total_verified: number;
  total_no_response: number;
}

export async function notifyRoundResults(agency: Agency, client: NotifiableClient, round: RoundResultsSummary) {
  return sendGHLNotification(
    agency,
    "round_results_in",
    {
      contactId: client.ghl_contact_id ?? "",
      firstName: client.first_name,
      lastName: client.last_name,
      email: client.email ?? undefined,
      data: {
        round_number: round.round_number,
        total_deletions: round.total_deletions,
        total_verified: round.total_verified,
        total_no_response: round.total_no_response,
        total_items_disputed: round.total_items_disputed,
        has_wins: round.total_deletions > 0,
        portal_link: portalLinkFor(client),
      },
    },
    { agencyId: agency.id, clientId: client.id }
  );
}

export async function notifyGoalAchieved(agency: Agency, client: NotifiableClient) {
  const scoreImprovement = Math.round(
    (
      ((client.score_eq_current ?? 0) - (client.score_eq_start ?? 0)) +
      ((client.score_exp_current ?? 0) - (client.score_exp_start ?? 0)) +
      ((client.score_tu_current ?? 0) - (client.score_tu_start ?? 0))
    ) / 3
  );

  return sendGHLNotification(
    agency,
    "goal_achieved",
    {
      contactId: client.ghl_contact_id ?? "",
      firstName: client.first_name,
      lastName: client.last_name,
      email: client.email ?? undefined,
      data: {
        total_deletions: client.total_items_deleted,
        score_improvement: scoreImprovement,
        final_score_eq: client.score_eq_current ?? 0,
        final_score_exp: client.score_exp_current ?? 0,
        final_score_tu: client.score_tu_current ?? 0,
        months_in_program: monthsSince(client.service_start_date),
        portal_link: portalLinkFor(client),
        review_link: agency.settings?.google_review_link ?? "",
      },
    },
    { agencyId: agency.id, clientId: client.id }
  );
}

export async function notifyPaymentFailed(agency: Agency, client: NotifiableClient) {
  return sendGHLNotification(
    agency,
    "payment_failed",
    {
      contactId: client.ghl_contact_id ?? "",
      firstName: client.first_name,
      lastName: client.last_name,
      email: client.email ?? undefined,
      data: {
        monthly_fee: client.monthly_fee,
        portal_link: portalLinkFor(client),
        agency_phone: agency.phone ?? "",
      },
    },
    { agencyId: agency.id, clientId: client.id }
  );
}

export async function notifyPortalLink(agency: Agency, client: NotifiableClient) {
  return sendGHLNotification(
    agency,
    "portal_link",
    {
      contactId: client.ghl_contact_id ?? "",
      firstName: client.first_name,
      lastName: client.last_name,
      email: client.email ?? undefined,
      data: {
        portal_link: portalLinkFor(client),
        agency_name: agency.name,
      },
    },
    { agencyId: agency.id, clientId: client.id }
  );
}

export async function notifyStaffNewClient(agency: Agency, client: NotifiableClient) {
  const ownerContactId = agency.settings?.owner_ghl_contact_id;
  if (!ownerContactId) return { success: false, method: "none" as const };

  return sendGHLNotification(
    agency,
    "staff_new_client",
    {
      contactId: ownerContactId,
      firstName: "Team",
      lastName: agency.name,
      data: {
        client_name: `${client.first_name} ${client.last_name}`,
        client_email: client.email ?? "",
        client_phone: client.phone ?? "",
        dashboard_link: dashboardLinkFor(client.id),
      },
    },
    { agencyId: agency.id, clientId: client.id }
  );
}

export async function notifyStaffRoundOverdue(
  agency: Agency,
  client: NotifiableClient,
  roundNumber: number,
  daysOverdue: number
) {
  const ownerContactId = agency.settings?.owner_ghl_contact_id;
  if (!ownerContactId) return { success: false, method: "none" as const };

  return sendGHLNotification(
    agency,
    "staff_round_overdue",
    {
      contactId: ownerContactId,
      firstName: "Team",
      lastName: agency.name,
      data: {
        client_name: `${client.first_name} ${client.last_name}`,
        round_number: roundNumber,
        days_overdue: daysOverdue,
        dashboard_link: dashboardLinkFor(client.id),
      },
    },
    { agencyId: agency.id, clientId: client.id }
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing `notifications.ts` or `AgencySettings`.

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/lib/ghl/notifications.ts
git commit -m "feat: add GHL webhook notification service"
```

---

### Task 2: Wire round-sent and round-results notifications

**Files:**
- Modify: `src/app/(dashboard)/clients/[id]/rounds/actions.ts`

**Interfaces:**
- Consumes: `notifyRoundSent`, `notifyDeletionWin`, `notifyRoundResults`, `NOTIFIABLE_CLIENT_COLUMNS`, `NotifiableClient` from `@/lib/ghl/notifications` (Task 1).

- [ ] **Step 1: Add the import**

At the top of the file, alongside the existing imports:

```ts
import {
  notifyRoundSent,
  notifyDeletionWin,
  notifyRoundResults,
  NOTIFIABLE_CLIENT_COLUMNS,
  type NotifiableClient,
} from "@/lib/ghl/notifications";
```

- [ ] **Step 2: Wire `markRoundSent`**

Replace this block (currently around line 258–291):

```ts
  await supabase
    .from("clients")
    .update({ current_round: round.round_number, status: "active" })
    .eq("id", clientId);

  // Best-effort GHL sync (logged to ghl_sync_log for visibility + retry).
  const { ghl_api_key, ghl_location_id } = session.agency;
  if (ghl_api_key && ghl_location_id) {
    const { data: client } = await supabase
      .from("clients")
      .select("ghl_contact_id")
      .eq("id", clientId)
      .single();
    if (client?.ghl_contact_id) {
      const contactId = client.ghl_contact_id;
      await runGhlSync({
        agencyId: session.agency.id,
        clientId,
        action: "sync_round_sent",
        payload: {
          contactId,
          roundNumber: round.round_number,
          itemsDisputed: round.total_items_disputed,
        },
        run: () =>
          syncRoundSent(
            contactId,
            round.round_number,
            round.total_items_disputed,
            { apiKey: ghl_api_key, locationId: ghl_location_id }
          ),
      });
    }
  }
```

with:

```ts
  await supabase
    .from("clients")
    .update({ current_round: round.round_number, status: "active" })
    .eq("id", clientId);

  const { data: notifClient } = await supabase
    .from("clients")
    .select(NOTIFIABLE_CLIENT_COLUMNS)
    .eq("id", clientId)
    .single();

  // Best-effort GHL field/tag sync (existing channel, logged to ghl_sync_log).
  const { ghl_api_key, ghl_location_id } = session.agency;
  if (ghl_api_key && ghl_location_id && notifClient?.ghl_contact_id) {
    const contactId = notifClient.ghl_contact_id;
    await runGhlSync({
      agencyId: session.agency.id,
      clientId,
      action: "sync_round_sent",
      payload: {
        contactId,
        roundNumber: round.round_number,
        itemsDisputed: round.total_items_disputed,
      },
      run: () =>
        syncRoundSent(
          contactId,
          round.round_number,
          round.total_items_disputed,
          { apiKey: ghl_api_key, locationId: ghl_location_id }
        ),
    });
  }

  // Best-effort GHL webhook notification (independent channel — SMS/email content).
  if (notifClient) {
    await notifyRoundSent(session.agency, notifClient as NotifiableClient, {
      round_number: round.round_number,
      total_items_disputed: round.total_items_disputed,
      response_deadline: deadline,
    });
  }
```

- [ ] **Step 3: Wire `logResults` — expand the round select**

Replace:

```ts
  const { data: round } = await supabase
    .from("dispute_rounds")
    .select("round_number")
    .eq("id", roundId)
    .single();
  if (!round) return { success: false, error: "Round not found." };
```

with:

```ts
  const { data: round } = await supabase
    .from("dispute_rounds")
    .select("round_number, total_items_disputed")
    .eq("id", roundId)
    .single();
  if (!round) return { success: false, error: "Round not found." };
```

- [ ] **Step 4: Wire `logResults` — capture deleted item names**

Immediately after the `for (const entry of entries) { ... }` loop (right before `await supabase.from("dispute_rounds").update({ status: "complete", ...`), add:

```ts
  const deletedItemIds = entries
    .filter((e) => e.result === "deleted")
    .map((e) => e.negativeItemId);
  let deletedItemNames: string[] = [];
  if (deletedItemIds.length > 0) {
    const { data: deletedRows } = await supabase
      .from("negative_items")
      .select("creditor_name")
      .in("id", deletedItemIds);
    deletedItemNames = (deletedRows ?? []).map((r) => r.creditor_name);
  }
```

- [ ] **Step 5: Wire `logResults` — fetch the notifiable client once**

Right after `await recomputeClientItemTotals(supabase, clientId);`, add:

```ts
  const { data: notifClient } = await supabase
    .from("clients")
    .select(NOTIFIABLE_CLIENT_COLUMNS)
    .eq("id", clientId)
    .single();
```

- [ ] **Step 6: Wire `logResults` — replace the existing deletion-sync block**

Replace this block (the `if (tally.deletions > 0) { ... }` block that calls `syncDeletionAchieved`):

```ts
  if (tally.deletions > 0) {
    const { ghl_api_key, ghl_location_id } = session.agency;
    if (ghl_api_key && ghl_location_id) {
      const { data: client } = await supabase
        .from("clients")
        .select("ghl_contact_id")
        .eq("id", clientId)
        .single();
      if (client?.ghl_contact_id) {
        const contactId = client.ghl_contact_id;
        const deletions = tally.deletions;
        const total = totalDeleted ?? 0;
        await runGhlSync({
          agencyId: session.agency.id,
          clientId,
          action: "sync_deletion",
          payload: {
            contactId,
            deletionsThisRound: deletions,
            totalDeletions: total,
          },
          run: () =>
            syncDeletionAchieved(contactId, deletions, total, {
              apiKey: ghl_api_key,
              locationId: ghl_location_id,
            }),
        });
      }
    }
  }
```

with:

```ts
  if (tally.deletions > 0) {
    const { ghl_api_key, ghl_location_id } = session.agency;
    if (ghl_api_key && ghl_location_id && notifClient?.ghl_contact_id) {
      const contactId = notifClient.ghl_contact_id;
      const deletions = tally.deletions;
      const total = totalDeleted ?? 0;
      await runGhlSync({
        agencyId: session.agency.id,
        clientId,
        action: "sync_deletion",
        payload: {
          contactId,
          deletionsThisRound: deletions,
          totalDeletions: total,
        },
        run: () =>
          syncDeletionAchieved(contactId, deletions, total, {
            apiKey: ghl_api_key,
            locationId: ghl_location_id,
          }),
      });
    }
  }

  if (notifClient) {
    if (tally.deletions > 0) {
      await notifyDeletionWin(
        session.agency,
        notifClient as NotifiableClient,
        tally.deletions,
        totalDeleted ?? 0,
        deletedItemNames
      );
    }
    await notifyRoundResults(session.agency, notifClient as NotifiableClient, {
      round_number: round.round_number,
      total_items_disputed: round.total_items_disputed,
      total_deletions: tally.deletions,
      total_verified: tally.verified,
      total_no_response: tally.no_response,
    });
  }
```

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Manual verification**

Run `npm run dev`, seed demo data if needed (`npm run seed`), open a client with an active round, mark it sent, then log results with at least one "deleted" outcome. Check the terminal for `[Notification] round_sent for ... — no notification method configured` and `[Notification] deletion_win ...` / `round_results_in ...` log lines (expected since no webhook is configured yet), and confirm three new `notification_sent` rows appear in `activity_log` for that client (via Supabase table editor or the client's existing Timeline tab).

- [ ] **Step 9: Commit**

```bash
git add src/app/\(dashboard\)/clients/\[id\]/rounds/actions.ts
git commit -m "feat: wire round-sent and round-results GHL notifications"
```

---

### Task 3: Wire goal-achieved notification

**Files:**
- Modify: `src/app/(dashboard)/clients/[id]/rounds/actions.ts` (`markClientCompleted`)

**Interfaces:**
- Consumes: `notifyGoalAchieved`, `NOTIFIABLE_CLIENT_COLUMNS`, `NotifiableClient` (already imported in Task 2).

- [ ] **Step 1: Replace `markClientCompleted`**

Replace the whole function:

```ts
export async function markClientCompleted(
  clientId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("clients")
    .update({ status: "completed" })
    .eq("id", clientId);
  if (error) return { success: false, error: error.message };

  const { ghl_api_key, ghl_location_id } = session.agency;
  if (ghl_api_key && ghl_location_id) {
    const { data: client } = await supabase
      .from("clients")
      .select("ghl_contact_id")
      .eq("id", clientId)
      .single();
    if (client?.ghl_contact_id) {
      const contactId = client.ghl_contact_id;
      await runGhlSync({
        agencyId: session.agency.id,
        clientId,
        action: "sync_completed",
        payload: { contactId },
        run: () =>
          syncClientCompleted(contactId, {
            apiKey: ghl_api_key,
            locationId: ghl_location_id,
          }),
      });
    }
  }

  await supabase.from("activity_log").insert({
    agency_id: session.agency.id,
    client_id: clientId,
    actor_type: "staff",
    actor_id: session.userId,
    action: "Client completed",
    description: "Client marked as completed — goal achieved.",
  });

  revalidatePath(`/clients/${clientId}`);
  return { success: true };
}
```

with:

```ts
export async function markClientCompleted(
  clientId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("clients")
    .update({ status: "completed" })
    .eq("id", clientId);
  if (error) return { success: false, error: error.message };

  const { data: notifClient } = await supabase
    .from("clients")
    .select(NOTIFIABLE_CLIENT_COLUMNS)
    .eq("id", clientId)
    .single();

  const { ghl_api_key, ghl_location_id } = session.agency;
  if (ghl_api_key && ghl_location_id && notifClient?.ghl_contact_id) {
    const contactId = notifClient.ghl_contact_id;
    await runGhlSync({
      agencyId: session.agency.id,
      clientId,
      action: "sync_completed",
      payload: { contactId },
      run: () =>
        syncClientCompleted(contactId, {
          apiKey: ghl_api_key,
          locationId: ghl_location_id,
        }),
    });
  }

  if (notifClient) {
    await notifyGoalAchieved(session.agency, notifClient as NotifiableClient);
  }

  await supabase.from("activity_log").insert({
    agency_id: session.agency.id,
    client_id: clientId,
    actor_type: "staff",
    actor_id: session.userId,
    action: "Client completed",
    description: "Client marked as completed — goal achieved.",
  });

  revalidatePath(`/clients/${clientId}`);
  return { success: true };
}
```

- [ ] **Step 2: Add the import**

Add `notifyGoalAchieved` to the existing `@/lib/ghl/notifications` import added in Task 2.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Mark a demo client completed from the client detail page, confirm a `notification_sent` (`goal_achieved`) row lands in `activity_log` and the console log fires.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/clients/\[id\]/rounds/actions.ts
git commit -m "feat: wire goal-achieved GHL notification"
```

---

### Task 4: Wire portal-link notification

**Files:**
- Modify: `src/app/(dashboard)/clients/[id]/portal-actions.ts`

**Interfaces:**
- Consumes: `notifyPortalLink`, `NOTIFIABLE_CLIENT_COLUMNS`, `NotifiableClient` from `@/lib/ghl/notifications`.

- [ ] **Step 1: Replace the file**

```ts
"use server";

import { getSessionContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { generatePortalLink } from "@/lib/utils/portal-token";
import { updateGHLContactFields } from "@/lib/ghl/api";
import { markOnboardingStep } from "@/lib/onboarding/mark";
import {
  notifyPortalLink,
  NOTIFIABLE_CLIENT_COLUMNS,
  type NotifiableClient,
} from "@/lib/ghl/notifications";

/**
 * Rotates the client's portal token, returns a fresh magic-link URL, and
 * (best-effort) pushes it into the GHL `clientdeck_portal_link` custom field so
 * an agency workflow can SMS it to the client.
 */
export async function generateAndSyncPortalLink(
  clientId: string
): Promise<{ success: true; url: string } | { success: false; error: string }> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  // Confirm the client belongs to this agency (RLS-scoped read).
  const supabase = await createServerSupabaseClient();
  const { data: client } = await supabase
    .from("clients")
    .select(NOTIFIABLE_CLIENT_COLUMNS)
    .eq("id", clientId)
    .single();
  if (!client) return { success: false, error: "Client not found." };

  let url: string;
  try {
    url = await generatePortalLink(clientId, session.agency.id);
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Could not generate link.",
    };
  }

  // Best-effort GHL field sync.
  const { ghl_api_key, ghl_location_id } = session.agency;
  if (ghl_api_key && ghl_location_id && client.ghl_contact_id) {
    try {
      await updateGHLContactFields(
        client.ghl_contact_id,
        { clientdeck_portal_link: url },
        { apiKey: ghl_api_key, locationId: ghl_location_id }
      );
    } catch (e) {
      console.error("Failed to sync portal link to GHL:", e);
    }
  }

  // Best-effort GHL webhook notification. `client.portal_token` was just
  // rotated by generatePortalLink() above but the in-memory row still has the
  // old value, so build the payload from the fresh `url` instead of relying
  // on notifyPortalLink()'s own portal_token lookup.
  await notifyPortalLink(session.agency, {
    ...(client as NotifiableClient),
    portal_token: new URL(url).searchParams.get("token"),
  });

  await supabase.from("activity_log").insert({
    agency_id: session.agency.id,
    client_id: clientId,
    actor_type: "staff",
    actor_id: session.userId,
    action: "Portal link generated",
    description: "A new client portal magic link was generated.",
  });

  await markOnboardingStep(session.agency.id, "test_portal_viewed", true);

  return { success: true, url };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual verification**

From a client detail page, click "Copy Portal Link" (or the equivalent action that calls `generateAndSyncPortalLink`), confirm the console log / `activity_log` row shows a `portal_link` notification with the newly-rotated token embedded in its `portal_link` data field (not the stale one).

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/clients/\[id\]/portal-actions.ts
git commit -m "feat: wire portal-link GHL notification"
```

---

### Task 5: Wire staff-new-client notification (onboarding webhook)

**Files:**
- Modify: `src/app/api/ghl/onboarding/route.ts`

**Interfaces:**
- Consumes: `notifyStaffNewClient`, `NotifiableClient` from `@/lib/ghl/notifications`.

- [ ] **Step 1: Add the import**

```ts
import { notifyStaffNewClient, type NotifiableClient } from "@/lib/ghl/notifications";
```

- [ ] **Step 2: Track whether this is a new client and notify inside `after()`**

Replace:

```ts
    let clientId: string;
    if (existing) {
      await supabase
        .from("clients")
        .update({
          ...clientData,
          onboarding_form_submitted: true,
          onboarding_submitted_at: new Date().toISOString(),
          status: "analysis",
        })
        .eq("id", existing.id);
      clientId = existing.id;
    } else {
      const { data: newClient, error: insertErr } = await supabase
        .from("clients")
        .insert({
          agency_id: agency.id,
          ghl_contact_id: contactId,
          ...clientData,
          onboarding_form_submitted: true,
          onboarding_submitted_at: new Date().toISOString(),
          status: "analysis",
        })
        .select("id")
        .single();
      if (insertErr || !newClient) {
        throw new Error(insertErr?.message ?? "Failed to create client");
      }
      clientId = newClient.id;
    }
```

with:

```ts
    let clientId: string;
    const isNewClient = !existing;
    if (existing) {
      await supabase
        .from("clients")
        .update({
          ...clientData,
          onboarding_form_submitted: true,
          onboarding_submitted_at: new Date().toISOString(),
          status: "analysis",
        })
        .eq("id", existing.id);
      clientId = existing.id;
    } else {
      const { data: newClient, error: insertErr } = await supabase
        .from("clients")
        .insert({
          agency_id: agency.id,
          ghl_contact_id: contactId,
          ...clientData,
          onboarding_form_submitted: true,
          onboarding_submitted_at: new Date().toISOString(),
          status: "analysis",
        })
        .select("id")
        .single();
      if (insertErr || !newClient) {
        throw new Error(insertErr?.message ?? "Failed to create client");
      }
      clientId = newClient.id;
    }
```

Then replace the `after(async () => { ... })` block:

```ts
    // Heavier work runs after the response is flushed (guaranteed by after()).
    after(async () => {
      try {
        await syncOnboardingDocsToDrive(agency, contact);
      } catch (err) {
        console.error("[Onboarding] Drive sync error:", err);
      }
      try {
        const fields: Record<string, string> = { clientdeck_client_id: clientId };
        if (portalLink) fields.clientdeck_portal_link = portalLink;
        await updateGHLContactFields(contactId, fields, opts);
      } catch (err) {
        console.error("[Onboarding] GHL field sync error:", err);
      }
    });
```

with:

```ts
    // Heavier work runs after the response is flushed (guaranteed by after()).
    after(async () => {
      try {
        await syncOnboardingDocsToDrive(agency, contact);
      } catch (err) {
        console.error("[Onboarding] Drive sync error:", err);
      }
      try {
        const fields: Record<string, string> = { clientdeck_client_id: clientId };
        if (portalLink) fields.clientdeck_portal_link = portalLink;
        await updateGHLContactFields(contactId, fields, opts);
      } catch (err) {
        console.error("[Onboarding] GHL field sync error:", err);
      }
      if (isNewClient) {
        try {
          const notifClient: NotifiableClient = {
            id: clientId,
            first_name: clientData.first_name,
            last_name: clientData.last_name,
            email: clientData.email,
            phone: clientData.phone,
            ghl_contact_id: contactId,
            portal_token: portalLink ? new URL(portalLink).searchParams.get("token") : null,
            monthly_fee: 0,
            total_items_deleted: 0,
            service_start_date: new Date().toISOString().split("T")[0],
            score_eq_current: clientData.score_eq_current,
            score_exp_current: clientData.score_exp_current,
            score_tu_current: clientData.score_tu_current,
            score_eq_start: clientData.score_eq_start,
            score_exp_start: clientData.score_exp_start,
            score_tu_start: clientData.score_tu_start,
          };
          await notifyStaffNewClient(agency, notifClient);
        } catch (err) {
          console.error("[Onboarding] Staff notification error:", err);
        }
      }
    });
```

(This route builds the `NotifiableClient` from the already-computed `clientData` + `clientId` instead of re-querying the row, since `notifyStaffNewClient` only actually reads `first_name`, `last_name`, `email`, `phone`, `id` — the rest of the shape is filled with harmless placeholders to satisfy the type.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification**

`agency.settings.owner_ghl_contact_id` isn't configured yet (Task 9 adds the UI), so this will hit the `if (!ownerContactId) return { success: false, method: "none" }` short-circuit in `notifyStaffNewClient` — confirm via a `curl` POST to `/api/ghl/onboarding` with a valid `contactId`/`locationId` for a seeded agency that no error is thrown (route still returns `{ success: true, clientId }`) and no `notification_sent` row is created (since there's no owner contact id yet).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/ghl/onboarding/route.ts
git commit -m "feat: wire staff-new-client GHL notification"
```

---

### Task 6: Wire staff-round-overdue notification (check-deadlines cron)

**Files:**
- Modify: `src/app/api/cron/check-deadlines/route.ts`

**Interfaces:**
- Consumes: `notifyStaffRoundOverdue`, `NotifiableClient`.

- [ ] **Step 1: Add the import and fix the join to include client id + fields**

Replace:

```ts
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { createGHLTask } from "@/lib/ghl/api";
import { daysRemaining } from "@/lib/utils/helpers";

export const maxDuration = 120;

interface OverdueRoundRow {
  id: string;
  round_number: number;
  agency_id: string;
  client_id: string;
  response_deadline: string;
  client: {
    first_name: string;
    last_name: string;
    ghl_contact_id: string | null;
  } | null;
  agency: {
    ghl_api_key: string | null;
    ghl_location_id: string | null;
  } | null;
}
```

with:

```ts
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { createGHLTask } from "@/lib/ghl/api";
import { daysRemaining } from "@/lib/utils/helpers";
import { notifyStaffRoundOverdue, type NotifiableClient } from "@/lib/ghl/notifications";
import type { Agency } from "@/types";

export const maxDuration = 120;

interface OverdueRoundRow {
  id: string;
  round_number: number;
  agency_id: string;
  client_id: string;
  response_deadline: string;
  client: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    ghl_contact_id: string | null;
  } | null;
  agency: Agency | null;
}
```

- [ ] **Step 2: Broaden the select and pass the full agency row**

Replace:

```ts
  const { data, error } = await admin
    .from("dispute_rounds")
    .select(
      "id, round_number, agency_id, client_id, response_deadline, client:clients(first_name, last_name, ghl_contact_id), agency:agencies(ghl_api_key, ghl_location_id)"
    )
    .eq("status", "awaiting_response")
    .lt("response_deadline", today);
```

with:

```ts
  const { data, error } = await admin
    .from("dispute_rounds")
    .select(
      "id, round_number, agency_id, client_id, response_deadline, client:clients(id, first_name, last_name, email, phone, ghl_contact_id), agency:agencies(*)"
    )
    .eq("status", "awaiting_response")
    .lt("response_deadline", today);
```

- [ ] **Step 3: Add the notification call**

Replace the GHL task block:

```ts
    // Best-effort GHL reminder task for staff.
    const apiKey = round.agency?.ghl_api_key;
    const locationId = round.agency?.ghl_location_id;
    const contactId = round.client?.ghl_contact_id;
    if (apiKey && locationId && contactId) {
      try {
        await createGHLTask(
          contactId,
          `Escalate Round ${round.round_number} — bureau response overdue`,
          new Date().toISOString(),
          { apiKey, locationId }
        );
      } catch (e) {
        console.error("check-deadlines: GHL task failed", e);
      }
    }
```

with:

```ts
    // Best-effort GHL reminder task for staff (existing channel).
    const apiKey = round.agency?.ghl_api_key;
    const locationId = round.agency?.ghl_location_id;
    const contactId = round.client?.ghl_contact_id;
    if (apiKey && locationId && contactId) {
      try {
        await createGHLTask(
          contactId,
          `Escalate Round ${round.round_number} — bureau response overdue`,
          new Date().toISOString(),
          { apiKey, locationId }
        );
      } catch (e) {
        console.error("check-deadlines: GHL task failed", e);
      }
    }

    // Best-effort GHL webhook notification (independent channel).
    if (round.agency && round.client) {
      const notifClient: NotifiableClient = {
        id: round.client.id,
        first_name: round.client.first_name,
        last_name: round.client.last_name,
        email: round.client.email,
        phone: round.client.phone,
        ghl_contact_id: round.client.ghl_contact_id,
        portal_token: null,
        monthly_fee: 0,
        total_items_deleted: 0,
        service_start_date: today,
        score_eq_current: null,
        score_exp_current: null,
        score_tu_current: null,
        score_eq_start: null,
        score_exp_start: null,
        score_tu_start: null,
      };
      try {
        await notifyStaffRoundOverdue(round.agency, notifClient, round.round_number, daysOver);
      } catch (e) {
        console.error("check-deadlines: staff notification failed", e);
      }
    }
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual verification**

Run: `curl "http://localhost:3000/api/cron/check-deadlines?secret=$CRON_SECRET"` against a dev server with a seeded overdue round. Expect a 200 JSON response with `overdueCount`/`newlyFlagged`/`clientsAffected`, and (since `owner_ghl_contact_id` still isn't configured) no thrown errors in the server console.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/cron/check-deadlines/route.ts
git commit -m "feat: wire staff-round-overdue GHL notification"
```

---

### Task 7: Wire staff-next-round-ready notification (auto-create-rounds cron)

**Files:**
- Modify: `src/app/api/cron/auto-create-rounds/route.ts`

**Interfaces:**
- Consumes: `sendGHLNotification` directly (no dedicated helper — matches the original spec, which fires this one inline rather than through a named wrapper).

- [ ] **Step 1: Add the import**

```ts
import { sendGHLNotification } from "@/lib/ghl/notifications";
import type { Agency } from "@/types";
```

- [ ] **Step 2: Cast the agency row and fire the notification**

The loop currently does `for (const agency of agencies ?? []) { ... }` where `agency` comes from `.select("id, settings, ghl_api_key, ghl_location_id")` — too narrow for `sendGHLNotification`, which needs the full `Agency` shape (specifically `agency.settings.ghl_webhook_triggers`, `agency.settings.owner_ghl_contact_id`, and `agency.name` for the payload). Broaden the agencies select:

Replace:

```ts
  const { data: agencies } = await admin
    .from("agencies")
    .select("id, settings, ghl_api_key, ghl_location_id");
```

with:

```ts
  const { data: agencies } = await admin.from("agencies").select("*");
```

Then replace the GHL sync block inside the inner `for (const client of clients ?? [])` loop:

```ts
      const opts = agency.ghl_api_key && agency.ghl_location_id
        ? { apiKey: agency.ghl_api_key, locationId: agency.ghl_location_id }
        : null;
      if (opts && client.ghl_contact_id) {
        try {
          await addGHLTag(client.ghl_contact_id, ["next-round-ready"], opts);
          await createGHLTask(
            client.ghl_contact_id,
            `Round ${roundNumber} is ready for ${client.first_name} ${client.last_name} — review and generate letters`,
            new Date().toISOString(),
            opts
          );
        } catch (e) { console.error("auto-create-rounds: GHL sync failed", e); }
      }
      created++;
```

with:

```ts
      const opts = agency.ghl_api_key && agency.ghl_location_id
        ? { apiKey: agency.ghl_api_key, locationId: agency.ghl_location_id }
        : null;
      if (opts && client.ghl_contact_id) {
        try {
          await addGHLTag(client.ghl_contact_id, ["next-round-ready"], opts);
          await createGHLTask(
            client.ghl_contact_id,
            `Round ${roundNumber} is ready for ${client.first_name} ${client.last_name} — review and generate letters`,
            new Date().toISOString(),
            opts
          );
        } catch (e) { console.error("auto-create-rounds: GHL sync failed", e); }
      }

      const ownerContactId = (agency as Agency).settings?.owner_ghl_contact_id;
      if (ownerContactId) {
        try {
          const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://app.clientdeckpro.com";
          await sendGHLNotification(
            agency as Agency,
            "staff_next_round_ready",
            {
              contactId: ownerContactId,
              firstName: "Team",
              lastName: (agency as Agency).name,
              data: {
                client_name: `${client.first_name} ${client.last_name}`,
                round_number: roundNumber,
                dashboard_link: `${base}/clients/${client.id}`,
              },
            },
            { agencyId: agency.id, clientId: client.id }
          );
        } catch (e) {
          console.error("auto-create-rounds: staff notification failed", e);
        }
      }
      created++;
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. (The `clients` select in this file already includes `first_name`, `last_name`, `ghl_contact_id`, `id` — no change needed there.)

- [ ] **Step 4: Manual verification**

Run: `curl "http://localhost:3000/api/cron/auto-create-rounds?secret=$CRON_SECRET"` against a dev server with a seeded client whose last round is complete and past the delay window. Expect `{ roundsCreated: <n> }` with no thrown errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/auto-create-rounds/route.ts
git commit -m "feat: wire staff-next-round-ready GHL notification"
```

---

### Task 8: Wire payment-failed notification (Stripe webhook)

**Files:**
- Modify: `src/app/api/stripe/webhook/route.ts`

**Interfaces:**
- Consumes: `notifyPaymentFailed`, `NOTIFIABLE_CLIENT_COLUMNS`, `NotifiableClient`.

Note: this webhook's `invoice.payment_failed` case currently only checks the `agencies` table by `stripe_customer_id` — that's the agency's *own* SaaS subscription to ClientDeck Pro. But `clients` also have their own `stripe_customer_id` (see `src/app/portal/(client)/billing/page.tsx` and `src/app/api/portal/stripe-portal/route.ts` — clients manage their own payment method via a Stripe customer portal). Today, if a client's payment fails, this webhook does nothing. This task adds that missing branch.

- [ ] **Step 1: Add the import**

```ts
import { notifyPaymentFailed, NOTIFIABLE_CLIENT_COLUMNS, type NotifiableClient } from "@/lib/ghl/notifications";
import type { Agency } from "@/types";
```

- [ ] **Step 2: Replace the `invoice.payment_failed` case**

Replace:

```ts
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
```

with:

```ts
      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        const customerId = inv.customer as string | null;
        const agencyId = await findAgencyId(customerId);

        if (agencyId) {
          // The agency's own SaaS subscription to ClientDeck Pro failed.
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
          break;
        }

        // Not the agency's own subscription — check whether it's a client's
        // own Stripe customer (clients manage their monthly fee separately).
        if (customerId) {
          const { data: client } = await admin
            .from("clients")
            .select(`${NOTIFIABLE_CLIENT_COLUMNS}, agency_id`)
            .eq("stripe_customer_id", customerId)
            .maybeSingle();

          if (client) {
            await admin
              .from("clients")
              .update({ payment_status: "failed" })
              .eq("id", client.id);

            const { data: clientAgency } = await admin
              .from("agencies")
              .select("*")
              .eq("id", client.agency_id)
              .single();

            if (clientAgency) {
              await notifyPaymentFailed(clientAgency as Agency, client as NotifiableClient);
            }

            await admin.from("activity_log").insert({
              agency_id: client.agency_id,
              client_id: client.id,
              actor_type: "system",
              action: "Payment failed",
              description: "A client's monthly service payment failed.",
            });
          }
        }
        break;
      }
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Using the Stripe CLI against the local dev server (`stripe listen --forward-to localhost:3000/api/stripe/webhook` + `stripe trigger invoice.payment_failed`), confirm the webhook still 200s. Full end-to-end (a client actually having a `stripe_customer_id` with a failing invoice) isn't easily triggerable via `stripe trigger` for an arbitrary customer, so it's acceptable to verify this branch by temporarily logging `customerId`/`client` inside the handler during a manual test, or by code review + `tsc` if Stripe CLI isn't available in this environment — note in the PR/commit which verification path was used.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/stripe/webhook/route.ts
git commit -m "feat: wire client payment-failed GHL notification"
```

---

### Task 9: Settings UI — Notification Webhooks (save form)

**Files:**
- Modify: `src/app/(dashboard)/settings/actions.ts`
- Create: `src/app/(dashboard)/settings/ghl/notification-webhooks-form.tsx`
- Modify: `src/app/(dashboard)/settings/ghl/page.tsx`

**Interfaces:**
- Produces: `updateNotificationWebhooks()` server action, `<NotificationWebhooksForm>` component — consumed by Task 10 (adds Test buttons to the same component).

- [ ] **Step 1: Add the server action**

In `src/app/(dashboard)/settings/actions.ts`, add the import and the action (after `saveGhlFieldKeys`):

```ts
import type { GHLNotificationType } from "@/lib/ghl/notifications";
```

```ts
/** Saves the agency's GHL notification webhook URLs + owner contact id (agencies.settings). */
export async function updateNotificationWebhooks(input: {
  ghlWebhookTriggers: Partial<Record<GHLNotificationType, string>>;
  ownerGhlContactId: string;
}): Promise<ActionResult> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  const cleanTriggers: Partial<Record<GHLNotificationType, string>> = {};
  for (const [key, value] of Object.entries(input.ghlWebhookTriggers)) {
    const url = safeHttpUrl(value ?? "");
    if (url) cleanTriggers[key as GHLNotificationType] = url;
  }

  const supabase = await createServerSupabaseClient();
  const nextSettings: AgencySettings = {
    ...session.agency.settings,
    ghl_webhook_triggers: cleanTriggers,
    owner_ghl_contact_id: input.ownerGhlContactId.trim() || undefined,
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

- [ ] **Step 2: Create `notification-webhooks-form.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { updateNotificationWebhooks } from "../actions";
import type { GHLNotificationType } from "@/lib/ghl/notifications";

const CLIENT_TYPES: { key: GHLNotificationType; label: string }[] = [
  { key: "round_sent", label: "Round Sent to Bureaus" },
  { key: "deletion_win", label: "Deletion Win" },
  { key: "round_results_in", label: "Round Results In" },
  { key: "goal_achieved", label: "Goal Achieved" },
  { key: "payment_failed", label: "Payment Failed" },
  { key: "portal_link", label: "Portal Link Sent" },
];

const STAFF_TYPES: { key: GHLNotificationType; label: string }[] = [
  { key: "staff_new_client", label: "New Client Onboarded" },
  { key: "staff_round_overdue", label: "Round Overdue Alert" },
  { key: "staff_next_round_ready", label: "Next Round Ready" },
];

interface NotificationWebhooksFormProps {
  initial: {
    triggers: Partial<Record<GHLNotificationType, string>>;
    ownerGhlContactId: string;
  };
}

export function NotificationWebhooksForm({ initial }: NotificationWebhooksFormProps) {
  const { toast } = useToast();
  const [triggers, setTriggers] = useState(initial.triggers);
  const [ownerGhlContactId, setOwnerGhlContactId] = useState(initial.ownerGhlContactId);
  const [pending, setPending] = useState(false);

  function setTrigger(key: GHLNotificationType, value: string) {
    setTriggers((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setPending(true);
    const result = await updateNotificationWebhooks({
      ghlWebhookTriggers: triggers,
      ownerGhlContactId,
    });
    setPending(false);
    if (result.success) toast("Webhook URLs saved.", "success");
    else toast(result.error ?? "Could not save.", "error");
  }

  return (
    <Card>
      <CardHeader
        title="Notification Webhooks"
        description="Connect your GHL workflows to receive automatic notifications. In GHL, create a workflow with a Custom Webhook trigger, then paste its URL here."
      />
      <div className="space-y-5 p-6">
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Client Notifications
          </h3>
          <div className="space-y-4">
            {CLIENT_TYPES.map(({ key, label }) => (
              <Field key={key} label={label} htmlFor={key}>
                <Input
                  id={key}
                  value={triggers[key] ?? ""}
                  onChange={(e) => setTrigger(key, e.target.value)}
                  placeholder="https://hooks.gohighlevel.com/hooks/..."
                  className="font-mono text-xs"
                />
              </Field>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Staff Notifications
          </h3>
          <div className="space-y-4">
            {STAFF_TYPES.map(({ key, label }) => (
              <Field key={key} label={label} htmlFor={key}>
                <Input
                  id={key}
                  value={triggers[key] ?? ""}
                  onChange={(e) => setTrigger(key, e.target.value)}
                  placeholder="https://hooks.gohighlevel.com/hooks/..."
                  className="font-mono text-xs"
                />
              </Field>
            ))}
          </div>
        </div>

        <Field
          label="Owner GHL Contact ID"
          htmlFor="ownerGhlContactId"
          hint="Your own contact ID in GHL — staff alerts go to this contact. Find it: GHL → Contacts → your profile → copy the ID from the URL."
        >
          <Input
            id="ownerGhlContactId"
            value={ownerGhlContactId}
            onChange={(e) => setOwnerGhlContactId(e.target.value)}
            placeholder="e.g. abc123XYZ"
          />
        </Field>

        <div className="flex justify-end">
          <Button onClick={handleSave} loading={pending}>
            Save Webhook URLs
          </Button>
        </div>
      </div>
    </Card>
  );
}
```

- [ ] **Step 3: Wire it into the GHL settings page**

In `src/app/(dashboard)/settings/ghl/page.tsx`, add the import and render it after `<OnboardingWebhookCard />`:

```tsx
import { NotificationWebhooksForm } from "./notification-webhooks-form";
```

```tsx
      <OnboardingWebhookCard webhookUrl={onboardingWebhookUrl} />
      <NotificationWebhooksForm
        initial={{
          triggers: agency.settings?.ghl_webhook_triggers ?? {},
          ownerGhlContactId: agency.settings?.owner_ghl_contact_id ?? "",
        }}
      />
      <GHLSyncActivity />
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual verification**

Run `npm run dev`, open Settings → GHL, fill in a couple of dummy `https://` URLs and an owner contact id, click "Save Webhook URLs", reload the page, confirm the values persisted (non-`https://` input should be silently dropped per `safeHttpUrl`).

- [ ] **Step 6: Commit**

```bash
git add src/app/\(dashboard\)/settings/actions.ts src/app/\(dashboard\)/settings/ghl/notification-webhooks-form.tsx src/app/\(dashboard\)/settings/ghl/page.tsx
git commit -m "feat: add notification webhook config UI"
```

---

### Task 10: Test webhook route + Test buttons

**Files:**
- Create: `src/app/api/ghl/test-webhook/route.ts`
- Modify: `src/app/(dashboard)/settings/ghl/notification-webhooks-form.tsx`

**Interfaces:**
- Consumes: `GHLNotificationType` from `@/lib/ghl/notifications`, `getSessionContext` from `@/lib/auth/session`.

- [ ] **Step 1: Create the test route**

```ts
import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import type { GHLNotificationType } from "@/lib/ghl/notifications";

const TEST_PAYLOADS: Record<GHLNotificationType, Record<string, unknown>> = {
  round_sent: {
    round_number: 1,
    items_disputed: 5,
    response_deadline: "2026-08-15",
    portal_link: "https://app.clientdeckpro.com/portal?token=test",
  },
  deletion_win: {
    deletions_this_round: 2,
    total_deletions: 4,
    deleted_items_list: "Capital One Collections, Medical Bill",
    score_eq: 620,
    score_exp: 615,
    score_tu: 618,
    portal_link: "https://app.clientdeckpro.com/portal?token=test",
  },
  round_results_in: {
    round_number: 1,
    total_deletions: 2,
    total_verified: 1,
    total_no_response: 0,
    total_items_disputed: 3,
    has_wins: true,
    portal_link: "https://app.clientdeckpro.com/portal?token=test",
  },
  goal_achieved: {
    total_deletions: 6,
    score_improvement: 85,
    final_score_eq: 700,
    final_score_exp: 695,
    final_score_tu: 698,
    months_in_program: 8,
    portal_link: "https://app.clientdeckpro.com/portal?token=test",
    review_link: "https://g.page/r/test/review",
  },
  payment_failed: {
    monthly_fee: 99,
    portal_link: "https://app.clientdeckpro.com/portal?token=test",
    agency_phone: "(555) 123-4567",
  },
  portal_link: {
    portal_link: "https://app.clientdeckpro.com/portal?token=test",
    agency_name: "Test Agency",
  },
  staff_new_client: {
    client_name: "Test Client",
    client_email: "test@example.com",
    client_phone: "(555) 987-6543",
    dashboard_link: "https://app.clientdeckpro.com/clients/test",
  },
  staff_round_overdue: {
    client_name: "Test Client",
    round_number: 2,
    days_overdue: 5,
    dashboard_link: "https://app.clientdeckpro.com/clients/test",
  },
  staff_next_round_ready: {
    client_name: "Test Client",
    round_number: 3,
    dashboard_link: "https://app.clientdeckpro.com/clients/test",
  },
};

export async function POST(req: Request) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ success: false, error: "Not authenticated." }, { status: 401 });

  const { webhookUrl, notificationType } = (await req.json()) as {
    webhookUrl?: string;
    notificationType?: GHLNotificationType;
  };

  if (!webhookUrl || !notificationType || !(notificationType in TEST_PAYLOADS)) {
    return NextResponse.json({ success: false, error: "Missing or invalid webhookUrl/notificationType." });
  }

  const payload = {
    contact_id: "test",
    first_name: "Test",
    last_name: "Client",
    ...TEST_PAYLOADS[notificationType],
    triggered_at: new Date().toISOString(),
    source: "clientdeck_pro",
  };

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return NextResponse.json({ success: res.ok, status: res.status });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
}
```

- [ ] **Step 2: Add Test buttons to the form**

In `notification-webhooks-form.tsx`, add state + a handler, then render a Test button next to each URL input. No new imports are needed (`useState` is already imported from Task 9).

Add inside the component, after the `handleSave` function:

```tsx
  const [testing, setTesting] = useState<GHLNotificationType | null>(null);

  async function handleTest(key: GHLNotificationType) {
    const url = triggers[key];
    if (!url) {
      toast("Enter a webhook URL first.", "error");
      return;
    }
    setTesting(key);
    try {
      const res = await fetch("/api/ghl/test-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl: url, notificationType: key }),
      });
      const data = await res.json();
      if (data.success) toast("GHL received the test payload.", "success");
      else toast(data.error ?? "GHL did not respond successfully.", "error");
    } catch {
      toast("Could not reach the webhook URL.", "error");
    } finally {
      setTesting(null);
    }
  }
```

Then replace each `<Field key={key} label={label} htmlFor={key}>...</Field>` block (both `CLIENT_TYPES.map` and `STAFF_TYPES.map`) — currently:

```tsx
              <Field key={key} label={label} htmlFor={key}>
                <Input
                  id={key}
                  value={triggers[key] ?? ""}
                  onChange={(e) => setTrigger(key, e.target.value)}
                  placeholder="https://hooks.gohighlevel.com/hooks/..."
                  className="font-mono text-xs"
                />
              </Field>
```

with:

```tsx
              <Field key={key} label={label} htmlFor={key}>
                <div className="flex gap-2">
                  <Input
                    id={key}
                    value={triggers[key] ?? ""}
                    onChange={(e) => setTrigger(key, e.target.value)}
                    placeholder="https://hooks.gohighlevel.com/hooks/..."
                    className="font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="shrink-0"
                    loading={testing === key}
                    onClick={() => handleTest(key)}
                  >
                    Test
                  </Button>
                </div>
              </Field>
```

(This block appears twice — once per `.map()` — apply the same replacement both times.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Run `npm run dev`, open Settings → GHL, paste any real `https://` URL (e.g. `https://httpbin.org/post` or a real GHL trigger URL if available) into one field, click "Test", confirm a success/error toast appears matching the response. Also verify directly: `curl -X POST http://localhost:3000/api/ghl/test-webhook -H "Content-Type: application/json" -d '{"webhookUrl":"https://httpbin.org/post","notificationType":"round_sent"}'` returns `{"success":true,"status":200}` (requires being logged in via browser session cookie for the UI path; the raw curl will 401 without a session cookie — expected, since the route requires staff auth).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/ghl/test-webhook/route.ts src/app/\(dashboard\)/settings/ghl/notification-webhooks-form.tsx
git commit -m "feat: add GHL webhook test route and Test buttons"
```

---

### Task 11: Resend fallback banner + phase close-out

**Files:**
- Modify: `src/app/(dashboard)/settings/ghl/page.tsx`
- Create: `src/app/(dashboard)/settings/ghl/resend-fallback-banner.tsx`

**Interfaces:**
- Consumes: `GHLNotificationType`, the 9 wired types list (already defined in `notification-webhooks-form.tsx` as `CLIENT_TYPES`/`STAFF_TYPES` — duplicated here as a flat list since this is a Server Component and can't import client-only state).

- [ ] **Step 1: Create the banner component**

```tsx
import { AlertTriangle } from "lucide-react";

const WIRED_TYPES = [
  "round_sent",
  "deletion_win",
  "round_results_in",
  "goal_achieved",
  "payment_failed",
  "portal_link",
  "staff_new_client",
  "staff_round_overdue",
  "staff_next_round_ready",
] as const;

export function ResendFallbackBanner({
  triggers,
}: {
  triggers: Partial<Record<string, string>>;
}) {
  const hasResend = Boolean(process.env.RESEND_API_KEY);
  if (!hasResend) return null;

  const unconfiguredCount = WIRED_TYPES.filter((t) => !triggers[t]).length;
  if (unconfiguredCount === 0) return null;

  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        Using Email Fallback — {unconfiguredCount} of {WIRED_TYPES.length} notifications are using
        Resend email because GHL webhook URLs aren&apos;t fully configured. Set up your GHL workflows
        below to use your own branded SMS and email instead.
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Render it above the notification webhooks form**

In `src/app/(dashboard)/settings/ghl/page.tsx`, add the import and render it right before `<NotificationWebhooksForm .../>`:

```tsx
import { ResendFallbackBanner } from "./resend-fallback-banner";
```

```tsx
      <OnboardingWebhookCard webhookUrl={onboardingWebhookUrl} />
      <ResendFallbackBanner triggers={agency.settings?.ghl_webhook_triggers ?? {}} />
      <NotificationWebhooksForm
        initial={{
          triggers: agency.settings?.ghl_webhook_triggers ?? {},
          ownerGhlContactId: agency.settings?.owner_ghl_contact_id ?? "",
        }}
      />
      <GHLSyncActivity />
```

- [ ] **Step 3: Type-check and full build**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds with no new errors or warnings introduced by this phase.

- [ ] **Step 4: Manual verification**

With `RESEND_API_KEY` set in `.env.local` (or temporarily set for this check) and no webhook URLs configured, load Settings → GHL and confirm the amber banner renders with "9 of 9". Save one webhook URL, reload, confirm the count drops to "8 of 9". Unset `RESEND_API_KEY` (or confirm it's unset in the current `.env.local` per the Preview Mode setup already documented for this repo) and confirm the banner disappears entirely regardless of configured count.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/settings/ghl/page.tsx src/app/\(dashboard\)/settings/ghl/resend-fallback-banner.tsx
git commit -m "feat: add Resend fallback banner to GHL settings"
```

---

## Phase A Self-Review Notes (for the executor)

- Every event from the design doc's A2 list (8 call sites + the cron-only 9th) is covered: Tasks 2, 3, 4, 5, 6, 7, 8.
- The activity-log `clientId` bug from the original user-provided spec is fixed by threading `NotificationLogIds` explicitly through `sendGHLNotification` (Task 1) rather than relying on an out-of-scope variable.
- The non-existent `agency.settings.stripe_portal_link` field from the original spec was replaced with the real client portal billing link (`/portal?token=...`, which already has a "Manage Payment Method" button wired to `/api/portal/stripe-portal`).
- The Stripe webhook gap (client-level `invoice.payment_failed` was previously a no-op) is fixed in Task 8 with a real, necessary code addition — not present in the original spec's assumption that `stripe_customer_id` only ever pointed at an agency.
- Phase B (pipeline sync, monthly cron, setup guide page, timeline badge, admin widget) is a separate plan to be written after this phase is reviewed and merged, per the design doc's build order.
