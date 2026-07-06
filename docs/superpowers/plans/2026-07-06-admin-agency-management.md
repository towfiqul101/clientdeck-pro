# Admin Agency Management (Create Agency + Slide-over Consolidation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let super-admins manually create an agency from `/admin/agencies`, and consolidate the two currently-coexisting agency-detail UIs (an old full-page route and a newer tabbed slide-over) into a single slide-over-based flow reachable from every page that links to an agency.

**Architecture:** `/admin/agencies` becomes a server page that fetches rows and hands them to a client component (`AgenciesTable`) which opens the existing `AgencySlideover` on row click — the exact pattern already used by the admin dashboard's `AgencyList`. A "+ Create Agency" button opens a new modal that calls a new `adminCreateAgency` server action modeled on the agency-signup flow (`src/app/(auth)/actions.ts`). A "Danger Zone" delete flow is added to the slide-over's Status tab, and the old full-page route (`/admin/agencies/[id]`) is deleted along with its now-redundant server actions.

**Tech Stack:** Next.js 16 App Router, Supabase (service-role client for all admin writes), TypeScript, Tailwind.

## Global Constraints

- Admin session guard: every new server action/route MUST call `isAdmin()` (from `src/lib/auth/admin.ts`) or `requireAdminApi()` (API routes) before touching data — no exceptions.
- No new database migrations — this uses existing `agencies`, `team_members`, `activity_log` tables and the existing `settings` JSONB column only.
- Admin-created agencies bypass Stripe entirely — plan/status are set directly by the admin, never via checkout.
- No test framework exists in this repo (`package.json` has no `test` script, no jest/vitest). Verification is `npx tsc --noEmit`, `npm run lint`, and `npm run build` after each task, plus a manual click-through since this is UI-heavy admin tooling.
- Follow existing conventions exactly: `cn()` from `src/lib/utils/helpers.ts`, Lucide icons only, `createAdminClient()` for all admin reads/writes, the `Result = { success: boolean; error?: string }` return shape used by every existing panel action.

---

### Task 1: `adminCreateAgency` server action + shared welcome-email helper

**Files:**
- Modify: `src/types/index.ts` (add `admin_notes?: string` to `AgencySettings`, around line 101-131)
- Create: `src/lib/admin/welcome-email.ts`
- Modify: `src/app/api/admin/tools/resend-welcome/route.ts` (use the extracted helper instead of inline fetch)
- Create: `src/app/(admin)/admin/agencies/create-agency-actions.ts`

**Interfaces:**
- Produces: `sendAgencyWelcomeEmail(agency: { name: string; owner_name: string; owner_email: string }): Promise<{ ok: boolean; message: string }>` — reused by both the resend-welcome tool and the new create-agency action.
- Produces: `adminCreateAgency(input: CreateAgencyInput): Promise<CreateAgencyResult>` where
  ```ts
  export interface CreateAgencyInput {
    name: string;
    ownerName: string;
    ownerEmail: string;
    phone?: string;
    plan: Plan;
    status: PlanStatus;
    maxClients?: number;
    trialEndDate?: string; // "YYYY-MM-DD" or ""
    ghlLocationId?: string;
    ghlApiKey?: string;
    adminNotes?: string;
    sendWelcomeEmail: boolean;
  }
  export type CreateAgencyResult =
    | { success: true; agencyId: string }
    | { success: false; error: string; fieldErrors?: Record<string, string> };
  ```
