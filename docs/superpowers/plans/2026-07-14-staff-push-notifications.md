# Staff Push Notifications + In-App Bell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give staff a native RTP notification channel (Web Push + an in-app bell) for the 4 existing staff-facing notification types, additive to the existing GHL-tag/Resend chain, routed by the recipient-resolution logic that already exists in `resolveStaffRecipients()`.

**Architecture:** Extend the existing client-portal `push_subscriptions` table with a nullable `team_member_id` owner column (mutually exclusive with `client_id` via a CHECK constraint) so `src/lib/push/send.ts`'s VAPID/webpush/endpoint-allowlist plumbing serves both audiences. Add a `staff_notifications` table for the in-app feed. Hook both into `notifyStaffSubscribers()` in `src/lib/ghl/notifications.ts` right after it resolves recipients — this is purely additive, the GHL-tag/Resend code path is untouched. A polling bell component (matching this codebase's existing no-Realtime convention) renders the feed in the dashboard header.

**Tech Stack:** Next.js 16 App Router / Route Handlers, Supabase (Postgres + RLS), `web-push` (already a dependency), Supabase Auth (`getSessionContext()`), Tailwind (`.app-content` light/dark tokens via `--overlay-*` CSS vars).

## Global Constraints

- This repo has **no unit test runner** (`package.json` has no jest/vitest; Playwright is a dependency but there are no test files anywhere in the tree) — the project's actual verification convention (see `.claude/skills/verify/SKILL.md` and `CLAUDE.md`'s Common Commands) is `npx tsc --noEmit`, `npm run build`, `npm run lint`, and driving the real running app. **Do not introduce a test framework.** Every task's "verify" step below is a concrete command against the type checker, build, or running app — treat these exactly like a red/green test cycle: run it, confirm the stated expected output, only then move on.
- Migrations in this repo are committed as numbered `.sql` files and applied by hand into the Supabase SQL editor (`CLAUDE.md`: "run in order in Supabase SQL editor"; there is no local Supabase CLI stack — no `supabase/config.toml`). Applying a migration changes live schema on shared infrastructure, so **Task 3 requires explicit user confirmation of the target Supabase project before running `apply_migration`** — do not skip that confirmation.
- Reuse existing plumbing, do not fork it: `ensureVapidConfigured()` / `isAllowedPushEndpoint()` / the webpush delivery+404/410-cleanup logic in `src/lib/push/send.ts` must be shared between the client and staff send paths, not duplicated.
- `resolveStaffRecipients()` and `subscribed_notification_types` remain the **only** routing/preference logic. Do not add a second "notify me of everything" toggle or a separate per-channel preference.
- Never touch `sendGHLNotification`, `buildNotificationFields`, `sendResendFallback`, or the tag/field-sync logic in `src/lib/ghl/notifications.ts` — this feature is additive only.
- Follow existing code conventions exactly: Route Handlers use `getSessionContext()` for staff auth (not the portal's `getPortalSession()`), `createAdminClient()` only for service-role/system writes, `createServerSupabaseClient()` for RLS-scoped staff reads, dynamic route params are `{ params }: { params: Promise<{ id: string }> }` (Next 16 async params), Lucide icons only, `cn()` from `src/lib/utils/helpers.ts` for class merging.

---

## File Structure

- **Create** `supabase/migrations/032_staff_push_subscriptions.sql` — adds `team_member_id` to `push_subscriptions`, drops the old `client_id NOT NULL`, adds the exactly-one-owner CHECK.
- **Create** `supabase/migrations/033_staff_notifications.sql` — new `staff_notifications` table + RLS policies scoped to the owning team member.
- **Modify** `src/types/index.ts` — add the `StaffNotification` row type.
- **Modify** `src/lib/push/send.ts` — extract shared delivery logic into `deliverToSubscriptions()`, add `sendPushToStaff()`.
- **Modify** `src/app/api/portal/push/subscribe/route.ts` — explicitly null the sibling owner column on upsert (closes the endpoint-collision edge case for real, not just via a DB-level CHECK failure).
- **Create** `src/app/api/push/subscribe/route.ts` — staff equivalent of the portal subscribe route, authenticated via `getSessionContext()`.
- **Modify** `src/lib/ghl/notifications.ts` — add `buildStaffChannelContent()` + `notifyStaffChannels()`, call it from `notifyStaffSubscribers()`, add `client_id` to the 4 staff notifier functions' data payloads.
- **Create** `src/app/api/notifications/route.ts` — `GET`, returns the recent feed + unread count for the signed-in staff member.
- **Create** `src/app/api/notifications/[id]/read/route.ts` — `POST`, marks one notification read.
- **Create** `src/components/dashboard/notification-bell.tsx` — bell icon, unread badge, dropdown feed, inline "enable push" prompt.
- **Modify** `src/components/dashboard/dashboard-shell.tsx` — mount `<NotificationBell />` in the header.

---

### Task 1: Migration 032 — `team_member_id` on `push_subscriptions`

**Files:**
- Create: `supabase/migrations/032_staff_push_subscriptions.sql`

**Interfaces:**
- Produces: a `push_subscriptions` table where every row has exactly one of `client_id` / `team_member_id` set, enforced by constraint `push_subscriptions_exactly_one_owner`. Later tasks (`sendPushToStaff`, the staff subscribe route) depend on the `team_member_id` column and its index existing.

- [ ] **Step 1: Write the migration file**

```sql
-- ============================================
-- 032: staff push subscriptions
--
-- Extends push_subscriptions (migration 022, client-portal only) so the same
-- VAPID/web-push plumbing can also push to staff in the dashboard.
-- client_id is no longer NOT NULL; a CHECK enforces every row has exactly
-- one owner, so the endpoint upsert (onConflict: "endpoint") can never
-- silently reassign a subscription from one owner type to the other if the
-- same browser endpoint is ever reused across a client-portal session and a
-- staff dashboard session on the same device.
-- ============================================

ALTER TABLE push_subscriptions ALTER COLUMN client_id DROP NOT NULL;

ALTER TABLE push_subscriptions
  ADD COLUMN team_member_id UUID REFERENCES team_members(id) ON DELETE CASCADE;

ALTER TABLE push_subscriptions
  ADD CONSTRAINT push_subscriptions_exactly_one_owner
  CHECK (
    (client_id IS NOT NULL AND team_member_id IS NULL) OR
    (client_id IS NULL AND team_member_id IS NOT NULL)
  );

CREATE INDEX idx_push_subscriptions_team_member ON push_subscriptions(team_member_id);
```

- [ ] **Step 2: Verify the file is syntactically self-consistent**

Read the file back and confirm: (a) `client_id` uniqueness/FK/index from migration 022 are untouched (only `NOT NULL` is dropped), (b) the CHECK references only `client_id`/`team_member_id`, (c) the new index name doesn't collide with `idx_push_subscriptions_client` from migration 022. This migration is not applied yet — that happens in Task 3 after Task 2's migration is also written.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/032_staff_push_subscriptions.sql
git commit -m "feat: add nullable team_member_id owner to push_subscriptions"
```

---

### Task 2: Migration 033 — `staff_notifications` table + `StaffNotification` type

**Files:**
- Create: `supabase/migrations/033_staff_notifications.sql`
- Modify: `src/types/index.ts` (insert after the `ActivityLog` interface, which ends at line 322)

**Interfaces:**
- Produces: table `staff_notifications(id, team_member_id, agency_id, type, message, link, read_at, created_at)`, RLS-readable/mark-readable only by the owning `team_member_id`'s Supabase Auth session, insertable only via the service-role client. Produces TypeScript type `StaffNotification` for later tasks' API routes and the bell component.

- [ ] **Step 1: Write the migration file**

```sql
-- ============================================
-- 033: staff_notifications
--
-- In-app notification feed for staff, delivered alongside (never instead
-- of) the existing GHL-tag/Resend channel in src/lib/ghl/notifications.ts.
-- Rows are written only by the server-side notification pipeline
-- (createAdminClient(), bypasses RLS) for the 4 staff-facing types, using
-- the same recipient list resolveStaffRecipients() already computes for
-- GHL/email — no separate routing logic exists here. Reads and mark-read
-- happen through the authenticated staff session (RLS-scoped to the
-- requesting team member).
-- ============================================

CREATE TABLE staff_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_staff_notifications_recipient
  ON staff_notifications(team_member_id, created_at DESC);

ALTER TABLE staff_notifications ENABLE ROW LEVEL SECURITY;

-- No INSERT policy: rows are written only by createAdminClient() (service
-- role, bypasses RLS) from src/lib/ghl/notifications.ts. An authenticated
-- staff session can never create a notification for themselves or anyone
-- else.
CREATE POLICY "Staff see own notifications" ON staff_notifications
  FOR SELECT USING (
    team_member_id IN (
      SELECT id FROM team_members WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Staff mark own notifications read" ON staff_notifications
  FOR UPDATE USING (
    team_member_id IN (
      SELECT id FROM team_members WHERE user_id = auth.uid() AND is_active = true
    )
  );
```

- [ ] **Step 2: Add the `StaffNotification` type**

In `src/types/index.ts`, find:

```ts
export interface ActivityLog {
  id: string;
  agency_id: string;
  client_id: string | null;
  actor_type: ActorType | null;
  actor_id: string | null;
  action: string;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}
```

Insert immediately after it:

```ts
export interface StaffNotification {
  id: string;
  team_member_id: string;
  agency_id: string;
  type: string;
  message: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: no new errors (the type isn't consumed by anything yet, so this just confirms the interface itself is syntactically valid).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/033_staff_notifications.sql src/types/index.ts
git commit -m "feat: add staff_notifications table and StaffNotification type"
```

---

### Task 3: Apply both migrations to the dev Supabase project

**Files:** none (operational task — no files created or modified)

**Interfaces:**
- Consumes: `supabase/migrations/032_staff_push_subscriptions.sql`, `supabase/migrations/033_staff_notifications.sql` from Tasks 1–2.
- Produces: the live schema changes every later task's runtime behavior depends on.

- [ ] **Step 1: Identify the target project and get explicit confirmation**

Read `NEXT_PUBLIC_SUPABASE_URL` from `.env.local`. Call the Supabase MCP tool `list_projects` (`ToolSearch` for `select:mcp__claude_ai_Supabase__list_projects` first if not already loaded) and match its `id`/URL against `.env.local`. **Stop and show the user which project you matched before proceeding** — this writes real schema changes to shared infrastructure and this repo's own `CLAUDE.md` documents migrations as a manual, reviewed step, not an automated one.

- [ ] **Step 2: Apply migration 032**

Call `mcp__claude_ai_Supabase__apply_migration` with the confirmed `project_id`, `name: "032_staff_push_subscriptions"`, and `query` set to the full contents of `supabase/migrations/032_staff_push_subscriptions.sql`.
Expected: success response, no error.

- [ ] **Step 3: Apply migration 033**

Same tool, `name: "033_staff_notifications"`, `query` set to the full contents of `supabase/migrations/033_staff_notifications.sql`.
Expected: success response, no error.

- [ ] **Step 4: Verify against live schema**

Call `mcp__claude_ai_Supabase__execute_sql` (read-only) with:
```sql
select column_name, is_nullable from information_schema.columns where table_name = 'push_subscriptions' and column_name in ('client_id', 'team_member_id');
```
Expected: both columns present, both `is_nullable = 'YES'`.

```sql
select table_name from information_schema.tables where table_name = 'staff_notifications';
```
Expected: one row.

---

### Task 4: `sendPushToStaff()` in `src/lib/push/send.ts`

**Files:**
- Modify: `src/lib/push/send.ts` (full rewrite — every line changes ownership of the delivery loop, easiest to replace the whole file)

**Interfaces:**
- Consumes: `push_subscriptions.team_member_id` column from Task 1/3.
- Produces: `sendPushToStaff(teamMemberId: string, payload: PushPayload): Promise<void>` — same never-throws, no-op-if-unconfigured contract as the existing `sendPushToClient`. Task 6 depends on this exact signature.

- [ ] **Step 1: Replace the file**

```ts
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAllowedPushEndpoint } from "./endpoint";
import type { SupabaseClient } from "@supabase/supabase-js";

interface WebPushSubscriptionJSON {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

let vapidConfigured = false;

function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return true;
  const { VAPID_PRIVATE_KEY, VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY } = process.env;
  if (!VAPID_PRIVATE_KEY || !VAPID_SUBJECT || !NEXT_PUBLIC_VAPID_PUBLIC_KEY) return false;
  webpush.setVapidDetails(VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  vapidConfigured = true;
  return true;
}

/**
 * Sends `payload` to every subscription row in `subs`, deleting any that
 * come back 404/410 (dead — browser uninstalled, permission revoked, etc).
 * Shared by sendPushToClient and sendPushToStaff so this logic exists once.
 */
async function deliverToSubscriptions(
  admin: SupabaseClient,
  subs: { id: string; subscription: unknown }[],
  payload: PushPayload
): Promise<void> {
  await Promise.all(
    subs.map(async (row) => {
      const sub = row.subscription as WebPushSubscriptionJSON;
      // Defense in depth: the subscribe routes reject non-push-service
      // endpoints, but rows predating that check could still name an
      // arbitrary host. Never let webpush POST to one.
      if (!isAllowedPushEndpoint(sub?.endpoint ?? "")) {
        console.error("[push] skipping subscription with disallowed endpoint", { id: row.id });
        return;
      }
      try {
        await webpush.sendNotification(sub, JSON.stringify(payload));
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("id", row.id);
        } else {
          console.error("[push] delivery failed:", err);
        }
      }
    })
  );
}

/**
 * Sends a Web Push notification to every subscription on file for a client
 * (one per browser/device they enabled push on). Never throws — matches
 * sendGHLNotification's fire-and-forget contract so callers can await or
 * fire-and-forget without try/catch. No-ops silently if VAPID env vars
 * aren't configured.
 */
export async function sendPushToClient(clientId: string, payload: PushPayload): Promise<void> {
  if (!ensureVapidConfigured()) return;

  const admin = createAdminClient();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, subscription")
    .eq("client_id", clientId);

  if (!subs || subs.length === 0) return;
  await deliverToSubscriptions(admin, subs, payload);
}

/**
 * Same contract as sendPushToClient, for a staff member (team_members.id)
 * instead of a client. Both share push_subscriptions (migration 032 added
 * the nullable team_member_id column) and the delivery/cleanup logic above.
 */
export async function sendPushToStaff(teamMemberId: string, payload: PushPayload): Promise<void> {
  if (!ensureVapidConfigured()) return;

  const admin = createAdminClient();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, subscription")
    .eq("team_member_id", teamMemberId);

  if (!subs || subs.length === 0) return;
  await deliverToSubscriptions(admin, subs, payload);
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors. If `SupabaseClient` import errors, confirm it's exported from `@supabase/supabase-js` (it is — `createAdminClient()`'s return type in `src/lib/supabase/admin.ts` comes from the same `createClient()` call).

- [ ] **Step 3: Commit**

```bash
git add src/lib/push/send.ts
git commit -m "feat: add sendPushToStaff, sharing delivery logic with sendPushToClient"
```

---

### Task 5: Staff push-subscribe route + close the portal route's owner-column gap

**Files:**
- Create: `src/app/api/push/subscribe/route.ts`
- Modify: `src/app/api/portal/push/subscribe/route.ts:41-48` (the `POST` upsert payload)

**Interfaces:**
- Consumes: `getSessionContext()` (`src/lib/auth/session.ts`) for staff identity; `isAllowedPushEndpoint()` (`src/lib/push/endpoint.ts`); `rateLimit()`/`getClientIp()` (`src/lib/utils/rate-limit.ts`).
- Produces: `POST /api/push/subscribe` and `DELETE /api/push/subscribe`, mirroring the portal routes but owned by `team_member_id`.

- [ ] **Step 1: Close the owner-collision gap in the existing portal route**

In `src/app/api/portal/push/subscribe/route.ts`, find:

```ts
  const { client, agency } = session;
  const admin = createAdminClient();
  const { error } = await admin.from("push_subscriptions").upsert(
    {
      client_id: client.id,
      agency_id: agency.id,
      subscription,
    },
    { onConflict: "endpoint" }
  );
```

Replace with:

```ts
  const { client, agency } = session;
  const admin = createAdminClient();
  const { error } = await admin.from("push_subscriptions").upsert(
    {
      client_id: client.id,
      team_member_id: null,
      agency_id: agency.id,
      subscription,
    },
    { onConflict: "endpoint" }
  );
```

This makes the upsert actively clear the sibling owner column on conflict — if the same browser endpoint was previously a staff subscription, resubscribing as a portal client now correctly reassigns it instead of tripping the `push_subscriptions_exactly_one_owner` CHECK.

- [ ] **Step 2: Create the staff subscribe route**

```ts
import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/utils/rate-limit";
import { isAllowedPushEndpoint } from "@/lib/push/endpoint";

export async function POST(req: Request) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }

  if (!rateLimit(`staff-push-sub:${session.teamMember.id}`, 10, 60_000)) {
    return NextResponse.json({ ok: false, error: "Too many requests. Try again shortly." }, { status: 429 });
  }

  let body: { subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const subscription = body.subscription;
  if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    return NextResponse.json({ ok: false, error: "Invalid push subscription." }, { status: 400 });
  }

  // web-push will POST to whatever host the endpoint names, so an
  // unvalidated endpoint here is an SSRF primitive. Only real push services.
  if (!isAllowedPushEndpoint(subscription.endpoint)) {
    return NextResponse.json(
      { ok: false, error: "Unrecognized push service endpoint." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { error } = await admin.from("push_subscriptions").upsert(
    {
      team_member_id: session.teamMember.id,
      client_id: null,
      agency_id: session.agency.id,
      subscription,
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    console.error("[push/subscribe] upsert failed:", error);
    return NextResponse.json({ ok: false, error: "Could not save subscription." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }

  let body: { endpoint?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  if (!body.endpoint) {
    return NextResponse.json({ ok: false, error: "Missing endpoint." }, { status: 400 });
  }

  const admin = createAdminClient();
  await admin
    .from("push_subscriptions")
    .delete()
    .eq("team_member_id", session.teamMember.id)
    .eq("endpoint", body.endpoint);

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/push/subscribe/route.ts src/app/api/portal/push/subscribe/route.ts
git commit -m "feat: add staff push-subscribe route, null sibling owner column on upsert"
```

---

### Task 6: Wire in-app + push delivery into `notifyStaffSubscribers()`

**Files:**
- Modify: `src/lib/ghl/notifications.ts`

**Interfaces:**
- Consumes: `sendPushToStaff()` (Task 4), `staff_notifications` table (Task 2/3), the existing `resolveStaffRecipients()`, `StaffFacingType`, `StaffMember`, `GHLNotificationPayload["data"]`.
- Produces: every call to `notifyStaffNewClient` / `notifyStaffRoundOverdue` / `notifyStaffNextRoundReady` / `notifyStaffMonthlyProgress` now also writes `staff_notifications` rows and fires Web Push for the same recipients `resolveStaffRecipients()` already computed — no new exported functions other callers need to know about.

- [ ] **Step 1: Import `sendPushToStaff`**

Find:

```ts
import { sendPushToClient } from "@/lib/push/send";
```

Replace with:

```ts
import { sendPushToClient, sendPushToStaff } from "@/lib/push/send";
```

- [ ] **Step 2: Add `client_id` to the 4 staff notifier functions' data payloads**

In `notifyStaffNewClient`, find:

```ts
    {
      client_name: `${client.first_name} ${client.last_name}`,
      client_email: client.email ?? "",
      client_phone: client.phone ?? "",
      dashboard_link: dashboardLinkFor(client.id),
    },
```

Replace with:

```ts
    {
      client_id: client.id,
      client_name: `${client.first_name} ${client.last_name}`,
      client_email: client.email ?? "",
      client_phone: client.phone ?? "",
      dashboard_link: dashboardLinkFor(client.id),
    },
```

In `notifyStaffRoundOverdue`, find:

```ts
    {
      client_name: `${client.first_name} ${client.last_name}`,
      round_number: roundNumber,
      days_overdue: daysOverdue,
      dashboard_link: dashboardLinkFor(client.id),
    },
```

Replace with:

```ts
    {
      client_id: client.id,
      client_name: `${client.first_name} ${client.last_name}`,
      round_number: roundNumber,
      days_overdue: daysOverdue,
      dashboard_link: dashboardLinkFor(client.id),
    },
```

In `notifyStaffNextRoundReady`, find:

```ts
    {
      client_name: `${client.first_name} ${client.last_name}`,
      round_number: roundNumber,
      dashboard_link: dashboardLinkFor(client.id),
    },
```

Replace with:

```ts
    {
      client_id: client.id,
      client_name: `${client.first_name} ${client.last_name}`,
      round_number: roundNumber,
      dashboard_link: dashboardLinkFor(client.id),
    },
```

In `notifyStaffMonthlyProgress`, find:

```ts
    {
      client_name: `${client.first_name} ${client.last_name}`,
      score_eq: summary.scoreEq ?? 0,
      score_exp: summary.scoreExp ?? 0,
      score_tu: summary.scoreTu ?? 0,
      total_deletions: summary.totalDeletions,
      total_items: summary.totalItems,
      current_round: summary.currentRound,
      dashboard_link: dashboardLinkFor(client.id),
    },
```

Replace with:

```ts
    {
      client_id: client.id,
      client_name: `${client.first_name} ${client.last_name}`,
      score_eq: summary.scoreEq ?? 0,
      score_exp: summary.scoreExp ?? 0,
      score_tu: summary.scoreTu ?? 0,
      total_deletions: summary.totalDeletions,
      total_items: summary.totalItems,
      current_round: summary.currentRound,
      dashboard_link: dashboardLinkFor(client.id),
    },
```

- [ ] **Step 3: Add `buildStaffChannelContent()` and `notifyStaffChannels()`**

Find the `firePush` function:

```ts
function firePush(clientId: string, title: string, body: string, url: string) {
  after(() => sendPushToClient(clientId, { title, body, url }).catch((err) => {
    console.error("[push] firePush failed:", err);
  }));
}
```

Insert immediately after it:

```ts
/**
 * Builds the in-app/push copy for a staff-facing notification from the same
 * `data` payload buildNotificationFields/the Resend templates already use.
 * Kept separate because in-app copy is shorter and always needs a relative
 * dashboard path — the push service worker matches window URLs by substring
 * (see public/sw.js), so an absolute NEXT_PUBLIC_APP_URL link would never
 * match an already-open dashboard tab.
 */
function buildStaffChannelContent(
  type: StaffFacingType,
  data: GHLNotificationPayload["data"]
): { title: string; body: string; link: string } {
  const link = `/clients/${data.client_id}`;
  switch (type) {
    case "staff_new_client":
      return {
        title: "New client onboarded",
        body: `${data.client_name} just onboarded.`,
        link,
      };
    case "staff_round_overdue":
      return {
        title: "Round overdue",
        body: `Round ${data.round_number} for ${data.client_name} is ${data.days_overdue} day(s) overdue.`,
        link,
      };
    case "staff_next_round_ready":
      return {
        title: "Next round ready",
        body: `Round ${data.round_number} is ready to prepare for ${data.client_name}.`,
        link,
      };
    case "staff_monthly_progress":
      return {
        title: "Monthly progress",
        body: `Monthly progress update for ${data.client_name}.`,
        link,
      };
  }
}

/**
 * Delivers the RTP-native channel (in-app bell + Web Push) for a staff
 * notification to every already-resolved recipient — the SAME recipient
 * list and subscribed_notification_types filtering resolveStaffRecipients()
 * computed for the GHL-tag/Resend channel. Additive only: never blocks, and
 * never replaces, the existing sendGHLNotification/Resend flow below it.
 */
function notifyStaffChannels(
  agencyId: string,
  type: StaffFacingType,
  data: GHLNotificationPayload["data"],
  recipients: StaffMember[]
) {
  if (recipients.length === 0) return;

  const { title, body, link } = buildStaffChannelContent(type, data);
  const message = `${title}: ${body}`;

  after(async () => {
    try {
      const admin = createAdminClient();
      await admin.from("staff_notifications").insert(
        recipients.map((m) => ({
          team_member_id: m.id,
          agency_id: agencyId,
          type,
          message,
          link,
        }))
      );
    } catch (err) {
      console.error(`[Staff Notification] ${type} in-app insert failed:`, err);
    }

    await Promise.all(
      recipients.map((m) =>
        sendPushToStaff(m.id, { title, body, url: link }).catch((err) => {
          console.error(`[Staff Notification] ${type} push failed for ${m.id}:`, err);
        })
      )
    );
  });
}
```

- [ ] **Step 4: Call it from `notifyStaffSubscribers()`**

Find:

```ts
  const recipients = resolveStaffRecipients(type, members ?? [], client);

  if (CLIENT_TAGGED_STAFF_TYPES.has(type)) {
```

Replace with:

```ts
  const recipients = resolveStaffRecipients(type, members ?? [], client);
  notifyStaffChannels(agency.id, type, data, recipients);

  if (CLIENT_TAGGED_STAFF_TYPES.has(type)) {
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit`
Expected: no errors. If `buildStaffChannelContent`'s switch reports "not all code paths return a value," confirm all 4 `StaffFacingType` members are handled verbatim as above — TypeScript treats an exhaustive switch over a 4-member string-literal union as covering every path with no `default` needed.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ghl/notifications.ts
git commit -m "feat: deliver in-app + push notifications to resolved staff recipients"
```

---

### Task 7: Notifications list + mark-read API routes

**Files:**
- Create: `src/app/api/notifications/route.ts`
- Create: `src/app/api/notifications/[id]/read/route.ts`

**Interfaces:**
- Consumes: `getSessionContext()`, `createServerSupabaseClient()`, `staff_notifications` RLS policies from Task 2/3.
- Produces: `GET /api/notifications` → `{ ok, notifications: StaffNotification[], unreadCount: number }`; `POST /api/notifications/:id/read` → `{ ok }`. Task 8's bell component depends on this exact response shape.

- [ ] **Step 1: Create the list route**

```ts
import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const LIST_LIMIT = 20;

export async function GET() {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }

  const supabase = await createServerSupabaseClient();

  const [{ data: notifications }, { count: unreadCount }] = await Promise.all([
    supabase
      .from("staff_notifications")
      .select("id, type, message, link, read_at, created_at")
      .eq("team_member_id", session.teamMember.id)
      .order("created_at", { ascending: false })
      .limit(LIST_LIMIT),
    supabase
      .from("staff_notifications")
      .select("id", { count: "exact", head: true })
      .eq("team_member_id", session.teamMember.id)
      .is("read_at", null),
  ]);

  return NextResponse.json({
    ok: true,
    notifications: notifications ?? [],
    unreadCount: unreadCount ?? 0,
  });
}
```

- [ ] **Step 2: Create the mark-read route**

```ts
import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }

  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase
    .from("staff_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("team_member_id", session.teamMember.id);

  if (error) {
    console.error("[notifications/read] update failed:", error);
    return NextResponse.json({ ok: false, error: "Could not mark as read." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/notifications/route.ts "src/app/api/notifications/[id]/read/route.ts"
git commit -m "feat: add staff notification list and mark-read API routes"
```

---

### Task 8: Notification bell component + mount in the dashboard header

**Files:**
- Create: `src/components/dashboard/notification-bell.tsx`
- Modify: `src/components/dashboard/dashboard-shell.tsx`

**Interfaces:**
- Consumes: `GET /api/notifications`, `POST /api/notifications/:id/read`, `POST /api/push/subscribe` (Tasks 4, 5, 7); `--overlay-surface` / `--overlay-border` / `--overlay-divide` / `--overlay-text` / `--overlay-text-muted` CSS variables (`src/app/globals.css:447-459`, already theme-aware); `cn()` from `src/lib/utils/helpers.ts`.
- Produces: `<NotificationBell />`, a self-contained client component with no props.

- [ ] **Step 1: Create the bell component**

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils/helpers";
import type { StaffNotification } from "@/types";

type StaffNotificationItem = Pick<
  StaffNotification,
  "id" | "type" | "message" | "link" | "read_at" | "created_at"
>;

const POLL_MS = 30_000;

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

async function subscribeToPush(): Promise<boolean> {
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) return false;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return false;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  await navigator.serviceWorker.register("/sw.js");
  const registration = await navigator.serviceWorker.ready;
  const sub = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey),
  });

  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: sub.toJSON() }),
  });
  return true;
}

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<StaffNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pushEnabled, setPushEnabled] = useState<boolean | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // Silent — next poll retries.
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, POLL_MS);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPushEnabled(true); // Unsupported browser — hide the prompt instead of nagging.
      return;
    }
    setPushEnabled(Notification.permission === "granted");
  }, []);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function handleEnablePush() {
    const ok = await subscribeToPush().catch(() => false);
    setPushEnabled(ok || (typeof Notification !== "undefined" && Notification.permission === "granted"));
  }

  async function handleItemClick(item: StaffNotificationItem) {
    setOpen(false);
    if (item.read_at) return;
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, read_at: new Date().toISOString() } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    await fetch(`/api/notifications/${item.id}/read`, { method: "POST" }).catch(() => {});
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-slate-200"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-30 mt-2 w-80 rounded-lg border shadow-[0_16px_40px_rgba(0,0,0,0.4)]"
          style={{ background: "var(--overlay-surface)", borderColor: "var(--overlay-border)" }}
        >
          <div
            className="flex items-center justify-between border-b px-4 py-3"
            style={{ borderColor: "var(--overlay-divide)" }}
          >
            <p className="text-sm font-semibold" style={{ color: "var(--overlay-text)" }}>
              Notifications
            </p>
          </div>

          {pushEnabled === false && (
            <div className="border-b px-4 py-3" style={{ borderColor: "var(--overlay-divide)" }}>
              <p className="text-xs" style={{ color: "var(--overlay-text-muted)" }}>
                Turn on push notifications to get alerted even when this tab isn&apos;t open.
              </p>
              <button
                onClick={handleEnablePush}
                className="mt-2 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500"
              >
                Enable push notifications
              </button>
            </div>
          )}

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm" style={{ color: "var(--overlay-text-muted)" }}>
                No notifications yet.
              </p>
            ) : (
              notifications.map((item) => (
                <Link
                  key={item.id}
                  href={item.link ?? "/dashboard"}
                  onClick={() => handleItemClick(item)}
                  className={cn(
                    "block border-b px-4 py-3 text-sm transition-colors hover:bg-white/5",
                    !item.read_at && "bg-violet-500/[0.06]"
                  )}
                  style={{ borderColor: "var(--overlay-divide)" }}
                >
                  <p style={{ color: "var(--overlay-text)" }}>{item.message}</p>
                  <p className="mt-1 text-xs" style={{ color: "var(--overlay-text-muted)" }}>
                    {timeAgo(item.created_at)}
                  </p>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Mount it in the dashboard header**

In `src/components/dashboard/dashboard-shell.tsx`, find:

```ts
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
```

Replace with:

```ts
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { NotificationBell } from "@/components/dashboard/notification-bell";
```

Find:

```tsx
          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
```

Replace with:

```tsx
          <div className="ml-auto flex items-center gap-3">
            <NotificationBell />
            <ThemeToggle />
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new errors (React 19 rules — this component has no `Date.now()`/`setState` calls in the render body, only inside effects/handlers, so it should be clean).

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/notification-bell.tsx src/components/dashboard/dashboard-shell.tsx
git commit -m "feat: add notification bell to dashboard header"
```

---

### Task 9: Build + end-to-end verification

**Files:** none (verification only)

**Interfaces:**
- Consumes: everything from Tasks 1–8, plus `GET /api/cron/check-deadlines` (`src/app/api/cron/check-deadlines/route.ts`, existing/unmodified) as the trigger for `notifyStaffRoundOverdue`.

- [ ] **Step 1: Full build**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds, no new route/type errors. Confirm `/api/push/subscribe`, `/api/notifications`, and `/api/notifications/[id]/read` appear in the route summary.

- [ ] **Step 2: Launch against the real dev database**

Per `.claude/skills/verify/SKILL.md`:
```bash
npx next start -p 3001
```
Wait for `GET /login` to return 200.

- [ ] **Step 3: Seed and pick 3 team members**

Run: `npm run seed` (idempotent, demo agency only).

Query team members for the demo agency via Supabase REST (service-role key from `.env.local`):
```bash
curl -s "{SUPABASE_URL}/rest/v1/team_members?select=id,name,role,subscribed_notification_types&agency_id=eq.{DEMO_AGENCY_ID}" \
  -H "apikey: {SERVICE_ROLE_KEY}" -H "Authorization: Bearer {SERVICE_ROLE_KEY}"
```
From the result, pick:
- **Member A** — will be the client's `assigned_to`, with `subscribed_notification_types` NOT containing `staff_round_overdue` (tests that inclusion comes purely from the assignment, not the global subscription).
- **Member B** — NOT assigned to the client, but `subscribed_notification_types` DOES contain `staff_round_overdue` (tests the global-subscription path).
- **Member C** — neither assigned nor subscribed to `staff_round_overdue` (must receive nothing).

If none currently match, set B's prefs directly:
```bash
curl -s -X PATCH "{SUPABASE_URL}/rest/v1/team_members?id=eq.{MEMBER_B_ID}" \
  -H "apikey: {SERVICE_ROLE_KEY}" -H "Authorization: Bearer {SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d '{"subscribed_notification_types": ["staff_round_overdue"]}'
```

- [ ] **Step 4: Assign a client to Member A and put one of their rounds overdue**

Pick a demo client, assign to Member A, and set a `dispute_rounds` row to `awaiting_response` with a `response_deadline` a few days in the past:
```bash
curl -s -X PATCH "{SUPABASE_URL}/rest/v1/clients?id=eq.{CLIENT_ID}" \
  -H "apikey: {SERVICE_ROLE_KEY}" -H "Authorization: Bearer {SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"assigned_to\": \"{MEMBER_A_ID}\"}"

curl -s -X PATCH "{SUPABASE_URL}/rest/v1/dispute_rounds?client_id=eq.{CLIENT_ID}&round_number=eq.1" \
  -H "apikey: {SERVICE_ROLE_KEY}" -H "Authorization: Bearer {SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"status": "awaiting_response", "response_deadline": "2026-06-01"}'
```

- [ ] **Step 5: Trigger the overdue cron**

```bash
curl -s "http://localhost:3001/api/cron/check-deadlines?secret={CRON_SECRET}"
```
Expected: JSON with `flagged >= 1` and `clientsAffected` including the test client. (`CRON_SECRET` from `.env.local`.)

- [ ] **Step 6: Confirm only Member A and Member B got a row, Member C got none**

```bash
curl -s "{SUPABASE_URL}/rest/v1/staff_notifications?select=team_member_id,type,message,link&type=eq.staff_round_overdue&order=created_at.desc&limit=5" \
  -H "apikey: {SERVICE_ROLE_KEY}" -H "Authorization: Bearer {SERVICE_ROLE_KEY}"
```
Expected: rows for `MEMBER_A_ID` and `MEMBER_B_ID` only — no row for `MEMBER_C_ID`. Each row's `link` is `/clients/{CLIENT_ID}` and `message` starts with `"Round overdue: Round 1 for ..."`.

- [ ] **Step 7: Confirm the in-app bell renders it**

Log into the dashboard as Member A (or Member B) via the demo account flow, open `/dashboard`, click the bell in the header. Expected: unread badge shows a count, the dropdown lists the "Round overdue" entry with a relative timestamp, clicking it navigates to `/clients/{CLIENT_ID}` and the badge count decrements. Re-fetch `GET /api/notifications` (as that user, via browser devtools or by re-running Step 6's query filtered to that member) and confirm `read_at` is now set.

- [ ] **Step 8: Confirm the existing GHL/email channel still ran, untouched**

```bash
curl -s "{SUPABASE_URL}/rest/v1/activity_log?select=action,description,metadata&action=eq.notification_sent&order=created_at.desc&limit=3" \
  -H "apikey: {SERVICE_ROLE_KEY}" -H "Authorization: Bearer {SERVICE_ROLE_KEY}"
```
Expected: either a `notification_sent` row for `staff_round_overdue` (if the demo agency has `ghl_api_key`/`RESEND_API_KEY` configured) or nothing at all if neither is configured locally — either way, no error was thrown and Task 6's changes didn't alter this path's behavior.

- [ ] **Step 9: Shut down**

```bash
# Kill the `next start` background process.
```

- [ ] **Step 10: Commit** (only if Steps 1–9 required any fixes)

```bash
git add -A
git commit -m "fix: address issues found during staff push notification verification"
```
