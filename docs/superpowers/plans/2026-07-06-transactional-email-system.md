# Transactional Email System + Portal Link Flow + Staff Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a central transactional-email sender with four new templates (staff invite, portal link, staff doc-upload alert, staff first-login alert), wire the existing welcome email into regular signup, give invited team members a real way to log in, add a self-service "Forgot password?" flow, replace the single "Copy Portal Link" button with three explicit delivery channels (GHL SMS / Email / Copy), and fire staff alerts on two portal client events.

**Architecture:** A new `src/lib/email/` module provides a raw-`fetch`-based `sendEmail()` (matching this codebase's existing Resend-integration convention — no new npm dependency) plus template functions built on top of it. Existing, already-shipped pieces are reused rather than duplicated: the welcome email (`src/lib/admin/welcome-email.ts`, built in an earlier session) gets a third call site instead of a parallel implementation, and the self-service password-reset flow lands on the `/reset-password` page (also already built) instead of a new page. `portal-actions.ts`'s single link-rotation-plus-notify function is split into a shared rotation helper plus three channel-specific actions so the three dropdown options are genuinely independent, not all firing the GHL tag together.

**Tech Stack:** Next.js 16 App Router Server Actions/Route Handlers, Supabase Auth Admin API, `next/server`'s `after()` for non-blocking post-response work, raw `fetch` to Resend's REST API.

## Global Constraints

- No new npm dependencies — do NOT add the `resend` package. Every email send goes through raw `fetch` to `https://api.resend.com/emails`, matching the pattern already used in `src/lib/admin/welcome-email.ts` and `src/lib/ghl/notifications.ts`'s `sendResendFallback`.
- Every sender gracefully no-ops when `RESEND_API_KEY` is unset: log to console, return a truthy/success result, never throw. `RESEND_API_KEY` already exists in `.env.example` (line 19) — no env var changes needed anywhere in this plan.
- Fire-and-forget email sends that are side effects of some OTHER action (welcome email on signup, staff alerts on document upload/first portal view, staff invite email) MUST be wrapped in `next/server`'s `after()`, not a bare un-awaited promise or `setTimeout` — a prior session's plan shipped a bare `setTimeout` for unrelated post-response work and it had to be fixed to use `after()` because Vercel's serverless runtime can freeze the function before an un-awaited timer/promise completes. Email sends that are the DIRECT, expected result of a user's click (e.g. the "Send via Email" portal-link option) should be `await`ed normally so the UI can show a real success/failure toast.
- Do not rebuild `/reset-password` (`src/app/(auth)/reset-password/page.tsx`) or `sendAgencyWelcomeEmail` (`src/lib/admin/welcome-email.ts`) — both already exist from a prior session and are reused by this plan, not replaced.
- `src/middleware.ts` currently has `AUTH_ROUTES = ["/login", "/signup"]` and `PUBLIC_ROUTES = ["/", "/snapshot", "/terms", "/privacy", "/reset-password"]` — any new route this plan adds must be placed in the correct one (see Task 4).
- No test framework exists in this repo (no jest/vitest, no `npm test` script). Verification is `npx tsc --noEmit`, `npm run lint`, and `npm run build` for tasks that add routes/pages.

---

### Task 1: Central email module + new templates

**Files:**
- Create: `src/lib/email/index.ts`
- Create: `src/lib/email/templates.ts`

**Interfaces:**
- Produces: `sendEmail(params: { to: string; subject: string; html: string; text: string }): Promise<boolean>` — the shared low-level sender.
- Produces: `sendStaffInviteEmail(params: { inviteeName: string; inviteeEmail: string; agencyName: string; inviterName: string; inviteLink: string }): Promise<boolean>`
- Produces: `sendPortalLinkEmail(params: { clientEmail: string; clientFirstName: string; agencyName: string; portalUrl: string; agencyPhone?: string }): Promise<boolean>`
- Produces: `sendStaffDocUploadAlert(params: { staffEmail: string; staffName: string; clientName: string; documentName: string; documentCategory: string; clientDashboardUrl: string }): Promise<boolean>`
- Produces: `sendStaffFirstLoginAlert(params: { staffEmail: string; clientName: string; clientDashboardUrl: string }): Promise<boolean>`
- Consumes: nothing from other tasks — this is the foundation Tasks 3, 5, and 6 build on.

- [ ] **Step 1: Write the central sender**

Create `src/lib/email/index.ts`:

```ts
const FROM = "ClientDeck Pro <noreply@clientdeckpro.com>";

/**
 * Sends a transactional email via Resend's REST API directly (no SDK
 * dependency, matching the pattern already used in
 * src/lib/admin/welcome-email.ts and src/lib/ghl/notifications.ts).
 * Never throws — logs and returns false on failure so callers can treat
 * every send as best-effort.
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[Email DEV] ${params.subject} → ${params.to}`);
    return true;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error(`[Email] Resend error ${res.status}: ${detail.slice(0, 200)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Email] Send failed:", err);
    return false;
  }
}
```

- [ ] **Step 2: Write the four new templates**

Create `src/lib/email/templates.ts`:

```ts
import { sendEmail } from "./index";

export async function sendStaffInviteEmail(params: {
  inviteeName: string;
  inviteeEmail: string;
  agencyName: string;
  inviterName: string;
  inviteLink: string;
}): Promise<boolean> {
  const html = `
    <h2>You've been invited!</h2>
    <p>${params.inviterName} has invited you to join <strong>${params.agencyName}</strong> on ClientDeck Pro.</p>
    <p><a href="${params.inviteLink}" style="background:#2563EB;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">Accept Invitation →</a></p>
    <p>This link expires in 24 hours.</p>
    <p>ClientDeck Pro is a dispute management platform for credit professionals.</p>
  `;
  const text = `You've been invited!\n\n${params.inviterName} has invited you to join ${params.agencyName} on ClientDeck Pro.\n\nAccept your invitation: ${params.inviteLink}\n\nThis link expires in 24 hours.`;
  return sendEmail({
    to: params.inviteeEmail,
    subject: `${params.agencyName} invited you to ClientDeck Pro`,
    html,
    text,
  });
}

