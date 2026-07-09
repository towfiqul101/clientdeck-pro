# Client Delete — Design

**Date:** 2026-07-09
**Status:** Approved (pending spec review)
**Feature:** Permanent hard-delete of a client from the ClientDeck Pro dashboard.

## Goal

Give agency staff a way to permanently remove a client and all of its associated
data from the ClientDeck Pro dashboard.

## Decisions (confirmed with user)

- **Semantics:** Hard delete only. Permanent, irreversible. No archive/soft-delete.
- **Permissions:** Owner and admin roles only. Staff and viewer cannot delete.
- **Entry point:** Client **detail page only** (not the client list).
- **External systems:** The GoHighLevel contact and any Google Drive backup folder
  are **left untouched** — they belong to the agency's own CRM/Drive, and deleting an
  app client must not mutate them.

## What gets deleted

Deleting a client removes:

- The `clients` row.
- Via existing `ON DELETE CASCADE` on `client_id`:
  `negative_items`, `dispute_rounds`, `disputes`, `documents` (rows),
  `score_history`, `credit_monitoring_pulls`.
- The client's uploaded files in the Supabase Storage `documents` bucket
  (IDs, credit reports, proof of address, letters) — explicitly removed so no
  orphaned PII remains in storage after the DB rows cascade away.

## What is preserved

- `activity_log` and `ghl_sync_log` rows: their `client_id` is `ON DELETE SET NULL`,
  so the audit trail survives the deletion (rows remain, client link nulled).
- A new agency-level `activity_log` entry recording the deletion (see below).
- The GoHighLevel contact (untouched).
- The Google Drive backup folder/files (untouched).

## No migration required

- RLS already permits an agency to delete its own clients:
  `CREATE POLICY "Agency deletes own clients" ON clients FOR DELETE USING (agency_id = get_user_agency_id())`
  (migration 002).
- All cascades already exist (migration 001 + later). No schema change.
- Role gating (owner/admin only) is enforced in the server action + UI, not RLS —
  RLS is agency-scoped, not role-scoped.

## Components

### 1. Server action — `deleteClient(clientId, confirmName)`

Location: `src/app/(dashboard)/clients/actions.ts` (alongside `createClient` / `updateClient`).

Signature:
```ts
export async function deleteClient(
  clientId: string,
  confirmName: string
): Promise<{ success: boolean; error?: string }>
```

Behavior (in order):
1. `getSessionContext()`; if none → `{ success: false, error: "Not authenticated." }`.
2. Enforce role: if `session.teamMember.role` is not `"owner"` or `"admin"` →
   `{ success: false, error: "Only owners and admins can delete clients." }`.
3. Load the client via the **RLS-scoped server client** (`createServerSupabaseClient()`),
   selecting `id, first_name, last_name`. RLS guarantees it belongs to the caller's
   agency. If not found → `{ success: false, error: "Client not found." }`.
4. Verify `confirmName.trim() === "First Last"` (the client's full name). If it does
   not match → `{ success: false, error: "Name did not match. Deletion cancelled." }`.
5. Collect storage paths: `select storage_path from documents where client_id = clientId`.
6. Delete the client row via the RLS-scoped client:
   `supabase.from("clients").delete().eq("id", clientId)`. The DB cascade removes all
   child rows. On error → return the error message.
7. Best-effort remove storage files: if any paths were collected, call
   `admin.storage.from("documents").remove(paths)` (service-role admin client, matching
   the existing upload/delete pattern in `clients/[id]/documents/actions.ts`). Swallow
   storage errors (log only) — the client is already gone; an orphaned file must not
   surface as a user-facing failure.
8. Insert an agency-level `activity_log` entry:
   `{ agency_id, client_id: null, actor_type: "staff", actor_id: session.userId,
      action: "Client deleted", description: "Client deleted: First Last" }`.
   (client_id is null because the row no longer exists.)
9. `revalidatePath("/clients")`.
10. Return `{ success: true }`.

Notes:
- The load (step 3), delete (step 6), and `activity_log` insert (step 8) all use the
  **RLS-scoped** `createServerSupabaseClient()` — matching `createClient`/`updateClient`
  — so agency isolation is enforced by the database, not just app code.
- `createAdminClient()` (service role) is used **only** for `storage.remove()` in
  step 7, because storage deletes in this codebase go through the service role
  (see `clients/[id]/documents/actions.ts`).

### 2. Confirmation modal — `DeleteClientButton` (client component)

Location: `src/app/(dashboard)/clients/[id]/delete-client-button.tsx`.

- Renders a `Button variant="danger"` (or secondary with red styling) labeled
  "Delete client" with a `Trash2` icon.
- Opens a `Modal` (existing `@/components/ui/modal`) titled "Delete client".
- Modal body:
  - Warning copy: this permanently removes the client and all their items, dispute
    rounds, letters, documents, and score history. **Cannot be undone.**
  - Explicit note: "Your GoHighLevel contact and Google Drive files are not affected."
  - A text input: "Type **First Last** to confirm."
  - Red "Delete permanently" button, disabled until the typed value matches the
    client's full name; shows a loading state while pending.
  - "Cancel" button.
- On confirm: calls `deleteClient(clientId, typedName)`.
  - Success → toast "Client deleted." and `router.push("/clients")`.
  - Failure → toast the error; keep the modal open.

Mirrors the existing type-to-confirm pattern in the admin agency "Danger Zone"
(`agency-slideover.tsx` → `StatusTab` delete).

### 3. Wiring into the client detail header

Location: `src/app/(dashboard)/clients/[id]/client-header.tsx`.

- Add a `canDelete` boolean prop (true when `role ∈ {owner, admin}`), resolved on the
  server in the detail page/layout from `session.teamMember.role` and passed down.
- When `canDelete`, render `<DeleteClientButton clientId={client.id}
  clientName={`${client.first_name} ${client.last_name}`} />` in the header action row
  (grouped with Edit / Start New Round). Hidden entirely for staff/viewer.

## Data flow

```
Detail page (server) resolves canDelete from session.teamMember.role
  → ClientHeader (canDelete) → DeleteClientButton
    → user types full name → deleteClient(clientId, name) [server action]
      → role check → RLS-scoped load + name match
      → collect storage paths → RLS delete (DB cascade)
      → best-effort storage.remove() → activity_log → revalidate
    → success → toast + redirect to /clients
```

## Error handling

- Not authenticated / wrong role → friendly message, no deletion.
- Name mismatch → deletion cancelled, modal stays open.
- Client not found (already deleted / not in agency) → friendly message.
- DB delete error → surfaced to the user; nothing partially removed at the app layer
  (the DB delete is atomic; storage removal only runs after a successful row delete).
- Storage removal failure → logged only, not surfaced (client already deleted).

## Testing

- **Permission:** staff/viewer never see the button; `deleteClient` returns "Only
  owners and admins…" if called by a staff/viewer session.
- **Confirmation:** button disabled until the exact full name is typed; mismatch is
  rejected server-side too (defense in depth).
- **Cascade:** after delete, the client and its `negative_items` / `dispute_rounds` /
  `disputes` / `documents` / `score_history` / `credit_monitoring_pulls` rows are gone;
  `activity_log` rows for that client remain with `client_id = null`.
- **Storage:** the client's files no longer exist in the `documents` bucket.
- **External untouched:** GHL contact and Drive folder still exist.
- **Redirect:** deleting from the detail page lands on `/clients` and the client is
  absent from the list.

## Out of scope (YAGNI)

- Archive / soft-delete / restore.
- Bulk delete from the client list.
- Deleting the GHL contact or Drive files.
- Undo / trash / retention window.
```