- Consumes (Task 1 only reads, doesn't call): `maxClientsForPlan` from `src/lib/billing/plans.ts`, `isAdmin`/`getAdminEmail` from `src/lib/auth/admin.ts`, `createAdminClient` from `src/lib/supabase/admin.ts`.

- [ ] **Step 1: Add `admin_notes` to `AgencySettings`**

In `src/types/index.ts`, inside the `AgencySettings` interface (currently ends `auto_pull_scores?: boolean;` before the closing brace around line 130), add:

```ts
  // Credit monitoring (Session 7)
  auto_pull_scores?: boolean;
  // Admin panel internal notes (not shown to the agency)
  admin_notes?: string | null;
}
```

- [ ] **Step 2: Extract the welcome-email sender into a shared helper**

Create `src/lib/admin/welcome-email.ts`:

```ts
interface WelcomeEmailAgency {
  name: string;
  owner_name: string;
  owner_email: string;
}

/** Sends (or logs, if RESEND_API_KEY is unset) the onboarding welcome email. */
export async function sendAgencyWelcomeEmail(
  agency: WelcomeEmailAgency
): Promise<{ ok: boolean; message: string }> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://clientdeckpro.com";
  const subject = "Welcome to ClientDeck Pro — let's get you set up";
  const text = `Hi ${agency.owner_name || "there"},

Welcome to ClientDeck Pro! Here's how to get ${agency.name} up and running:

1. Log in at ${appUrl}/login
2. Connect your GoHighLevel account under Settings → GHL (paste your Location ID and API key)
3. Install the ClientDeck Pro snapshot to load your pipelines and custom fields
4. Add your first client and generate a dispute round

Need a hand? Just reply to this email and we'll help you get set up.

— The ClientDeck Pro Team`;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(
      `[DEV] Welcome email would send to ${agency.owner_email} — Subject: ${subject}`
    );
    return {
      ok: true,
      message: `Welcome email logged (no RESEND_API_KEY set) for ${agency.owner_email}.`,
    };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "ClientDeck Pro <onboarding@clientdeckpro.com>",
        to: [agency.owner_email],
        subject,
        text,
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      return { ok: false, message: `Resend error ${res.status}: ${detail.slice(0, 200)}` };
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Send failed" };
  }

  return { ok: true, message: `Welcome email sent to ${agency.owner_email}.` };
}
```

- [ ] **Step 3: Point the existing resend-welcome route at the shared helper**

In `src/app/api/admin/tools/resend-welcome/route.ts`, replace the whole body from the `appUrl`/`subject`/`text` block down through the final `return` with a call to the helper:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApi, loadAgencyGhl } from "@/lib/admin/tool-helpers";
import { sendAgencyWelcomeEmail } from "@/lib/admin/welcome-email";

export const dynamic = "force-dynamic";

/** Resends the onboarding/welcome email to the agency owner via Resend. */
export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;

  const { agencyId } = await request.json().catch(() => ({ agencyId: "" }));
  if (!agencyId) {
    return NextResponse.json({ ok: false, error: "Missing agencyId" }, { status: 400 });
  }

  const agency = await loadAgencyGhl(agencyId);
  if (!agency) {
    return NextResponse.json({ ok: false, error: "Agency not found" }, { status: 404 });
  }

  const result = await sendAgencyWelcomeEmail(agency);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.message }, { status: 502 });
  }
  return NextResponse.json({ ok: true, message: result.message });
}
```

- [ ] **Step 4: Write `adminCreateAgency`**

Create `src/app/(admin)/admin/agencies/create-agency-actions.ts`:

```ts
"use server";

import { randomBytes } from "crypto";
import { isAdmin, getAdminEmail } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { maxClientsForPlan } from "@/lib/billing/plans";
import { sendAgencyWelcomeEmail } from "@/lib/admin/welcome-email";
import type { Plan, PlanStatus } from "@/types";

export interface CreateAgencyInput {
  name: string;
  ownerName: string;
  ownerEmail: string;
  phone?: string;
  plan: Plan;
  status: PlanStatus;
  maxClients?: number;
  trialEndDate?: string; // "YYYY-MM-DD" or ""
  ghlLocationId?: string;
  ghlApiKey?: string;
  adminNotes?: string;
  sendWelcomeEmail: boolean;
}

export type CreateAgencyResult =
  | { success: true; agencyId: string }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function generateTempPassword(): string {
  return randomBytes(18).toString("base64url");
}