export async function sendPortalLinkEmail(params: {
  clientEmail: string;
  clientFirstName: string;
  agencyName: string;
  portalUrl: string;
  agencyPhone?: string;
}): Promise<boolean> {
  const phoneLine = params.agencyPhone ? `<p>Questions? Call us: ${params.agencyPhone}</p>` : "";
  const html = `
    <h2>Hi ${params.clientFirstName}!</h2>
    <p>Your personal credit repair portal is ready. View your progress, upload documents, and track your journey.</p>
    <p><a href="${params.portalUrl}" style="background:#2563EB;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">View My Portal →</a></p>
    <p>This link is personal to you — don't share it.</p>
    ${phoneLine}
    <p>— ${params.agencyName} Team</p>
  `;
  const text = `Hi ${params.clientFirstName}!\n\nYour personal credit repair portal is ready: ${params.portalUrl}\n\nThis link is personal to you — don't share it.${params.agencyPhone ? `\n\nQuestions? Call us: ${params.agencyPhone}` : ""}\n\n— ${params.agencyName} Team`;
  return sendEmail({
    to: params.clientEmail,
    subject: `Your ${params.agencyName} credit repair portal is ready`,
    html,
    text,
  });
}

export async function sendStaffDocUploadAlert(params: {
  staffEmail: string;
  staffName: string;
  clientName: string;
  documentName: string;
  documentCategory: string;
  clientDashboardUrl: string;
}): Promise<boolean> {
  const html = `
    <h3>Document uploaded by client</h3>
    <p><strong>${params.clientName}</strong> just uploaded a document to their portal:</p>
    <ul>
      <li>File: ${params.documentName}</li>
      <li>Category: ${params.documentCategory}</li>
    </ul>
    <p><a href="${params.clientDashboardUrl}">View in ClientDeck Pro →</a></p>
  `;
  const text = `${params.clientName} uploaded a document to their portal.\n\nFile: ${params.documentName}\nCategory: ${params.documentCategory}\n\nView in ClientDeck Pro: ${params.clientDashboardUrl}`;
  return sendEmail({
    to: params.staffEmail,
    subject: `${params.clientName} uploaded a document`,
    html,
    text,
  });
}

export async function sendStaffFirstLoginAlert(params: {
  staffEmail: string;
  clientName: string;
  clientDashboardUrl: string;
}): Promise<boolean> {
  const html = `
    <p><strong>${params.clientName}</strong> just logged into their credit repair portal for the first time.</p>
    <p>This is a great time to reach out and check in!</p>
    <p><a href="${params.clientDashboardUrl}">View Client →</a></p>
  `;
  const text = `${params.clientName} just logged into their credit repair portal for the first time.\n\nThis is a great time to reach out and check in!\n\nView client: ${params.clientDashboardUrl}`;
  return sendEmail({
    to: params.staffEmail,
    subject: `${params.clientName} just viewed their portal for the first time`,
    html,
    text,
  });
}
```

- [ ] **Step 3: Verify types and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/email/index.ts src/lib/email/templates.ts
git commit -m "feat: add central email sender + staff/portal notification templates"
```

