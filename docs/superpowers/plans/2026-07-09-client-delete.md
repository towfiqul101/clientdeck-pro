# Client Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a permanent, owner/admin-only "Delete client" action to the client detail page that removes the client, its cascaded data, and its stored files.

**Architecture:** A server action (`deleteClient`) does a role check, an RLS-scoped delete (DB cascade handles child rows), and a best-effort Supabase Storage cleanup. A client component (`DeleteClientButton`) renders a type-to-confirm modal in the client detail header, shown only to owner/admin.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase (RLS + service role), existing `Button`/`Modal`/`useToast` UI primitives, Lucide icons.

## Global Constraints

- Hard delete only — no archive/soft-delete/restore.
- Permissions: only `session.teamMember.role === "owner" || "admin"` may delete. Staff/viewer: button hidden AND server action rejects.
- Entry point: client **detail page header only**. Not the client list.
- Leave the GoHighLevel contact and Google Drive files untouched.
- No DB migration (RLS delete policy + cascades already exist).
- Verification in this repo is `npx tsc --noEmit` + `npm run build` (there is no test runner) plus a manual smoke test. Deploy is `git push origin master:main` (do NOT push until the user asks).
- Spec: `docs/superpowers/specs/2026-07-09-client-delete-design.md`.

---

### Task 1: `deleteClient` server action

**Files:**
- Modify: `src/app/(dashboard)/clients/actions.ts` (add import + new exported action at end of file)

**Interfaces:**
- Consumes: `getSessionContext()` from `@/lib/auth/session` (provides `userId`, `teamMember.role`, `agency.id`); `createServerSupabaseClient()` from `@/lib/supabase/server`; `createAdminClient()` from `@/lib/supabase/admin`; `revalidatePath` from `next/cache`.
- Produces: `deleteClient(clientId: string, confirmName: string): Promise<{ success: boolean; error?: string }>` — consumed by `DeleteClientButton` in Task 2.

- [ ] **Step 1: Add the `createAdminClient` import**

At the top of `src/app/(dashboard)/clients/actions.ts`, the file already imports `createServerSupabaseClient` and `getSessionContext`. Add this import beneath the existing supabase import:

```ts
import { createAdminClient } from "@/lib/supabase/admin";
```

- [ ] **Step 2: Append the `deleteClient` action to the end of the file**

Add at the end of `src/app/(dashboard)/clients/actions.ts`:

```ts
/**
 * Permanently deletes a client and all cascaded data (items, rounds, disputes,
 * documents rows, score history, credit-monitoring pulls). Owner/admin only.
 * Requires the caller to re-type the client's full name. Best-effort removal of
 * the client's Supabase Storage files so no orphaned PII is left behind. Leaves
 * the GHL contact and Google Drive files untouched.
 */
export async function deleteClient(
  clientId: string,
  confirmName: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  if (session.teamMember.role !== "owner" && session.teamMember.role !== "admin") {
    return { success: false, error: "Only owners and admins can delete clients." };
  }

  const supabase = await createServerSupabaseClient();

  // RLS scopes this to the caller's agency.
  const { data: client } = await supabase
    .from("clients")
    .select("id, first_name, last_name")
    .eq("id", clientId)
    .single();
  if (!client) return { success: false, error: "Client not found." };

  const fullName = `${client.first_name} ${client.last_name}`;
  if (confirmName.trim() !== fullName) {
    return { success: false, error: "Name did not match. Deletion cancelled." };
  }

  // Collect storage paths BEFORE deleting (the documents rows cascade away).
  const { data: docs } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("client_id", clientId);
  const storagePaths = (docs ?? [])
    .map((d) => d.storage_path)
    .filter((p): p is string => Boolean(p));

  // Delete the client (RLS-scoped). DB cascade removes all child rows.
  const { error: deleteError } = await supabase
    .from("clients")
    .delete()
    .eq("id", clientId);
  if (deleteError) return { success: false, error: deleteError.message };

  // Best-effort: remove the client's files from the private `documents` bucket.
  // Storage deletes go through the service role in this codebase. Never surface
  // a storage failure — the client is already gone.
  if (storagePaths.length > 0) {
    try {
      const admin = createAdminClient();
      await admin.storage.from("documents").remove(storagePaths);
    } catch (e) {
      console.error("[deleteClient] Storage cleanup failed:", e);
    }
  }

  // Audit entry (client_id null — the row no longer exists).
  await supabase.from("activity_log").insert({
    agency_id: session.agency.id,
    client_id: null,
    actor_type: "staff",
    actor_id: session.userId,
    action: "Client deleted",
    description: `Client deleted: ${fullName}`,
  });

  revalidatePath("/clients");
  return { success: true };
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no output (exit 0). If `session.teamMember.role` errors, confirm `TeamMember.role` exists in `src/types/index.ts` (it does — `role: TeamRole`).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/clients/actions.ts"
git commit -m "feat: deleteClient server action (owner/admin, cascade + storage cleanup)"
```

---

### Task 2: `DeleteClientButton` + wire into the detail header

**Files:**
- Create: `src/app/(dashboard)/clients/[id]/delete-client-button.tsx`
- Modify: `src/app/(dashboard)/clients/[id]/client-header.tsx` (import, prop, render)
- Modify: `src/app/(dashboard)/clients/[id]/layout.tsx` (pass `canDelete`)

**Interfaces:**
- Consumes: `deleteClient` from `../actions` (Task 1); `Button` from `@/components/ui/button`; `Modal` from `@/components/ui/modal`; `useToast` from `@/components/ui/toast`; `useRouter` from `next/navigation`; `Trash2` from `lucide-react`.
- Produces: `DeleteClientButton({ clientId: string; clientName: string })`; a new `canDelete: boolean` prop on `ClientHeader`.