export async function adminCreateAgency(
  input: CreateAgencyInput
): Promise<CreateAgencyResult> {
  if (!(await isAdmin())) return { success: false, error: "Forbidden." };

  const name = input.name.trim();
  const ownerName = input.ownerName.trim();
  const ownerEmail = input.ownerEmail.trim().toLowerCase();

  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = "Agency name is required.";
  if (!ownerName) fieldErrors.ownerName = "Owner name is required.";
  if (!ownerEmail) fieldErrors.ownerEmail = "Owner email is required.";
  else if (!isValidEmail(ownerEmail)) fieldErrors.ownerEmail = "Enter a valid email.";
  if (Object.keys(fieldErrors).length > 0) {
    return { success: false, error: "Fix the highlighted fields.", fieldErrors };
  }

  const admin = createAdminClient();

  // Create (or recover) the Supabase Auth user — same pattern as agency signup.
  let userId: string;
  const tempPassword = generateTempPassword();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: ownerEmail,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { name: ownerName },
  });

  if (created?.user) {
    userId = created.user.id;
  } else if (createError && /already.*(registered|exists)|email.*exists/i.test(createError.message)) {
    let existing: { id: string } | null = null;
    for (let page = 1; page <= 5; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error || !data) break;
      const match = data.users.find((u) => u.email?.toLowerCase() === ownerEmail);
      if (match) {
        existing = { id: match.id };
        break;
      }
      if (data.users.length < 200) break;
    }
    if (!existing) {
      return { success: false, error: "This email is already registered but could not be found." };
    }
    userId = existing.id;
  } else {
    return { success: false, error: createError?.message ?? "Could not create the owner's account." };
  }

  const maxClients =
    input.maxClients !== undefined && Number.isFinite(input.maxClients) && input.maxClients >= 0
      ? Math.round(input.maxClients)
      : maxClientsForPlan(input.plan);

  const { data: agency, error: agencyError } = await admin
    .from("agencies")
    .insert({
      name,
      owner_name: ownerName,
      owner_email: ownerEmail,
      owner_user_id: userId,
      phone: input.phone?.trim() || null,
      plan: input.plan,
      plan_status: input.status,
      max_clients: maxClients,
      trial_ends_at: input.trialEndDate ? new Date(input.trialEndDate).toISOString() : null,
      ghl_location_id: input.ghlLocationId?.trim() || null,
      ghl_api_key: input.ghlApiKey?.trim() || null,
      settings: input.adminNotes?.trim() ? { admin_notes: input.adminNotes.trim() } : {},
    })
    .select("id")
    .single();

  if (agencyError || !agency) {
    return { success: false, error: agencyError?.message ?? "Could not create the agency." };
  }

  const { error: memberError } = await admin.from("team_members").insert({
    agency_id: agency.id,
    user_id: userId,
    name: ownerName,
    email: ownerEmail,
    role: "owner",
  });
  if (memberError) {
    return { success: false, error: `Agency created but owner could not be linked: ${memberError.message}` };
  }

  const actor = await getAdminEmail();
  await admin.from("activity_log").insert({
    agency_id: agency.id,
    actor_type: "system",
    actor_id: actor,
    action: "Agency created manually by super-admin",
    description: `${name} (${ownerEmail}) — plan ${input.plan}/${input.status}.`,
  });

  if (input.sendWelcomeEmail) {
    await sendAgencyWelcomeEmail({ name, owner_name: ownerName, owner_email: ownerEmail });
  }

  return { success: true, agencyId: agency.id };
}
```

- [ ] **Step 5: Verify types and lint**

Run: `npx tsc --noEmit`
Expected: no errors referencing `create-agency-actions.ts`, `welcome-email.ts`, or `resend-welcome/route.ts`.

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/types/index.ts src/lib/admin/welcome-email.ts src/app/api/admin/tools/resend-welcome/route.ts src/app/\(admin\)/admin/agencies/create-agency-actions.ts
git commit -m "feat: add admin create-agency server action + shared welcome-email helper"
```

---

### Task 2: Create Agency modal UI

**Files:**
- Create: `src/app/(admin)/admin/agencies/create-agency-modal.tsx`