---

### Task 2: Wire the welcome email into regular signup

**Files:**
- Modify: `src/app/(auth)/actions.ts`

**Interfaces:**
- Consumes: `sendAgencyWelcomeEmail(agency: { name: string; owner_name: string; owner_email: string }): Promise<{ ok: boolean; message: string }>` — already exported from `src/lib/admin/welcome-email.ts` (built in a prior session; do not modify its signature or content).

**Context:** `sendAgencyWelcomeEmail` already has two call sites (`src/app/api/admin/tools/resend-welcome/route.ts` and `src/app/(admin)/admin/agencies/create-agency-actions.ts`) and already tolerates being called with just the three base fields and no `options` (the resend-welcome route already does exactly that). This task adds signup as a third call site with zero changes to the function itself. Separately: `adminCreateAgency()`'s "Send welcome email" checkbox and the admin panel's "Resend Welcome Email" tool (spec items 9b's second half and 9g) already exist from a prior session — no work needed for either, confirmed via this task's own Step 3 below.

- [ ] **Step 1: Add the welcome-email call to `signUpAction`**

In `src/app/(auth)/actions.ts`, add the import:

```ts
import { after } from "next/server";
import { sendAgencyWelcomeEmail } from "@/lib/admin/welcome-email";
```

Then, in `signUpAction`, immediately before the function's final `return { success: true };` (after the team_member row has been created/confirmed), add:

```ts
  // Best-effort welcome email — never blocks or fails the signup response.
  after(() => {
    sendAgencyWelcomeEmail({ name: agencyName, owner_name: name, owner_email: email }).catch((err) =>
      console.error("[Email] Welcome email failed:", err)
    );
  });

  return { success: true };
```

- [ ] **Step 2: Verify types and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 3: Confirm the two already-existing pieces are intact (no code change, verification only)**

Run: `grep -n "sendWelcomeEmail\|sendAgencyWelcomeEmail" "src/app/(admin)/admin/agencies/create-agency-actions.ts"`
Expected: a match showing `adminCreateAgency` already calls `sendAgencyWelcomeEmail` when `input.sendWelcomeEmail` is true (built in a prior session) — confirms Task 2 doesn't need to add this.

Run: `grep -rn "resend-welcome" src/components/admin/agency-slideover.tsx`
Expected: a match showing the admin ToolsTab already has a "Resend Welcome Email" tool calling `/api/admin/tools/resend-welcome` (built in a prior session) — confirms no separate admin tool needs to be added for this plan's item 9g.

If either grep comes back empty, STOP and report NEEDS_CONTEXT — that would mean the codebase doesn't match this plan's assumptions and the controller needs to re-evaluate scope before you proceed.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(auth)/actions.ts"
git commit -m "feat: send the welcome email on regular agency signup"
```

---

### Task 3: Real Supabase Auth invite for team members + branded email

**Files:**
- Modify: `src/app/(dashboard)/team/actions.ts`

**Interfaces:**
- Consumes: `sendStaffInviteEmail` (Task 1).
- Produces: `inviteTeamMember`'s behavior changes internally (same exported signature `(input: { name: string; email: string; role: TeamRole }) => Promise<{ success: boolean; error?: string }>`) — no other file needs to change.

**Context — a real gap, not just "add an email":** today `inviteTeamMember` inserts a `team_members` row with `user_id: null` and sends no email at all — an invited person has no Supabase Auth account and no way to discover they were invited or log in. This task fixes that by generating a real Supabase Auth user via the admin API's `generateLink({ type: "invite" })` (which creates the account and returns an action link WITHOUT auto-sending Supabase's own email — the same technique already used for the recovery link in `create-agency-actions.ts`), then sends our own branded email with that link. The link redirects to `/reset-password` (already built, already reviewed) — that page's existing `getSession()` fallback treats any established Supabase session as "ready to set a password," so it works for an invite-flow session exactly as it already does for a recovery-flow session, with no changes needed to that page.

- [ ] **Step 1: Extend `inviteTeamMember`**

In `src/app/(dashboard)/team/actions.ts`, add the import at the top:

```ts
import { sendStaffInviteEmail } from "@/lib/email/templates";
import { after } from "next/server";
```

Then, replace the block from `const { error } = await admin.from("team_members").insert({` through the final `return { success: true };` with:

```ts
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://app.clientdeckpro.com").replace(/\/$/, "");

  let userId: string | null = null;
  let inviteLink = `${appUrl}/login`;
  try {
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo: `${appUrl}/reset-password` },
    });
    if (!linkError && linkData?.user) {
      userId = linkData.user.id;
      inviteLink = linkData.properties?.action_link ?? inviteLink;
    } else if (linkError && /already.*(registered|exists)/i.test(linkError.message)) {
      // Email already has a Supabase Auth account elsewhere (e.g. owns/works
      // at another agency) — reuse that user id instead of failing the invite.
      for (let page = 1; page <= 5; page++) {
        const { data, error: listError } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (listError || !data) break;
        const match = data.users.find((u) => u.email?.toLowerCase() === email);
        if (match) {
          userId = match.id;
          break;
        }
        if (data.users.length < 200) break;
      }
    }
  } catch (e) {
    console.error("Could not generate team invite link:", e);
  }

  const { error } = await admin.from("team_members").insert({
    agency_id: session.agency.id,
    user_id: userId,
    name,
    email,
    role,
    is_active: true,
  });
  if (error) return { success: false, error: error.message };

  after(() => {
    sendStaffInviteEmail({
      inviteeName: name,
      inviteeEmail: email,
      agencyName: session.agency.name,
      inviterName: session.teamMember.name,
      inviteLink,
    }).catch((err) => console.error("[Email] Staff invite email failed:", err));
  });

  revalidatePath("/team");
  return { success: true };