- [ ] **Step 1: Create the button + modal component**

Create `src/app/(dashboard)/clients/[id]/delete-client-button.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { deleteClient } from "../actions";

/**
 * Owner/admin-only permanent delete. Requires typing the client's full name to
 * confirm (mirrors the admin agency "Danger Zone"). On success, redirects to
 * the client list.
 */
export function DeleteClientButton({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const matches = confirmText.trim() === clientName;

  function handleClose() {
    if (deleting) return;
    setOpen(false);
    setConfirmText("");
  }

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteClient(clientId, confirmText);
    if (result.success) {
      toast("Client deleted.", "success");
      router.push("/clients");
      return;
    }
    setDeleting(false);
    toast(result.error ?? "Could not delete client.", "error");
  }

  return (
    <>
      <Button type="button" variant="danger" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4" />
        Delete
      </Button>
      <Modal
        open={open}
        onClose={handleClose}
        title="Delete client"
        size="md"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={handleClose} disabled={deleting}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleDelete}
              loading={deleting}
              disabled={!matches || deleting}
            >
              Delete permanently
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-sm">
          <p style={{ color: "var(--overlay-text)" }}>
            This permanently removes <span className="font-semibold">{clientName}</span> and
            all of their negative items, dispute rounds, letters, documents, and score
            history. <span className="font-semibold">This cannot be undone.</span>
          </p>
          <p style={{ color: "var(--overlay-text-muted)" }}>
            Your GoHighLevel contact and Google Drive files are not affected.
          </p>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--overlay-text-muted)" }}>
              Type <span className="font-semibold">{clientName}</span> to confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={clientName}
              autoFocus
              className="w-full rounded-md border border-red-500/40 bg-white/[0.03] px-3 py-2 text-sm text-slate-100 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
```

- [ ] **Step 2: Add a `canDelete` prop to `ClientHeader` and render the button**

In `src/app/(dashboard)/clients/[id]/client-header.tsx`:

Add the import near the other action-component imports (after the `ForceSyncButton` import):

```tsx
import { DeleteClientButton } from "./delete-client-button";
```

Change the `ClientHeader` signature to accept `canDelete`:

```tsx
export function ClientHeader({
  client,
  members,
  showCreditMonitoring,
  canDelete,
}: {
  client: Client;
  members: { id: string; name: string }[];
  showCreditMonitoring: boolean;
  canDelete: boolean;
}) {
```

In the header action row, immediately after the `{client.ghl_contact_id && <ForceSyncButton clientId={client.id} />}` line, add:

```tsx
          {canDelete && (
            <DeleteClientButton
              clientId={client.id}
              clientName={`${client.first_name} ${client.last_name}`}
            />
          )}
```

- [ ] **Step 3: Pass `canDelete` from the layout**

In `src/app/(dashboard)/clients/[id]/layout.tsx`, update the `<ClientHeader ... />` render to add the prop:

```tsx
      <ClientHeader
        client={client}
        members={members}
        showCreditMonitoring={session ? isAgencyPlanOrHigher(session.agency.plan) : false}
        canDelete={
          session
            ? session.teamMember.role === "owner" || session.teamMember.role === "admin"
            : false
        }
      />
```

- [ ] **Step 4: Type-check and build**

Run: `npx tsc --noEmit`
Expected: no output (exit 0).

Run: `npm run build`
Expected: `✓ Compiled successfully`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/clients/[id]/delete-client-button.tsx" "src/app/(dashboard)/clients/[id]/client-header.tsx" "src/app/(dashboard)/clients/[id]/layout.tsx"
git commit -m "feat: client delete button + confirm modal on detail header (owner/admin only)"
```

---

### Task 3: Manual smoke test

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Launch the app**

Use the `verify` (or `run`) skill to start the dev server and sign in as an **owner or admin**. If unsure how, run `npm run dev` and open the app.

- [ ] **Step 2: Verify the happy path**

1. Open a test client's detail page. Confirm a red **Delete** button shows in the header action row.
2. Click it. Confirm the modal lists what will be removed and states GHL/Drive are unaffected.
3. Confirm "Delete permanently" is disabled until you type the exact full name.
4. Type the full name, click delete. Expect a "Client deleted." toast and redirect to `/clients` with the client absent from the list.

- [ ] **Step 3: Verify cascade + storage (optional, via Supabase)**

In the Supabase SQL editor, confirm the deleted client's rows are gone from `clients`, `negative_items`, `dispute_rounds`, `disputes`, `documents`, `score_history`, `credit_monitoring_pulls`, and that `activity_log` has a `Client deleted: <name>` row with `client_id` null. Confirm the client's files are gone from the `documents` Storage bucket.

- [ ] **Step 4: Verify permission gating**

Sign in as a **staff** or **viewer** user (or temporarily set your `team_members.role`), open a client, and confirm the Delete button is **not** rendered.

- [ ] **Step 5: Confirm with the user**

Report results. Do not `git push origin master:main` until the user asks to deploy.

---

## Self-Review

- **Spec coverage:** Hard delete ✓ (Task 1), owner/admin gating ✓ (Task 1 server + Task 2 UI), detail-page-only entry ✓ (Task 2), type-to-confirm ✓ (Task 2), cascade relies on existing FKs ✓ (no migration), storage cleanup ✓ (Task 1), GHL/Drive untouched ✓ (nothing touches them), audit log ✓ (Task 1), redirect ✓ (Task 2), no migration ✓.
- **Placeholder scan:** none — all code is concrete.
- **Type consistency:** `deleteClient(clientId, confirmName)` signature identical in Task 1 (definition) and Task 2 (call). `canDelete` prop name consistent across `ClientHeader` definition and `layout.tsx` call. `DeleteClientButton` props (`clientId`, `clientName`) consistent between component and call site.
```