**Interfaces:**
- Consumes: `adminCreateAgency`, `CreateAgencyInput`, `CreateAgencyResult` from `./create-agency-actions` (Task 1); `Modal` from `@/components/ui/modal` (`{ open, onClose, title, description, children, footer, size }`); `useToast` from `@/components/ui/toast` (`toast(message, variant?)`); `Plan`/`PlanStatus` from `@/types`; `maxClientsForPlan` from `@/lib/billing/plans`.
- Produces: `<CreateAgencyButton onCreated={() => void} />` — a self-contained button + modal, default export not needed (named export). `onCreated` is called with the new `agencyId` after success so the parent list can refresh and optionally open the slide-over on the new agency.

- [ ] **Step 1: Build the modal + trigger button**

Create `src/app/(admin)/admin/agencies/create-agency-modal.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils/helpers";
import { maxClientsForPlan } from "@/lib/billing/plans";
import { adminCreateAgency } from "./create-agency-actions";
import type { Plan, PlanStatus } from "@/types";

const PLANS: { id: Plan; label: string }[] = [
  { id: "solo", label: "Starter" },
  { id: "pro", label: "Pro" },
  { id: "agency", label: "Agency" },
  { id: "enterprise", label: "Enterprise" },
];
const STATUSES: PlanStatus[] = ["active", "trialing", "past_due", "paused", "cancelled"];

const field =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const label = "block text-xs font-medium text-gray-600 mb-1";

export function CreateAgencyButton({ onCreated }: { onCreated?: (agencyId: string) => void }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const [pending, start] = useTransition();

  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [plan, setPlan] = useState<Plan>("solo");
  const [status, setStatus] = useState<PlanStatus>("trialing");
  const [maxClients, setMaxClients] = useState(String(maxClientsForPlan("solo")));
  const [trialEnd, setTrialEnd] = useState("");
  const [ghlLocationId, setGhlLocationId] = useState("");
  const [ghlApiKey, setGhlApiKey] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function reset() {
    setName("");
    setOwnerName("");
    setOwnerEmail("");
    setPhone("");
    setPlan("solo");
    setStatus("trialing");
    setMaxClients(String(maxClientsForPlan("solo")));
    setTrialEnd("");
    setGhlLocationId("");
    setGhlApiKey("");
    setAdminNotes("");
    setSendWelcomeEmail(true);
    setFieldErrors({});
  }

  function submit() {
    start(async () => {
      const res = await adminCreateAgency({
        name,
        ownerName,
        ownerEmail,
        phone: phone || undefined,
        plan,
        status,
        maxClients: Number(maxClients),
        trialEndDate: trialEnd || undefined,
        ghlLocationId: ghlLocationId || undefined,
        ghlApiKey: ghlApiKey || undefined,
        adminNotes: adminNotes || undefined,
        sendWelcomeEmail,
      });
      if (res.success) {
        toast(`${name} created.`, "success");
        setOpen(false);
        reset();
        onCreated?.(res.agencyId);
      } else {
        setFieldErrors(res.fieldErrors ?? {});
        toast(res.error, "error");
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
      >
        <Plus className="h-4 w-4" />
        Create Agency
      </button>

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          reset();
        }}
        title="Create New Agency"
        description="Admin-created agencies bypass Stripe checkout — set plan and status directly."
        size="lg"
        footer={
          <>
            <button
              onClick={() => setOpen(false)}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              disabled={pending}
              onClick={submit}
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {pending ? "Creating…" : "Create Agency"}
            </button>
          </>
        }
      >
        <div className="space-y-5">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Agency Information
            </h4>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={label}>Agency Name *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className={field} />
                {fieldErrors.name && <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>}
              </div>
              <div>
                <label className={label}>Owner Full Name *</label>
                <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} className={field} />
                {fieldErrors.ownerName && <p className="mt-1 text-xs text-red-600">{fieldErrors.ownerName}</p>}
              </div>
              <div>
                <label className={label}>Owner Email *</label>
                <input
                  type="email"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  className={field}
                />
                {fieldErrors.ownerEmail && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.ownerEmail}</p>
                )}
              </div>
              <div className="col-span-2">
                <label className={label}>Phone</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className={field} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Plan *</label>
              <select
                value={plan}
                onChange={(e) => {
                  const next = e.target.value as Plan;
                  setPlan(next);
                  setMaxClients(String(maxClientsForPlan(next)));
                }}
                className={field}
              >
                {PLANS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Status *</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as PlanStatus)} className={cn(field, "capitalize")}>
                {STATUSES.map((s) => (
                  <option key={s} value={s} className="capitalize">
                    {s.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Max Clients</label>
              <input
                type="number"
                min={0}
                value={maxClients}
                onChange={(e) => setMaxClients(e.target.value)}
                className={field}
              />
            </div>
            <div>
              <label className={label}>Trial End Date</label>
              <input type="date" value={trialEnd} onChange={(e) => setTrialEnd(e.target.value)} className={field} />
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              GHL Configuration (optional — can set later)
            </h4>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <label className={label}>GHL Location ID</label>
                <input value={ghlLocationId} onChange={(e) => setGhlLocationId(e.target.value)} className={field} />
              </div>
              <div>
                <label className={label}>GHL API Key (PIT)</label>
                <input value={ghlApiKey} onChange={(e) => setGhlApiKey(e.target.value)} className={field} />
              </div>
            </div>
          </div>

          <div>
            <label className={label}>Admin Notes</label>
            <textarea
              rows={2}
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              className={cn(field, "resize-none")}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={sendWelcomeEmail}
              onChange={(e) => setSendWelcomeEmail(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Send welcome email to owner
          </label>
        </div>
      </Modal>
    </>
  );
}
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors in `create-agency-modal.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(admin\)/admin/agencies/create-agency-modal.tsx
git commit -m "feat: add Create Agency modal UI"
```

---

### Task 3: Consolidate `/admin/agencies` onto the slide-over pattern

**Files:**
- Create: `src/app/(admin)/admin/agencies/agencies-table.tsx`
- Modify: `src/app/(admin)/admin/agencies/page.tsx`
- Modify: `src/app/(admin)/admin/payments/page.tsx:99` (change the agency link)
- Modify: `src/app/(admin)/admin/clients/page.tsx:111` (change the agency link)

**Interfaces:**
- Consumes: `AgencySlideover` from `@/components/admin/agency-slideover` (`{ agencyId, onClose, onChange }`); `CreateAgencyButton` from `./create-agency-modal` (Task 2); `AgencyRow` shape (id, name, owner_name, owner_email, plan, plan_status, trial_ends_at, created_at) as already defined inline in `page.tsx`.
- Produces: `<AgenciesTable agencies={AgencyRow[]} clientCounts={Record<string, number>} initialOpenId={string | null} />` — row click opens the slide-over; deep-linkable via `?open=<agencyId>`.

- [ ] **Step 1: Create the client table component**

Create `src/app/(admin)/admin/agencies/agencies-table.tsx` (this is the existing table body from `page.tsx`, moved to a client component with row-click instead of `<Link>`, plus the slide-over):

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn, formatDate, getStatusColor } from "@/lib/utils/helpers";
import { AgencySlideover } from "@/components/admin/agency-slideover";
import type { Plan, PlanStatus } from "@/types";

export interface AgencyRow {
  id: string;
  name: string;
  owner_name: string;
  owner_email: string;
  plan: Plan;
  plan_status: PlanStatus;
  trial_ends_at: string | null;
  created_at: string;
}

export function AgenciesTable({
  agencies,
  clientCounts,
  initialOpenId,
}: {
  agencies: AgencyRow[];
  clientCounts: Record<string, number>;
  initialOpenId: string | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(initialOpenId);

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-5 py-3 font-medium">Agency</th>
              <th className="px-5 py-3 font-medium">Owner email</th>
              <th className="px-5 py-3 font-medium">Plan</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Clients</th>
              <th className="px-5 py-3 font-medium">Trial ends</th>
              <th className="px-5 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {agencies.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-gray-500">
                  No agencies found.
                </td>
              </tr>
            ) : (
              agencies.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => setSelected(a.id)}
                  className="cursor-pointer hover:bg-gray-50"
                >
                  <td className="px-5 py-3">
                    <span className="font-medium text-gray-900">{a.name}</span>
                    <div className="text-xs text-gray-500">{a.owner_name}</div>
                  </td>
                  <td className="px-5 py-3 text-gray-600">{a.owner_email}</td>
                  <td className="px-5 py-3 capitalize text-gray-600">{a.plan}</td>
                  <td className="px-5 py-3">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                        getStatusColor(a.plan_status)
                      )}
                    >
                      {a.plan_status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-600">{clientCounts[a.id] ?? 0}</td>
                  <td className="px-5 py-3 text-gray-500">
                    {a.trial_ends_at ? formatDate(a.trial_ends_at) : "—"}
                  </td>
                  <td className="px-5 py-3 text-gray-500">{formatDate(a.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AgencySlideover
        agencyId={selected}
        onClose={() => setSelected(null)}
        onChange={() => router.refresh()}
      />
    </>
  );
}
```