```

- [ ] **Step 2: Verify types and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/team/actions.ts"
git commit -m "feat: create a real Supabase Auth account + send a branded email when inviting a team member"
```

---

### Task 4: Forgot-password page + login link

**Files:**
- Create: `src/app/(auth)/forgot-password/page.tsx`
- Modify: `src/app/(auth)/login/page.tsx`
- Modify: `src/middleware.ts`

**Interfaces:** None new — this reuses the existing `/reset-password` page and `createClient()` from `@/lib/supabase/client` exactly as `/login` already does.

- [ ] **Step 1: Build the forgot-password page**

Create `src/app/(auth)/forgot-password/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const supabase = createClient();
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || window.location.origin).replace(/\/$/, "");
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${appUrl}/reset-password`,
    });

    setPending(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <CheckCircle2 className="mx-auto h-8 w-8 text-green-600" />
        <h1 className="text-xl font-semibold text-gray-900">Check your email</h1>
        <p className="text-sm text-gray-500">
          If an account exists for {email}, we've sent a link to reset your password.
        </p>
        <Link href="/login" className="inline-block text-sm font-medium text-blue-600 hover:text-blue-700">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-gray-900">Reset your password</h1>
        <p className="text-sm text-gray-500">
          Enter your email and we'll send you a link to set a new password.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@agency.com"
            autoComplete="email"
            required
          />
        </Field>

        <Button type="submit" loading={pending} className="w-full">
          {pending ? "Sending…" : "Send reset link"}
        </Button>
      </form>

      <p className="text-center text-sm text-gray-500">
        <Link href="/login" className="font-medium text-blue-600 hover:text-blue-700">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Add the "Forgot password?" link to `/login`**

In `src/app/(auth)/login/page.tsx`, inside the `<form onSubmit={handleSubmit} className="space-y-4">`, immediately after the password `<Field>` block and before the `<Button type="submit" ...>`, add:

```tsx
        <p className="text-right text-sm">
          <Link href="/forgot-password" className="font-medium text-blue-600 hover:text-blue-700">
            Forgot password?
          </Link>
        </p>
```

(`Link` is already imported in this file for the "Create one" link at the bottom.)

- [ ] **Step 3: Make `/forgot-password` reachable while signed out, and bounce signed-in users away like `/login`/`/signup`**

In `src/middleware.ts`, change:

```ts
const AUTH_ROUTES = ["/login", "/signup"];
```
to:
```ts
const AUTH_ROUTES = ["/login", "/signup", "/forgot-password"];
```

(This is deliberately `AUTH_ROUTES`, not `PUBLIC_ROUTES` — unlike `/reset-password`, `/forgot-password` is just an email-entry form with no Supabase session involved, so there's no risk of a valid-session user being bounced away from a page they still need; a signed-in user visiting `/forgot-password` should be redirected to `/dashboard` exactly like visiting `/login`/`/signup` does today.)

- [ ] **Step 4: Verify types, lint, and build**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new errors.

Run: `npm run build`
Expected: build succeeds, route table includes `/forgot-password`.

- [ ] **Step 5: Manual check**

Run `npm run dev`, visit `/login` → confirm "Forgot password?" link appears below the password field → click it → `/forgot-password` renders → submit an email → confirmation message shown.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(auth)/forgot-password/page.tsx" "src/app/(auth)/login/page.tsx" src/middleware.ts
git commit -m "feat: add self-service forgot-password flow, reusing the existing /reset-password page"
```

---

### Task 5: Portal link — three explicit delivery channels

**Files:**
- Modify: `src/app/(dashboard)/clients/[id]/portal-actions.ts`
- Create: `src/app/(dashboard)/clients/[id]/portal-link-menu.tsx`
- Delete: `src/app/(dashboard)/clients/[id]/copy-portal-link.tsx`
- Modify: `src/app/(dashboard)/clients/[id]/client-header.tsx`

**Interfaces:**
- Consumes: `sendPortalLinkEmail` (Task 1).
- Produces:
  ```ts
  type PortalLinkResult = { success: true; url: string } | { success: false; error: string };
  export async function copyPortalLink(clientId: string): Promise<PortalLinkResult>
  export async function sendPortalLinkViaGHL(clientId: string): Promise<PortalLinkResult>
  export async function sendPortalLinkViaEmailAction(clientId: string): Promise<PortalLinkResult>
  ```
- Removes: `generateAndSyncPortalLink` — confirmed via grep (in this task's Step 1) to have exactly one caller, the component this task deletes, so removing it is safe.

**Context:** `generateAndSyncPortalLink` today unconditionally fires the GHL notification tag on every call, so a naive 3-option dropdown built on top of it would fire an SMS every time someone clicked "Copy Link" or "Send via Email" too. This task splits link *rotation* (always needed, whichever channel is chosen) from channel-specific *notification* (GHL tag only for the SMS option, email only for the email option, neither for plain copy).

- [ ] **Step 1: Confirm `generateAndSyncPortalLink` has exactly one caller**

Run: `grep -rn "generateAndSyncPortalLink" src`
Expected: two matches, both in `src/app/(dashboard)/clients/[id]/copy-portal-link.tsx` (the import and the call) and the definition in `portal-actions.ts` itself — i.e., no other file calls it. If you find a caller anywhere else, STOP and report BLOCKED — the refactor below assumes there is only the one call site this task is replacing.

- [ ] **Step 2: Replace `portal-actions.ts` with the split rotation + three channel actions**

Replace the entire contents of `src/app/(dashboard)/clients/[id]/portal-actions.ts`:

```ts
"use server";

import { getSessionContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { generatePortalLink } from "@/lib/utils/portal-token";
import { updateGHLContactFields } from "@/lib/ghl/api";
import { markOnboardingStep } from "@/lib/onboarding/mark";
import { sendPortalLinkEmail } from "@/lib/email/templates";
import {
  notifyPortalLink,
  NOTIFIABLE_CLIENT_COLUMNS,
  type NotifiableClient,
} from "@/lib/ghl/notifications";
import type { SessionContext } from "@/lib/auth/session";

type PortalLinkResult = { success: true; url: string } | { success: false; error: string };

/**
 * Rotates the client's portal token and (best-effort) pushes it into the GHL
 * `clientdeck_portal_link` custom field. Does NOT fire any client-facing
 * notification — that's each channel action's own job, so the three portal-
 * link delivery options stay genuinely independent.
 */
async function rotatePortalLink(
  clientId: string,
  session: SessionContext
): Promise<
  | { success: true; url: string; token: string; client: NotifiableClient }
  | { success: false; error: string }
> {
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

  const token = new URL(url).searchParams.get("token")!;
  const { ghl_api_key, ghl_location_id } = session.agency;
  if (ghl_api_key && ghl_location_id && client.ghl_contact_id) {
    await updateGHLContactFields(
      client.ghl_contact_id,
      { clientdeck_portal_link: url },
      { apiKey: ghl_api_key, locationId: ghl_location_id }
    ).catch((e) => console.error("Failed to sync portal link to GHL:", e));
  }

  await markOnboardingStep(session.agency.id, "test_portal_viewed", true);

  return { success: true, url, token, client: client as NotifiableClient };
}

async function logPortalActivity(
  session: SessionContext,
  clientId: string,
  action: string,
  description: string
): Promise<void> {
  const supabase = await createServerSupabaseClient();
  await supabase.from("activity_log").insert({
    agency_id: session.agency.id,
    client_id: clientId,
    actor_type: "staff",
    actor_id: session.userId,
    action,
    description,
  });
}

/** Rotates the link and returns it for the staff member to copy — no notification sent. */
export async function copyPortalLink(clientId: string): Promise<PortalLinkResult> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  const rotated = await rotatePortalLink(clientId, session);
  if (!rotated.success) return rotated;

  await logPortalActivity(
    session,
    clientId,
    "Portal link generated",
    "A new client portal magic link was generated."
  );
  return { success: true, url: rotated.url };
}

/** Rotates the link and fires the GHL `cdp-portal-sent` tag so the agency's own workflow SMS's it. */
export async function sendPortalLinkViaGHL(clientId: string): Promise<PortalLinkResult> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };
  if (!session.agency.ghl_api_key || !session.agency.ghl_location_id) {
    return { success: false, error: "Connect GHL to send SMS." };
  }

  const rotated = await rotatePortalLink(clientId, session);
  if (!rotated.success) return rotated;

  await notifyPortalLink(session.agency, { ...rotated.client, portal_token: rotated.token });
  await logPortalActivity(
    session,
    clientId,
    "Portal link sent via GHL SMS",
    "A fresh portal link was tagged for GHL SMS delivery."
  );
  return { success: true, url: rotated.url };
}