- [ ] **Step 2: Update the page to use it + wire Create Agency**

Replace the full contents of `src/app/(admin)/admin/agencies/page.tsx`:

```tsx
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardHeader } from "@/components/ui/card";
import { Search } from "lucide-react";
import { AgenciesTable, type AgencyRow } from "./agencies-table";
import { CreateAgencyButton } from "./create-agency-modal";

export const dynamic = "force-dynamic";

export default async function AdminAgenciesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; open?: string }>;
}) {
  const { q, open } = await searchParams;
  const query = (q ?? "").trim();

  const admin = createAdminClient();
  let builder = admin
    .from("agencies")
    .select(
      "id, name, owner_name, owner_email, plan, plan_status, trial_ends_at, created_at"
    )
    .order("created_at", { ascending: false });
  if (query) {
    builder = builder.or(`name.ilike.%${query}%,owner_email.ilike.%${query}%`);
  }
  const { data } = await builder;
  const agencies = (data ?? []) as AgencyRow[];

  // Client counts per agency (single pass).
  const { data: clientRows } = await admin.from("clients").select("agency_id");
  const clientCounts: Record<string, number> = {};
  for (const row of clientRows ?? []) {
    clientCounts[row.agency_id] = (clientCounts[row.agency_id] ?? 0) + 1;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Agencies"
          description={`${agencies.length} ${query ? "matching" : "total"}`}
          action={
            <div className="flex items-center gap-3">
              <form method="GET" className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  name="q"
                  defaultValue={query}
                  placeholder="Search name or email…"
                  className="w-56 rounded-md border border-gray-300 py-1.5 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </form>
              <CreateAgencyButton />
            </div>
          }
        />
        <AgenciesTable agencies={agencies} clientCounts={clientCounts} initialOpenId={open ?? null} />
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Repoint the two other pages that linked to the old full-page route**

In `src/app/(admin)/admin/payments/page.tsx`, change line 99:

```tsx
<Link href={`/admin/agencies/${a.id}`} className="hover:text-blue-600">
```
to:
```tsx
<Link href={`/admin/agencies?open=${a.id}`} className="hover:text-blue-600">
```

In `src/app/(admin)/admin/clients/page.tsx`, change line 111:

```tsx
href={`/admin/agencies/${c.agency_id}`}
```
to:
```tsx
href={`/admin/agencies?open=${c.agency_id}`}
```

- [ ] **Step 4: Verify types and build**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds; no more references to the deleted-in-Task-5 route yet (it still exists at this point, so this should already pass cleanly).

- [ ] **Step 5: Manual check**

Run: `npm run dev`, visit `/admin/agencies`, click a row → slide-over opens with Status/GHL Config/Tools/Branding/Payments tabs. Click "+ Create Agency" → modal opens. Visit `/admin/agencies?open=<a-real-agency-id>` directly → slide-over auto-opens on load.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(admin\)/admin/agencies/agencies-table.tsx src/app/\(admin\)/admin/agencies/page.tsx src/app/\(admin\)/admin/payments/page.tsx src/app/\(admin\)/admin/clients/page.tsx
git commit -m "refactor: consolidate agency detail onto the slide-over, deep-linkable via ?open="
```

---

### Task 4: Danger Zone (delete agency) in the slide-over

**Files:**
- Modify: `src/app/(admin)/admin/agency-panel-actions.ts` (add `deleteAgencyAdmin`)
- Modify: `src/components/admin/agency-slideover.tsx` (add Danger Zone to `StatusTab`, thread `onClose`/`onDeleted`)

**Interfaces:**
- Produces: `deleteAgencyAdmin(agencyId: string, confirmName: string): Promise<{ success: boolean; error?: string }>`
- Consumes: existing `guard()`/`createAdminClient` helpers already in `agency-panel-actions.ts`.

- [ ] **Step 1: Add the delete action**

In `src/app/(admin)/admin/agency-panel-actions.ts`, add at the end of the file:

```ts
// ── Danger zone ──────────────────────────────────────────────────────────────

export async function deleteAgencyAdmin(
  agencyId: string,
  confirmName: string
): Promise<Result> {
  if (!(await guard())) return { success: false, error: "Forbidden." };

  const admin = createAdminClient();
  const { data } = await admin.from("agencies").select("name").eq("id", agencyId).single();
  if (!data) return { success: false, error: "Agency not found." };
  if (confirmName.trim() !== data.name) {
    return { success: false, error: "Name did not match. Deletion cancelled." };
  }

  const { error } = await admin.from("agencies").delete().eq("id", agencyId);
  if (error) return { success: false, error: error.message };

  revalidatePath("/admin");
  revalidatePath("/admin/agencies");
  revalidatePath("/admin/pending");
  revalidatePath("/admin/payments");
  revalidatePath("/admin/clients");
  return { success: true };
}
```