/** Rotates the link and emails it directly to the client via Resend. */
export async function sendPortalLinkViaEmailAction(clientId: string): Promise<PortalLinkResult> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  const supabase = await createServerSupabaseClient();
  const { data: clientRow } = await supabase.from("clients").select("email").eq("id", clientId).single();
  if (!clientRow?.email) return { success: false, error: "Add client email first." };

  const rotated = await rotatePortalLink(clientId, session);
  if (!rotated.success) return rotated;

  const sent = await sendPortalLinkEmail({
    clientEmail: clientRow.email,
    clientFirstName: rotated.client.first_name,
    agencyName: session.agency.name,
    portalUrl: rotated.url,
    agencyPhone: session.agency.phone ?? undefined,
  });
  if (!sent) return { success: false, error: "Could not send email. Try again." };

  await logPortalActivity(
    session,
    clientId,
    "Portal link emailed to client",
    `Sent to ${clientRow.email}.`
  );
  return { success: true, url: rotated.url };
}
```

- [ ] **Step 3: Build the dropdown component**

Create `src/app/(dashboard)/clients/[id]/portal-link-menu.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Link2, Mail, MessageSquare, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { copyPortalLink, sendPortalLinkViaGHL, sendPortalLinkViaEmailAction } from "./portal-actions";