- [ ] **Step 2: Add the Danger Zone UI to `StatusTab`**

In `src/components/admin/agency-slideover.tsx`:

1. Add `deleteAgencyAdmin` to the import from `./agency-panel-actions`:

```tsx
import {
  saveAgencyStatus,
  extendTrial14,
  saveGhlConfig,
  testConnection,
  saveBranding,
  recordAgencyPayment,
  deleteAgencyAdmin,
} from "@/app/(admin)/admin/agency-panel-actions";
```

2. Pass `onClose` down into `StatusTab` where it's rendered (around line 199-201):

```tsx
{tab === "Status" && (
  <StatusTab
    key={agency.id}
    data={current!}
    pending={pending}
    run={run}
    onExtend={() => run(() => extendTrial14(agency.id), "Trial extended 14 days.")}
    onDeleted={() => {
      onClose();
      onChange?.();
    }}
  />
)}
```

3. Update `StatusTab`'s props and body to add the Danger Zone section (add `onDeleted` to the prop type, add local state, add the section after the existing "Signup info" `<div>`):

```tsx
function StatusTab({
  data,
  pending,
  run,
  onExtend,
  onDeleted,
}: {
  data: AgencyPanelData;
  pending: boolean;
  run: (fn: () => Promise<{ success: boolean; error?: string }>, ok: string) => void;
  onExtend: () => void;
  onDeleted: () => void;
}) {
  const a = data.agency;
  const { toast } = useToast();
  const [plan, setPlan] = useState<Plan>(a.plan);
  const [status, setStatus] = useState<PlanStatus>(a.plan_status);
  const [maxClients, setMaxClients] = useState(String(a.max_clients));
  const [trialEnd, setTrialEnd] = useState(a.trial_ends_at ? a.trial_ends_at.slice(0, 10) : "");
  const [notes, setNotes] = useState(a.settings?.admin_notes ?? "");
  const [confirmName, setConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const res = await deleteAgencyAdmin(a.id, confirmName);
    setDeleting(false);
    if (res.success) {
      toast("Agency deleted.", "success");
      onDeleted();
    } else {
      toast(res.error ?? "Something went wrong.", "error");
    }
  }
```

(Note: `useToast` must be imported in this file already — it is, at line 5 — so `StatusTab` just needs its own `const { toast } = useToast();` call since it's a separate function component from the one holding the outer `toast` reference.)

4. Add the Danger Zone JSX immediately after the existing "Signup info" `<div className="rounded-lg border border-gray-200 bg-gray-50 p-4">…</div>` block, still inside `StatusTab`'s returned `<div className="space-y-5">`:

```tsx
      <div className="rounded-lg border border-red-200 bg-red-50/50 p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-red-700">
          Danger Zone
        </h4>
        <p className="mt-1 text-sm text-red-600">
          Permanently delete this agency and all of its clients, rounds, letters, and
          documents. Type <span className="font-semibold">{a.name}</span> to confirm.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder="Type agency name…"
            className={cn(field, "max-w-[220px] border-red-300")}
          />
          <button
            disabled={deleting || confirmName.trim() !== a.name}
            onClick={handleDelete}
            className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete Agency"}
          </button>
        </div>
      </div>
```

5. Simplify the notes-cast now that `AgencySettings.admin_notes` is typed (Task 1, Step 1) — the `useState` initializer for `notes` above already reads `a.settings?.admin_notes ?? ""` directly instead of the old unsafe cast; and in the "Save Changes" handler further down, `adminNotes: notes` stays as-is (no change needed there).

- [ ] **Step 3: Verify types and build**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual check**

Run `npm run dev`, open an agency's slide-over → Status tab → confirm the Danger Zone appears, delete is disabled until the typed name matches, and deleting closes the drawer and removes the row from the list without a full page reload.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(admin\)/admin/agency-panel-actions.ts src/components/admin/agency-slideover.tsx
git commit -m "feat: add Danger Zone delete-agency flow to the agency slide-over"
```

---

### Task 5: Delete the old full-page agency detail route

**Files:**
- Delete: `src/app/(admin)/admin/agencies/[id]/page.tsx`
- Delete: `src/app/(admin)/admin/agencies/[id]/agency-controls.tsx`
- Delete: `src/app/(admin)/admin/agencies/[id]/actions.ts`

**Interfaces:** None — this route is fully superseded by Task 3/4. Confirmed via repo-wide grep that no other file imports from `./agencies/[id]/actions` or `agency-controls`, and the only remaining `href`/`Link` references to `/admin/agencies/${id}` were already repointed to `/admin/agencies?open=${id}` in Task 3.

- [ ] **Step 1: Delete the old route folder**

```bash
rm -rf "src/app/(admin)/admin/agencies/[id]"
```

- [ ] **Step 2: Grep to confirm nothing else references the deleted files**

Run: `grep -rn "agencies/\[id\]/actions\|from \"\./agency-controls\"" src`
Expected: no matches.

Run: `grep -rn "admin/agencies/\${" src`
Expected: only the `?open=` links from Task 3 (no bare `/admin/agencies/${id}` links remaining).

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds — confirms Next.js's route tree no longer references the deleted dynamic segment and nothing else imports it.

- [ ] **Step 4: Manual check**

Run `npm run dev`, visit the now-removed `/admin/agencies/<any-id>` URL directly → should 404 (expected, since the route is gone and all in-app links now use `?open=`).

- [ ] **Step 5: Commit**

```bash
git add -A "src/app/(admin)/admin/agencies/[id]"
git commit -m "chore: remove old full-page agency detail route, superseded by the slide-over"
```

---

## Self-Review Notes

- **Spec coverage:** Task 1's spec (Create Agency form + `adminCreateAgency`) → Tasks 1-2. Task 2's spec (slide-over consolidation, Tools/Branding/Payments/GHL Config tabs, Danger Zone) → Tasks 3-5; the GHL Config/Tools/Branding/Payments tabs already exist in `agency-slideover.tsx` today and needed no changes — only Status tab (Danger Zone) and the list page did.
- **Reconciled spec/code mismatch:** the original spec assumed agency detail was still a separate page needing conversion "to" a slide-out; research showed the slide-over already existed but was only reachable from the dashboard — so the real work is deleting the duplicate old page and wiring every remaining entry point to the slide-over, which is what Tasks 3-5 do.
- **Type consistency:** `deleteAgencyAdmin(agencyId, confirmName)` signature matches its call site in Task 4 Step 2; `CreateAgencyResult`/`CreateAgencyInput` match between Task 1's action and Task 2's modal caller.