export function PortalLinkMenu({ clientId }: { clientId: string }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function handleCopy() {
    setBusy("copy");
    setOpen(false);
    const result = await copyPortalLink(clientId);
    setBusy(null);
    if (!result.success) {
      toast(result.error, "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(result.url);
      setCopied(true);
      toast("Fresh portal link copied to clipboard.", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast(result.url, "info");
    }
  }

  async function handleGHL() {
    setBusy("ghl");
    setOpen(false);
    const result = await sendPortalLinkViaGHL(clientId);
    setBusy(null);
    if (!result.success) {
      toast(result.error, "error");
      return;
    }
    toast("Portal link sent via GHL SMS.", "success");
  }

  async function handleEmail() {
    setBusy("email");
    setOpen(false);
    const result = await sendPortalLinkViaEmailAction(clientId);
    setBusy(null);
    if (!result.success) {
      toast(result.error, "error");
      return;
    }
    toast("Portal link sent via email.", "success");
  }

  return (
    <div className="relative" ref={menuRef}>
      <Button variant="secondary" onClick={() => setOpen((o) => !o)} loading={busy !== null}>
        {copied ? <Check className="h-4 w-4 text-green-600" /> : <Link2 className="h-4 w-4" />}
        Share Portal Link
        <ChevronDown className="h-3.5 w-3.5" />
      </Button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-56 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
          <button
            onClick={handleGHL}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <MessageSquare className="h-4 w-4" /> Send via GHL SMS
          </button>
          <button
            onClick={handleEmail}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Mail className="h-4 w-4" /> Send via Email
          </button>
          <button
            onClick={handleCopy}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Link2 className="h-4 w-4" /> Copy Link
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Swap the old button for the new menu in the client header**

In `src/app/(dashboard)/clients/[id]/client-header.tsx`, replace the import:

```tsx
import { CopyPortalLink } from "./copy-portal-link";
```
with:
```tsx
import { PortalLinkMenu } from "./portal-link-menu";
```

And replace the usage `<CopyPortalLink clientId={client.id} />` with `<PortalLinkMenu clientId={client.id} />` (same position in the action button row, no other changes to this file).

- [ ] **Step 5: Delete the old component**

```bash
rm "src/app/(dashboard)/clients/[id]/copy-portal-link.tsx"
```

- [ ] **Step 6: Verify types, lint, and build**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new errors.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 7: Manual check**

Run `npm run dev`, open a client with a saved email → click "Share Portal Link" → confirm all 3 options appear → try "Copy Link" (clipboard + toast, no GHL tag fired if you're watching GHL activity) → try "Send via Email" (toast confirms send) → try "Send via GHL SMS" on a client whose agency has no GHL connected (should toast "Connect GHL to send SMS" without rotating anything visibly broken).

- [ ] **Step 8: Commit**

```bash
git add "src/app/(dashboard)/clients/[id]/portal-actions.ts" "src/app/(dashboard)/clients/[id]/portal-link-menu.tsx" "src/app/(dashboard)/clients/[id]/client-header.tsx"
git add -u "src/app/(dashboard)/clients/[id]/copy-portal-link.tsx"
git commit -m "feat: replace single portal-link button with GHL SMS / Email / Copy delivery options"
```

---

### Task 6: Staff alerts on portal document upload + first portal view

**Files:**
- Create: `src/lib/team/staff-contact.ts`
- Modify: `src/app/portal/(client)/documents/actions.ts`
- Modify: `src/app/portal/(client)/dashboard/page.tsx`

**Interfaces:**
- Produces: `resolveAssignedStaffEmail(supabase: SupabaseClientLike, assignedTo: string | null, ownerEmail: string): Promise<string>` — looks up the assigned `team_members.email`, falling back to the agency owner's email if unassigned or not found. Both this task's call sites pass an admin (service-role) Supabase client, since portal requests have no Supabase Auth session to scope RLS against.
- Consumes: `sendStaffDocUploadAlert`, `sendStaffFirstLoginAlert` (Task 1).

- [ ] **Step 1: Build the assigned-staff-email resolver**

Create `src/lib/team/staff-contact.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Resolves the email a staff-facing notification for this client should go
 * to: the assigned team member's email if one is set (and still resolves),
 * otherwise the agency owner's email.
 */
export async function resolveAssignedStaffEmail(
  supabase: SupabaseClient,
  assignedTo: string | null,
  ownerEmail: string
): Promise<string> {
  if (assignedTo) {
    const { data } = await supabase
      .from("team_members")
      .select("email")
      .eq("id", assignedTo)
      .maybeSingle();
    if (data?.email) return data.email;
  }
  return ownerEmail;
}
```

- [ ] **Step 2: Fire the doc-upload alert from the portal upload action**

In `src/app/portal/(client)/documents/actions.ts`, add the imports:

```ts
import { resolveAssignedStaffEmail } from "@/lib/team/staff-contact";
import { sendStaffDocUploadAlert } from "@/lib/email/templates";
```

Then, inside `portalUploadDocument`, extend the existing `after(async () => { ... })` block (the one that currently only calls `syncDocumentToDrive`) to also send the staff alert. Replace:

```ts
  after(async () => {
    try {
      await syncDocumentToDrive(agency, {
        clientName,
        subFolder: "Client_Uploads",
        fileName: file.name,
        fileBuffer: buffer,
        mimeType: file.type || "application/octet-stream",
      });
    } catch (err) {
      console.error("[Drive] Portal upload sync failed:", err);
    }
  });
```
with:
```ts
  after(async () => {
    try {
      await syncDocumentToDrive(agency, {
        clientName,
        subFolder: "Client_Uploads",
        fileName: file.name,
        fileBuffer: buffer,
        mimeType: file.type || "application/octet-stream",
      });
    } catch (err) {
      console.error("[Drive] Portal upload sync failed:", err);
    }

    try {
      const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://app.clientdeckpro.com").replace(/\/$/, "");
      const staffEmail = await resolveAssignedStaffEmail(admin, client.assigned_to, agency.owner_email);
      await sendStaffDocUploadAlert({
        staffEmail,
        staffName: "Team",
        clientName,
        documentName: file.name,
        documentCategory: category,
        clientDashboardUrl: `${appUrl}/clients/${client.id}`,
      });
    } catch (err) {
      console.error("[Email] Staff doc-upload alert failed:", err);
    }
  });
```

(`admin`, `client`, `agency`, `clientName`, `file`, and `category` are all already in scope in this function — no other changes needed.)

- [ ] **Step 3: Track first portal view + alert staff**

In `src/app/portal/(client)/dashboard/page.tsx`, add the imports:

```ts
import { after } from "next/server";
import { resolveAssignedStaffEmail } from "@/lib/team/staff-contact";
import { sendStaffFirstLoginAlert } from "@/lib/email/templates";
```

Then, inside `PortalDashboardPage`, immediately after the existing `const supabase = createAdminClient();` line and before the `latestRound` query, add:

```ts
  try {
    const { data: priorView } = await supabase
      .from("activity_log")
      .select("id")
      .eq("client_id", client.id)
      .eq("action", "Portal viewed")
      .limit(1)
      .maybeSingle();

    if (!priorView) {
      await supabase.from("activity_log").insert({
        agency_id: agency.id,
        client_id: client.id,
        actor_type: "client",
        action: "Portal viewed",
        description: "Client viewed their portal for the first time.",
      });

      const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://app.clientdeckpro.com").replace(/\/$/, "");
      const staffEmail = await resolveAssignedStaffEmail(supabase, client.assigned_to, agency.owner_email);
      after(() => {
        sendStaffFirstLoginAlert({
          staffEmail,
          clientName: `${client.first_name} ${client.last_name}`,
          clientDashboardUrl: `${appUrl}/clients/${client.id}`,
        }).catch((err) => console.error("[Email] Staff first-login alert failed:", err));
      });
    }
  } catch (err) {
    console.error("[Portal] First-view tracking failed:", err);
  }
```

This must never block or break rendering the dashboard — it's wrapped in its own `try/catch` so a logging failure can't take down the page.

- [ ] **Step 4: Verify types, lint, and build**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new errors.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Manual check**

Run `npm run dev`. Upload a document from a test client's portal session → confirm (via console log, since `RESEND_API_KEY` is likely unset in dev) a `[Email DEV]` line for the doc-upload alert appears alongside the existing Drive-sync behavior. Load a test client's portal dashboard for the first time → confirm a `[Email DEV]` line for the first-login alert appears; reload the same dashboard → confirm it does NOT fire again (only once per client, ever).

- [ ] **Step 6: Commit**

```bash
git add src/lib/team/staff-contact.ts "src/app/portal/(client)/documents/actions.ts" "src/app/portal/(client)/dashboard/page.tsx"
git commit -m "feat: alert assigned staff on client document upload and first portal view"
```

---

## Self-Review Notes

- **Spec coverage:** 9a (central sender + templates) → Task 1. 9b (welcome email wiring + admin checkbox) → Task 2 (signup wired; admin checkbox already existed, verified not re-built). 9c (staff invite email) → Task 3 (upgraded to also fix the real "no login path" gap the spec's literal code assumed was already solved). 9d (forgot password) → Task 4 (reuses the existing `/reset-password` page instead of rebuilding it). 9e (portal link options) → Task 5. 9f (staff alerts) → Task 6. 9g (admin send-welcome tool) → verified already built in Task 2, Step 3, no new code. 9h (env var) → confirmed already present in `.env.example`, no change needed.
- **Reconciled spec/code mismatches:** the spec assumed `resend` npm package, `supabase.auth.admin.inviteUserByEmail` already wired to team invites, and a from-scratch `/reset-password` page — none were true; this plan uses the raw-fetch convention already established in this codebase, builds the missing Supabase-Auth-account creation into the invite flow properly (via `generateLink` rather than `inviteUserByEmail`, to avoid double-emailing since Supabase's own invite email isn't customizable and this plan wants ITS OWN branded email instead), and reuses the already-built `/reset-password` page.
- **Type consistency:** `PortalLinkResult`'s `{success:true,url} | {success:false,error}` shape in Task 5 matches what `PortalLinkMenu` (same task) destructures; `resolveAssignedStaffEmail`'s signature in Task 6 is used identically at both of Task 6's call sites; every template function's param shape in Task 1 matches exactly what Tasks 3/5/6 pass in.
