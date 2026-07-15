# RoundTrack Pro — CLAUDE.md

## Project Overview
RoundTrack Pro is a B2B SaaS dispute management platform for credit repair agencies. It provides AI-powered letter generation, dispute round tracking, a client portal, and native GoHighLevel (GHL) CRM integration. Built as a white-label multi-tenant system where each agency gets their own branded experience.

**Domain:** roundtrackpro.com
**Tagline:** "The dispute management platform built for GoHighLevel credit repair agencies"
**Short tagline:** "Run every dispute round from one connected platform."
**Positioning:** "Practice management software for credit professionals" — NOT credit repair software (legal distinction).

> **Rename note (2026-07-10):** The product was renamed from **ClientDeck Pro → RoundTrack Pro** (domain `clientdeckpro.com → roundtrackpro.com`).
>
> **Identifier rename (2026-07-14) — CLEAN BREAK, no dual-support.** Every `cdp`
> identifier is now `rtp`. Written with the old prefix spelled out so this note
> survives future find-and-replace:
>
> | Was | Now |
> |---|---|
> | GHL field keys `c`+`dp__*` | `rtp__*` (driven by renaming field NAMES "CDP - …" → "RTP - …") |
> | Notification + inbound tags `c`+`dp-*` | `rtp-*` |
> | Admin cookie `c`+`dp_admin_session` | `rtp_admin_session` |
> | Webhook header `x-clientdeck-secret` | `x-rtp-secret` |
> | localStorage `c`+`dp-theme` / `c`+`dp-rounds-view` | `rtp-theme` / `rtp-rounds-view` |
>
> ⚠️ **This renames nothing inside an agency's GHL account.** It changes what RTP
> writes to and reads from; the old fields and tags still physically exist in GHL
> and are now orphaned. Each agency must, by hand:
> 1. Re-run **Create Custom Fields** — creates the new `RTP - …` fields (38 as of
>    Session 12). It does **not** rename the old ones.
> 2. Repoint every old merge tag in their GHL workflows to `{{contact.rtp__*}}` —
>    otherwise the message renders **blank**.
> 3. Change every workflow **Tag Added** trigger to the `rtp-` tag — otherwise it
>    **silently never fires** (no error, notifications just stop).
> 4. Repoint the onboarding form's field mappings to the new `RTP - …` fields.
>
> Then the old fields/tags/pipeline can be deleted. Exception: `find-pipeline`
> still accepts a legacy `CDP - ` **pipeline** name prefix alongside `RTP - `, so
> stage mapping keeps working until the pipeline itself is renamed.

## Tech Stack
- **Framework:** Next.js 16 (App Router, React 19, TypeScript, `src/` directory)
- **Styling:** Tailwind CSS (dark/professional theme, blue accent `#2563EB`)
- **Database:** Supabase (PostgreSQL with Row Level Security)
- **Auth:** Supabase Auth (email/password for agencies, magic links for client portal). Super-admin `/admin` uses a **standalone password + cookie**, NOT Supabase Auth.
- **AI:** Claude API (Sonnet 4.6) for dispute letter generation
- **Payments:** Stripe (subscriptions + customer portal) + manual/off-platform payment recording via admin
- **CRM Sync:** GoHighLevel API v2 (two-way webhook sync + native onboarding flow)
- **Document backup:** Google Drive — per-agency OAuth (`drive.file` scope), non-blocking sync
- **Hosting:** Vercel (Hobby plan). Function `maxDuration` may go up to **300s** — the old 60s Hobby cap no longer applies, and `letters/generate` + `cron/retry-ghl-syncs` already run at 300s. Crons are still **daily-only** on Hobby.
- **PDF:** @react-pdf/renderer for letter exports
- **Charts:** Recharts for portal score charts
- **Icons:** Lucide React

## Architecture

### Multi-Tenant Model
- Each `agency` is a tenant. All data is isolated by `agency_id`.
- Supabase RLS enforces isolation — the `get_user_agency_id()` function resolves agency from `team_members`.
- Service role client (`createAdminClient()`) bypasses RLS for API routes handling webhooks and portal access.

### Route Structure
```
(marketing)/     — Landing page, privacy, terms, snapshot (public, unauthenticated)
(auth)/          — Login, signup (agency staff)
(dashboard)/     — Main app (protected, requires Supabase auth)
  dashboard/     — Dashboard home
  clients/       — Client list, detail, items, rounds, letters, docs, signature
  templates/     — AI letter template management
  reports/       — Analytics dashboards
  team/          — Staff management (+ plan-based member limit)
  settings/      — General, GHL config + field mapping, Documents (Drive), branding, billing
  onboarding/    — Post-signup flow, incl. /onboarding/ghl-setup guide page
(admin)/admin/   — Super-admin panel (password/cookie auth, cross-agency, force-dynamic)
(admin-auth)/    — /admin/login (unguarded, separate route group)
portal/          — Client-facing portal (magic link auth, white-labeled)
api/
  ghl/           — webhook (inbound), onboarding (native flow), sync, send-signature-request,
                   send-review-request, messages, debug/fields,
                   setup/* (create-fields, find-pipeline, create-opportunities, sync-clients)
  v1/            — Agency API (Bearer auth, Agency plan only): clients, clients/[id], .../rounds, ping
  ai/            — parse-credit-report, strategy (Claude)
  credit-monitoring/ — pull (Agency plan only). No agency-facing "test" route — the
                   Settings → Credit Monitoring "Test Connection" button calls a Server
                   Action, not a route; the only actual test *route* is admin-only
                   (`/api/admin/tools/test-credit-monitoring`).
  push/          — subscribe (staff dashboard Web Push)
  portal/push/   — subscribe (client portal PWA Web Push) — a separate route from the
                   one above; migration 032 extended the shared `push_subscriptions`
                   table to serve both.
  notifications/ — list + [id]/read (staff in-app notification bell)
  clients/export — CSV export (staff-authenticated)
  google-drive/  — connect, callback, disconnect, backfill
  admin/         — logout, agencies/[id] (panel data), tools/* (GHL fields/pipelines/sync/welcome)
  letters/, stripe/, portal/, cron/, settings/
```
**Crons** (`vercel.json`, daily-only on Hobby): `check-deadlines`, `auto-create-rounds`,
`monthly-progress` (`0 9 1 * *`), `retry-ghl-syncs`. All gated on `CRON_SECRET`.

**Route-group URL note:** the `(dashboard)` and `(admin)` groups are erased from the
URL — pages live at `/clients`, `/settings/ghl`, `/admin`, etc. (NOT `/dashboard/...`).

### Key Flows
1. **Client Intake:** GHL webhook → auto-create client in app OR manual creation
2. **GHL-Native Onboarding:** Lead pays → GHL onboarding form (+ e-signature step — see "Signature step on the standardized onboarding form" under GHL Integration Details for exact field configuration) → tag `rtp-onboarding-completed` fires webhook → `/api/ghl/onboarding` pulls the contact, upserts the client (identity/docs from the fixed `rtp__*` keys; scores from the `ghl_field_keys` mapping), generates the portal link, syncs docs to Drive + writes back to GHL. Always returns 200 to GHL.
3. **Dispute Round:** Select items → generate letters with Claude → review/edit → finalize → export PDF → mark sent → GHL sync + Drive letter backup fires
4. **Results Logging:** Staff logs results per item → deletions update client stats → GHL gets win notification
5. **Client Portal:** Magic link via SMS (GHL workflow) → score chart, progress timeline, document upload (mirrored to Drive)

## Database Tables (Supabase)
- `agencies` — SaaS customers. Incl. `ghl_field_keys` (JSONB — **bureau scores ONLY** since Session 10), `google_drive_*` (OAuth tokens/email/root folder), `ghl_api_key`, `webhook_token` (**per-agency inbound webhook credential**, migration 031 — secret, never sent to the browser except inside that agency's own webhook URL), `credit_monitoring_service`/`credit_monitoring_api_key`/`credit_monitoring_api_secret` (Agency-plan credit monitoring, migration 017), `custom_domain`/`custom_domain_verified` (migration 026), `max_clients`, `plan`/`plan_status`, `settings` (JSONB: `onboarding_steps`, `admin_notes`, `ghl_pipeline_id`/`ghl_pipeline_stages`, `owner_ghl_contact_id`, `auto_create_rounds`/`auto_round_delay_days`, `auto_pull_scores`, `google_review_link`/`referral_link`. **NOT** `ghl_webhook_triggers` — that key is dead, see Notifications.)
- `team_members` — Staff accounts linked to agencies (roles: owner/admin/staff/viewer)
- `clients` — End-clients. Incl. signature fields (`signature_status`, `signed_at`, `signature_type`, `service_agreement_version`), `onboarding_form_submitted`, `ghl_drive_folder_id`, `portal_token`, `ghl_opportunity_id` (cached GHL pipeline opportunity id, migration 016), `ssn_last4` (**CHECK-constrained to exactly 4 digits**, migration 030), the 10 Onboarding Details intake fields (`credit_score_range`, `reviewed_credit_report_recently`, `negative_items_reported`, `enrolled_other_program`, `primary_goal`, `results_timeline`, `employment_status`, `bankruptcy_filed`, `bankruptcy_date`, `intake_concerns` — migration 034, see GHL Integration Details)
- `agency_api_keys` — Agency API keys: `key_hash` (sha256), `key_prefix` (display), `revoked_at` (migration 027)
- `api_rate_limits` — Fixed-window counter for the Agency API, 100 req/hr per key (migration 029)
- `push_subscriptions` — Web Push subscriptions, originally portal-PWA-only (migration 022); migration 032 made `client_id` nullable and added `team_member_id` (+ an exactly-one-owner `CHECK`) so the same table also serves staff dashboard push (`sendPushToStaff()` in `src/lib/push/send.ts`)
- `staff_notifications` — In-app notification feed for staff (migration 033), delivered alongside (not instead of) the GHL-tag/Resend channel, for the 4 staff-facing notification types. Written only by `createAdminClient()` from `notifyStaffChannels()` in `src/lib/ghl/notifications.ts`; read/mark-read via the authenticated staff session (RLS-scoped). Surfaced by the notification bell in the dashboard header (`api/notifications/*`).
- `negative_items` — Items on credit reports to dispute (per bureau)
- `dispute_rounds` — Round lifecycle (preparing → sent → awaiting → complete)
- `disputes` — Individual item disputes within a round (with AI-generated letter content)
- `letter_templates` — AI prompt templates (system defaults + agency custom; incl. 609/611/623)
- `documents` — File uploads (IDs, reports, letters) via Supabase Storage (`documents` bucket)
- `activity_log` — Full audit trail
- `manual_payments` — Off-platform payments recorded by admin (migration 009)
- `snapshot_requests` — GHL snapshot install requests (migration 008)
- `ghl_sync_log` — Outbound GHL sync attempts + failures (migration 005)
- `score_history` — Bureau score snapshots per round for the portal chart (migration 006)
- `credit_monitoring_pulls` — Per-pull audit trail (service, scores returned, status/error) for the credit monitoring integration (migration 017)

### Migrations (`supabase/migrations/`, run in order in Supabase SQL editor)
001 schema · 002 RLS · 003 seed templates · 004 finalized col · 005 ghl_sync_log ·
006 score_history · 007 team RLS fix · 008 snapshot_requests · 009 manual_payments ·
010 609/611/623 templates · 011 signature+onboarding+ghl_field_keys · 012 google_drive ·
013 client_assignment · 014 personal_info_types · 015 personal_info_template ·
016 ghl_opportunity_id · 017 credit_monitoring · 018 security_hardening (`documents`
UPDATE RLS policy) · 019 message_origins · 020 staff_notification_prefs ·
021 notification_prefs_nullable · 022 push_subscriptions · 023 letter_compliance ·
024 staff_notification_targeting · 025 agency_client_limit_backfill · 026 custom_domain ·
027 agency_api_keys · 028 activity_log_api_actor (adds `'api'` actor type) ·
029 agency_api_rate_limits (+ `increment_api_rate_limit()` fn) ·
**030 ssn_last4_check** (`CHECK (ssn_last4 IS NULL OR ssn_last4 ~ '^\d{4}$')`) ·
**031 agency_webhook_token** (per-agency inbound webhook credential) ·
032 staff_push_subscriptions (extends `push_subscriptions` for staff dashboard push) ·
033 staff_notifications (in-app notification feed for staff) ·
**034 onboarding_intake_fields** (10 Onboarding Details columns on `clients`)

## Key Libraries & Locations
- `src/lib/supabase/{client,server,admin}.ts` — browser / SSR / service-role clients
- `src/lib/claude/generate-letter.ts` — AI letter generation (single + bulk)
- `src/lib/ghl/api.ts` — GHL API v2 wrapper (contacts, tags, pipeline, tasks, custom fields, pipelines, opportunity find-or-create)
- `src/lib/ghl/webhook.ts` — Inbound GHL webhook handler
- `src/lib/ghl/webhook-auth.ts` — **inbound webhook auth (Session 10).** `verifyGhlWebhook()` (per-agency `webhook_token`, falling back to the legacy global `GHL_WEBHOOK_SECRET` if still set) + `locationBelongsToAgency()` (tenant binding). **Fails closed.**
- `src/lib/ghl/field-keys.ts` — **SINGLE SOURCE OF TRUTH for the 38 GHL custom-field keys.** Never hand-write a `rtp__*` key elsewhere.
- `src/lib/ghl/setup-config.ts` — the field *specs* the setup tools create (`RTP_CUSTOM_FIELDS` / `_NOTIFICATION_FIELDS` / `_IDENTITY_FIELDS` / `_STAFF_ALERT_FIELDS` → `RTP_ALL_CUSTOM_FIELDS`) + pipeline specs. Field NAMES here are what *derive* the keys above.
- `src/lib/ghl/notification-tags.ts` — `GHLNotificationType`, `NOTIFICATION_TAGS`, `ONBOARDING_COMPLETE_TAG`, `INBOUND_TAGS`. Split out from `notifications.ts` so **client components can import it** without pulling in `next/server`'s `after()` (which breaks the client bundle).
- `src/lib/ghl/field-detect.ts` — hardened score-field suggester (Session 10; propose-only, never saves)
- `src/lib/ghl/field-status.ts` — resolves GHL field keys → human names; reports which identity fields exist
- `src/lib/api/{auth,log,clients}.ts` — Agency API: key hashing + Bearer auth + rate limit + plan entitlement; `activity_log` writer; shared client field scope
- `src/lib/push/{send,endpoint}.ts` — Web Push sender + **push-service endpoint allowlist** (SSRF guard)
- `src/lib/vercel/domains.ts` — Vercel Domains API wrapper (custom portal domains)
- `src/lib/ghl/notifications.ts` — notification service: writes custom fields → adds a `rtp-*` tag that fires the agency's own GHL workflow → Resend fallback → log-only no-op. 11 `GHLNotificationType`s; **never throws past its caller.**
- `src/lib/ghl/pipeline.ts` — best-effort GHL opportunity/pipeline-stage sync (`moveClientPipelineStage`)
- `src/lib/team/notification-prefs.ts` — `isSubscribedTo()`; owners default to subscribed-to-everything until they opt out
- `src/lib/credit-monitoring/{index,myfreescorenow,identityiq,smartcredit}.ts` — provider adapters (**unverified placeholder endpoints** — see that section)
- `src/lib/reports/metrics.ts` — bureau success-rate / negative-type / retention reporting
- `src/lib/google-drive/{auth,client,sync,letter-sync}.ts` — OAuth, Drive API, non-blocking sync
- `src/lib/admin/session.ts` — super-admin password/cookie auth (`rtp_admin_session`)
- `src/lib/admin/{mrr,avatar,agency-panel,tool-helpers}.ts` — admin dashboard helpers
- `src/lib/billing/plans.ts` — **single source of truth for plans/pricing/limits**
- `src/lib/team/limits.ts` — team-member limit enforcement
- `src/lib/utils/csv.ts` — `toCSV()` + `forceCsvText()`; **formula-guards every freeform cell** (see Security Rules)
- `src/lib/utils/secrets.ts` — `maskSecret()`; a masked value on save means "keep the existing secret"
- `src/lib/utils/portal-token.ts` — `generatePortalLink()` (**reuses** the client's token; only rotates on `{rotate:true}` or near-expiry) + `validatePortalToken()`
- `src/lib/utils/{helpers,license}.ts` — formatting, license
- `src/lib/auth/{session,admin}.ts` — staff session context / admin guard wrappers
- `src/types/index.ts` — All TypeScript types matching the DB schema

## Code Style & Conventions
- Use `cn()` from `src/lib/utils/helpers.ts` for Tailwind class merging
- Server Components by default; add `"use client"` only when needed (interactivity, hooks)
- Use `createServerSupabaseClient()` in Server Components and Route Handlers
- Use `createClient()` (browser) only in Client Components
- Use `createAdminClient()` only in API routes that need to bypass RLS (webhooks, portal, cron)
- All API routes use Route Handlers (`route.ts`) not Pages API
- Prefer Server Actions for form mutations where possible
- Use Lucide React icons, not heroicons or other icon libraries
- Responsive design: mobile-first (clients check portal on phones)

## Design Direction
- **Dark sidebar** with light main content area
- **Blue accent** (#2563EB) as primary, with status-specific colors (green=success/deleted, red=verified/failed, amber=pending, etc.)
- **Clean, professional, dense** — this is an operations tool, not a marketing site. Staff needs information density.
- **Minimal decorative elements** — functional UI like Linear/Notion, not playful
- Font: Inter (system) for body, medium weights for headings
- Border radius: `rounded-lg` (8px) for cards, `rounded-md` for inputs/buttons
- Shadows: subtle `shadow-sm` on cards only
- **Theming:** app defaults to the dark theme; a light-mode toggle (`src/lib/theme/theme-context.tsx`) sets `html.light`/`html.dark`. Light overrides are **scoped to `.app-content`** (the dashboard main column) in `globals.css` — the sidebar, `(auth)`, `portal`, and `(admin)` shells stay permanently dark. Content text should use `text-slate-*` (auto-remapped for light) and accent `-300/-400` text (auto-darkened for light); wrap any solid-dark banner in `.always-dark` so its light text isn't flipped. (Session 8.)

## GHL Integration Details
- **Inbound webhook auth (Session 10):** both inbound webhooks authenticate with the agency's own `agencies.webhook_token`, passed as `?secret=<token>` (or the `x-rtp-secret` / `x-wh-secret` header). Settings → GHL renders each agency's tokenized URL for copy-paste — **the URL is a live credential**. Auth **fails closed**, and the request is **tenant-bound**: the payload's `locationId` must belong to the token's agency, otherwise a valid token for agency A could write into agency B. The old global `GHL_WEBHOOK_SECRET` is still accepted *if set* (legacy migration path) but identifies no agency and so can't be tenant-bound — **keep it unset**. Rejections return **200** with `processed: false` (GHL retry-storms on non-2xx), so a misconfigured URL **fails silently** — verify with a real contact edit, not by looking for errors in GHL.
- **Inbound webhook URL:** `/api/ghl/webhook` — handles ContactCreate, ContactUpdate, ContactTagUpdate. ⚠️ `ContactCreate` creates a RoundTrack client for **every** contact it receives — in a GHL location shared with other products, trigger it from a *targeted* workflow, never a blanket "contact created".
- **Onboarding webhook:** `/api/ghl/onboarding` — trigger from GHL on tag `rtp-onboarding-completed` (`ONBOARDING_COMPLETE_TAG` in `notification-tags.ts`; namespaced because a bare `onboarding-complete` is a common tag in credit-repair GHL accounts and another product's workflow adding it would create clients here. **Nothing in the code reads the tag** — the route acts on whatever `contactId`/`locationId` it is POSTed; the tag is purely the GHL-side trigger). This is the primary client-creation path. Upserts the client (identity/docs from the fixed `rtp__*` keys; scores from `ghl_field_keys`), resolves the portal link, syncs docs to Drive + writes `rtp__client_id`/`rtp__portal_link` back. Heavy work runs in Next `after()`; always 200.
- **Signature request (fallback only):** `/api/ghl/send-signature-request` — adds tag `signature-requested` to fire the agency's GHL form workflow. This is a re-request path for the rare client who completes onboarding without signing, **not** the primary signature flow — see "Signature step on the standardized onboarding form" below. Meaningful only if the agency has also built a separate workflow reacting to this tag; otherwise clicking it just tags the contact with no visible effect.
- **Outbound sync:** Uses per-agency `ghl_api_key` stored in `agencies` table
- **Sync events:** Round sent → pipeline move (`round_N_sent`) + tag + note. Results logged → pipeline move (`round_N_results`). Deletion → tag + field update. Score update → custom fields. Completion → `goal_achieved` stage + tag.
- **GHL custom fields — single source of truth is `src/lib/ghl/field-keys.ts`.** GHL derives a field's stored key from its NAME ("RTP - Portal Link" → `rtp__portal_link`; the `" - "` collapses to a **double** underscore). The setup tool (`RTP_ALL_CUSTOM_FIELDS` in `setup-config.ts`) creates **38** fields in five groups:
  - **9 core tracking** (`RTP_CUSTOM_FIELDS`): `rtp__round_number`, `rtp__items_deleted`, `rtp__total_items`, `rtp__next_dispute_date`, `rtp__eq_score`, `rtp__exp_score`, `rtp__tu_score`, `rtp__portal_link`, `rtp__client_id`
  - **7 notification** (`RTP_NOTIFICATION_FIELDS`): `rtp__items_disputed`, `rtp__deletions_this_round`, `rtp__deleted_items_list`, `rtp__score_improvement`, `rtp__monthly_fee`, `rtp__agency_phone`, `rtp__google_review_link`
  - **9 identity/intake** (`RTP_IDENTITY_FIELDS`, Session 10 — the **read** side): `rtp__ssn_last_4` (TEXT — note `_last_4`, since "RTP - SSN Last 4" turns *each* space into an underscore), `rtp__dob` (DATE), `rtp__signature_status` (TEXT), `rtp__signature_date` (DATE), `rtp__id_document`, `rtp__proof_of_address`, `rtp__credit_report_eq`, `rtp__credit_report_exp`, `rtp__credit_report_tu` (all FILE_UPLOAD)
  - **10 onboarding-details intake** (`RTP_ONBOARDING_INTAKE_FIELDS`, migration 034 — the **read** side): `rtp__credit_score_range`, `rtp__reviewed_credit_report_recently`, `rtp__negative_items_reported`, `rtp__enrolled_other_program`, `rtp__primary_goal`, `rtp__results_timeline`, `rtp__employment_status`, `rtp__bankruptcy_filed` (all TEXT — the 3 enum-shaped ones are normalized best-effort against known values and dropped to `NULL` if unrecognized, since the columns are `CHECK`-constrained), `rtp__bankruptcy_date` (DATE), `rtp__intake_concerns` (TEXT)
  - **3 staff-alert** (`RTP_STAFF_ALERT_FIELDS`, Session 11): `rtp__alert_round_number` (NUMERICAL), `rtp__alert_days_overdue` (NUMERICAL), `rtp__alert_dashboard_link` (TEXT). Written to the **client's** contact by the 3 staff alerts — see the Notifications section. Client name/email/phone need no field: on the client's own contact they're the native `{{contact.first_name}}` / `{{contact.email}}` / `{{contact.phone}}`.

  > **Note:** earlier revisions of this file listed names like `dispute_round_current` / `credit_score_eq_current` / `clientdeck_portal_link`. Those were **never** the real keys — always trust `field-keys.ts`.

- **Field mapping (`agencies.ghl_field_keys` JSONB) — scores ONLY.** Only `score_eq` / `score_exp` / `score_tu` are agency-configurable (Settings → GHL), because an agency captures starting scores on its own intake form. Everything identity-related is read from the fixed `rtp__*` keys above.

  **Why (Session 10):** these 9 were previously agency-mapped by name via `field-detect.ts`. In a live GHL location shared with TaxIntake Pro (`ti__*`) and Due Diligence Pro (`dd_*`), auto-detect resolved **"Equifax Score" → a field named "Equifax Password"**, **"SSN Last 4" → a *dependent's* SSN**, and "Proof of Address" → a yes/no radio. Caught before any client onboarded through it. Fixed keys make the collision structurally impossible. Auto-detect (scores only) is now **propose-and-confirm** and gated: credential denylist (password/login/PIN/secret), dependent/spouse exclusion, `NUMERICAL`-type requirement, `rtp__` preferred over `dd_`/`ti__`, and **no guess when nothing passes**.

  ⚠️ Creating the identity fields does **not** populate them — each agency must point their own GHL onboarding form/workflow at the new `rtp__` fields. Surfaced by the `IdentityFieldsNotice` banner in Settings → GHL.

- **Signature step on the standardized onboarding form.** The primary
  signature path is the e-signature field embedded directly in the client's
  onboarding form — **not** the "Send Signature Request via GHL" button (see
  above), which is a fallback re-request path for the rare client who
  completes onboarding without signing.

  **How the webhook recognizes a signature** (`extractClientData` in
  `src/app/api/ghl/onboarding/route.ts`): it reads `rtp__signature_status` and
  tests it with `/^(signed|yes|true|complete)/i` — a case-insensitive
  **prefix** match (no `$` anchor), so `Signed`, `signed by client`, and `yes`
  all match. A GHL signature field's own output (a drawn image, or the
  client's typed name) never will, so the signature *capture* and the
  signed-ness *indicator* must be two separate GHL fields. To configure it:

  1. Add GHL's native **Signature** field type to the onboarding form for the
     actual capture (client draws/types to sign). Its value is never read by
     RTP — it exists purely to satisfy the legal capture requirement inside GHL.
  2. In the GHL Workflow that processes this form submission, add an **Update
     Contact Field** action, placed *after* the signature step, that sets:
     - `RTP - Signature Status` → the literal text `Signed` — a value
       hardcoded into the workflow action itself, never mapped from the
       signature field's own content (its content won't match the regex).
     - `RTP - Signature Date` → an actual date value (GHL's current-date
       merge variable/action output), not free text. If left blank, the
       webhook falls back to "the moment the onboarding webhook ran" — close,
       but not the true signing timestamp.
  3. Test with one real contact and confirm the client's Service Agreement
     card (`/clients/:id`) flips to "Signed." A field-name mismatch (GHL
     derives the key from the exact name) silently writes to an orphaned
     field, same as any other `rtp__` field.

  ✅ **`RTP - Signature Date` (and `dob`/`bankruptcy_date`) are now validated
  before they reach the query.** `parseTimestamp()` in
  `src/app/api/ghl/onboarding/route.ts` replaced the old raw
  `new Date(x).toISOString()` passthrough for all three fields — an
  unparseable value is logged as a warning and dropped (to `null`, or to
  "now" only for `signed_at`, where that's a reasonable approximation of the
  true signing moment; a fabricated current-date `dob`/`bankruptcy_date`
  would be actively misleading rather than merely missing). The
  returning-client `.update()` call also now checks its own query `error`:
  on failure it logs to `activity_log` (`action: "Onboarding update failed"`,
  visible on the client's Timeline tab) and throws, rather than the old
  behavior where a rejected field silently no-op'd the entire update with
  nothing logged anywhere. The insert path still fails the same way it
  always did on a genuine DB rejection: the write throws, is caught, and the
  entire client record fails to save (webhook still returns 200 to GHL).

  ⚠️ **`service_agreement_version` is not wired to any GHL field.** It's a DB
  column (`TEXT DEFAULT 'v1'`) shown on the Service Agreement card, but
  nothing in `extractClientData` reads it and there's no staff UI to edit it
  either — every client shows `v1` forever regardless of what they actually
  signed. Don't point the onboarding form at a "version" field expecting it to
  be captured; making this real requires a code change (a new `rtp__*` field
  key + read logic), not a form-configuration step.

  `signature_type` is always hardcoded to `"electronic"` by the webhook when a
  signature is recognized — nothing on the GHL side can produce `"drawn"` or
  `"typed"`, even though the DB column allows them.

## GHL Notifications & Pipeline Sync (Session 6)
- **Independent channel, additive to outbound sync above.** `src/lib/ghl/notifications.ts` writes the event's data into the contact's GHL custom fields, then **adds a tag** (`NOTIFICATION_TAGS`) that fires the agency's own GHL workflow — free, no per-execution cost. The tag is removed 5s later (via `after()`) so it can refire. Falls back to Resend email (only a subset of types have a template), then to a log-only no-op. Every send is logged to `activity_log` (`action: "notification_sent"`) and never throws past its caller.
  > **The "Custom Webhook" / `agencies.settings.ghl_webhook_triggers` design is GONE** — replaced by the tag mechanism above in commit `cb32103`. There is no `/api/ghl/test-webhook` route and no per-type URL setting. Older revisions of this file and the plans under `docs/superpowers/` still describe it; they are stale.
- **11 notification types.** 7 client-facing: `round_sent`, `deletion_win`, `round_results_in`, `goal_achieved` (client completed), `payment_failed` (Stripe webhook — client's own `stripe_customer_id`, distinct from the agency's SaaS subscription), `portal_link`, `monthly_progress` (`/api/cron/monthly-progress`, `0 9 1 * *`). 4 staff-facing: `staff_new_client` (onboarding webhook), `staff_round_overdue` / `staff_next_round_ready` (crons), `staff_monthly_progress`.
- **Staff alerts fire on the CLIENT's contact** (Session 11) — `staff_new_client`, `staff_round_overdue`, `staff_next_round_ready` (the `CLIENT_TAGGED_STAFF_TYPES` set in `notifications.ts`). They used to tag the *owner's* contact, which meant the workflow that fired had no client on it: `{{contact.first_name}}` was the staff member and there were **no client merge fields at all**, so the alert could only ever say "go look at the dashboard". Tagging the client's contact gives the workflow the whole client record; the message still reaches staff because a GHL workflow triggered on a client can send SMS/email to a **fixed** number/address. Three dedicated fields carry the alert payload: `rtp__alert_round_number`, `rtp__alert_days_overdue`, `rtp__alert_dashboard_link`.
  - **Deliberately NOT reusing `rtp__round_number`:** `staff_next_round_ready` carries the *next* round (N+1), which hasn't been sent — and `rtp__round_number` is what the client-facing "Round Sent"/"Monthly Update" messages read. Writing a future round there would make the **client's own SMS** quote a round that never happened.
  - **No staff-contact fallback.** If the client has no `ghl_contact_id` (or the tag call fails), we email the staff recipients via Resend and do **not** tag their contacts. Re-firing the same tag on a staff contact would run the workflow with merge tags that resolve against *that* contact — sending an alert full of blank client fields.
  - The payload passed to the client-tag path carries **no `email`** on purpose: if it did, a GHL failure would let the Resend fallback mail a staff-only alert ("Round 2 is 6 days overdue, chase it") **to the client**.
  - `staff_monthly_progress` is **not** in the set — it still fires per staff member on their own contact (fields would clobber that staff member's own values).
  - ⚠️ **Breaking for any agency that already built these 3 workflows.** Tag names and the Tag-Added trigger are unchanged, so the workflow still fires — but now *with the client as the contact*. If its SMS action sends to "Contact", the staff alert now **texts the client**. Each must be repointed at a fixed staff number and rewritten to use the client merge fields. The 7 client-facing types are unaffected.
- **Staff in-app + push channel (migrations 032/033, Session 12) — additive, not a replacement.** For all 4 staff-facing types, `notifyStaffChannels()` in `notifications.ts` also writes a `staff_notifications` row and calls `sendPushToStaff()` (`src/lib/push/send.ts`) for each recipient, alongside the GHL-tag/Resend channel above. Surfaced via the notification bell in the dashboard header (`api/notifications/*`, mark-read per row). This channel doesn't depend on the agency having built any GHL workflow — it works out of the box.
- **Configure at Settings → GHL:** the tag/field reference table (`TagNotificationGuide`), "Pipeline Configuration", and a link to the full setup guide at `/onboarding/ghl-setup`. `agencies.settings.owner_ghl_contact_id` is now only the `staff_monthly_progress` target + the no-client fallback.
- **Pipeline-stage sync** (`src/lib/ghl/pipeline.ts`, `moveClientPipelineStage`): moves a client's GHL opportunity through the **9-stage** "Active Client" pipeline (`setup-config.ts`'s `RTP_PIPELINES` also defines a second, undocumented-elsewhere **"Credit Sales"** pipeline — 6 lead-stage names, e.g. "New Lead"/"Signed / Won" — for the pre-client sales funnel; only "Active Client" is wired into `pipeline.ts`'s stage-move logic) — `analysis`, `ready_to_dispute`, `round_1_sent`, `round_1_results`, `round_2_sent`, `round_2_results`, `round_3_plus`, `round_3_plus_results`, `goal_achieved` (configured via `agencies.settings.ghl_pipeline_id`/`ghl_pipeline_stages`; labels + `stageForRoundSent`/`stageForRoundResults`/`stageForClientState` helpers live in `pipeline.ts`). Wired into round events in `clients/[id]/rounds/actions.ts` (round sent → `round_N_sent`, results logged → `round_N_results`, completion → `goal_achieved`); lazily finds-or-creates the opportunity via `findOrCreateGHLOpportunity()`, caching it on `clients.ghl_opportunity_id`. New clients are placed in `analysis` at onboarding; `/api/ghl/setup/create-opportunities` backfills opportunities for all synced clients; `/api/ghl/setup/find-pipeline` auto-maps stage ids by name (GHL never exposes stage ids in its UI — this tool is the only way to get them) and **prefers an `RTP - ` (or legacy `CDP - `) prefixed pipeline** over any other name containing "active client". Best-effort, no-ops cleanly if unconfigured; unmapped stages just no-op. (Session 6; 3 → 8 stages in Session 8; rounds 3+ gained their own results stage in Session 10.)
  - `PipelineStageKey` (pipeline.ts) and `AgencySettings.ghl_pipeline_stages` (types/index.ts) duplicate the same key union — they can't import each other (circular). A **compile-time assertion in `pipeline.ts` makes any drift a build error**; don't "fix" it by deleting the assertion.
  - After changing the stage model, agencies must **re-run Find & Connect Pipeline** — existing `ghl_pipeline_stages` rows won't contain the new key until they do.
- **Visibility:** client Timeline tab shows a "✓ GHL" / "⚠ Email fallback" badge on notification entries; admin agency slide-over's GHL Config tab shows connection status + how staff alerts are targeted.

## Credit Monitoring Integration (Session 7)
- **Gated to the Agency plan** via `isAgencyPlanOrHigher()` (`src/lib/billing/plans.ts`) — Starter/Pro agencies see an upgrade-gate card at Settings → Credit Monitoring instead of the connection form, and `/api/credit-monitoring/pull` returns 403 for non-Agency agencies.
- **Three provider adapters** under `src/lib/credit-monitoring/` (`myfreescorenow.ts`, `identityiq.ts`, `smartcredit.ts`, dispatched via `index.ts`'s `pullCreditScores()`/`testConnection()`) — each carries a standing `TODO: Verify endpoint URL and field names` comment; these are unverified placeholder API calls pending real partner API docs, not confirmed integrations.
- **`credit_monitoring_pulls`** (migration 017) — per-pull audit row (`agency_id`, `client_id`, `service`, scores, `status`/`error_message`, `raw_response`). Credentials live on `agencies.credit_monitoring_service`/`_api_key`/`_api_secret`.
- **Settings tab** at Settings → Credit Monitoring: provider select + API key/secret fields (cleared on provider change), Test Connection button. **Pull Scores button** lives on client detail — calls `/api/credit-monitoring/pull`, writes `score_history`, and syncs the GHL score custom fields. An opt-in auto-pull (`settings.auto_pull_scores`) also fires non-blocking from the GHL onboarding webhook for newly onboarded clients.
- Also surfaced in Reports ("Credit Score Analytics" section) and the admin agency slide-over (status + test-connection tool, `/api/admin/tools/test-credit-monitoring`).

## Super-Admin Panel (`/admin`)
- **Auth is standalone** — password (`ADMIN_PASSWORD`) → SHA-256 → httpOnly `rtp_admin_session` cookie. NO Supabase Auth. Middleware lets all `/admin/*` through; `(admin)/layout.tsx` guards via `requireAdmin()`; `/admin/login` lives in a separate `(admin-auth)` group. `ADMIN_EMAIL` is only an optional audit label.
- **Features:** dashboard (agencies, MRR, pending-setup), agency **slide-over panel** (Status / GHL Config / Tools / Branding / Payments), Pending Setup queue, manual payments, snapshot requests, activity + system health (Supabase/Vercel/GHL sync failures).
- **GHL setup tools** (`/api/admin/tools/*`): create the 38 custom fields, create pipelines (best-effort), sync clients, test credit monitoring, resend welcome email. (The agency-facing equivalents live at `/api/ghl/setup/*`.)
- All admin reads use `createAdminClient()` (service role, cross-agency).

## Google Drive Integration
- **Per-agency OAuth** (`drive.file` + `userinfo.email` scopes). Tokens on `agencies.google_drive_*`. Connect at Settings → Documents.
- **Folder layout:** `RoundTrack Pro / {Client Name} / {Onboarding | Round_N | Client_Uploads}`. There is no separate `Bureau_Responses` or `Letters` subfolder — round-sent letter PDFs are filed under that round's own `Round_N` folder (`src/lib/google-drive/letter-sync.ts`), not a dedicated "Letters" folder.
- **ALWAYS non-blocking** via `syncDocumentToDrive()` (swallows errors, returns null if not connected). Triggered by: onboarding docs, round-sent letter PDFs (regenerated), portal uploads, and the Settings → Documents **backfill** button.
- Requires `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` + redirect URI `{APP_URL}/api/google-drive/callback` (see README).

## Plans & Pricing (`src/lib/billing/plans.ts` — single source of truth)
- **Starter** $49/mo — 100 clients, 3 team members (internal plan id stays `solo`)
- **Pro** $129/mo — 700 clients, 10 team members
- **Agency** $249/mo — 3,000 clients, 20 team members, API/custom domain, removes branding — **not unlimited**
- `enterprise` — provisioned manually, the actually-unlimited tier (`9999`/`9999`). Limits enforced via `maxClientsForPlan()` / `maxTeamMembersForPlan()` and stored on `agencies.max_clients`.

## AI Letter Generation
- Uses Claude API (Sonnet 4.6) via `src/lib/claude/generate-letter.ts`
- System letter templates stored in `letter_templates` table (seeded via migration 003)
- Template prompts use `{{variable}}` syntax, injected before sending to Claude
- Letters cite FCRA sections (611, 604, 616, 617, 605B), FDCPA for debt validation
- Staff MUST review and can edit every letter before finalizing — never auto-send
- Bulk generation: processes 3 letters concurrently via `Promise.allSettled`

## Security Rules
- **NEVER store full SSN — only `ssn_last4`.** Enforced in three places now: the dashboard form, the CSV import, and (since Session 10) the GHL onboarding webhook, which strips to digits and takes the last 4. Migration 030 adds a DB `CHECK` as the backstop, so no future code path can reintroduce it. A full SSN would otherwise flow into CSV exports and the Claude letter prompt.
- NEVER store raw credit report data in the database
- RLS on every table — `agency_id` isolation enforced at DB level
- Portal uses `portal_token` (32-char hex, a dashless `randomUUID()`) with a **90-day** expiry — NOT Supabase Auth.
- **Sharing a portal link must never rotate it.** `generatePortalLink()` REUSES the client's existing token; it only mints a new one when the token is missing, expired, or <7 days from expiry, or when the caller explicitly passes `{ rotate: true }`. It used to mint a fresh token on *every* call — and Copy Link, Send via Email, Send via SMS, and the onboarding sync all call it, so a staff member copying the link silently killed the link already in the client's inbox (seen live: 7 rotations in under a minute). Rotation is a **security action** (link leaked, client offboarded), exposed only as the explicit **Regenerate link** action behind a confirm. If you add a new "send the client their link" path, call `generatePortalLink()` **without** `rotate`.
- Secrets (`ghl_api_key`, `credit_monitoring_*`, `webhook_token`) are **never sent to the browser** — Server Components send `maskSecret()` placeholders, and save actions treat a masked value as "keep the existing secret" (`src/lib/utils/secrets.ts`). Beware `{...agency}` spreads into client components.
- **All webhook endpoints FAIL CLOSED.** A missing server-side secret must reject everything, never "skip the check". `if (secret) { check }` is the bug pattern — it shipped, and production accepted unauthenticated GHL webhooks for a period (Session 10). Stripe verifies its signature; crons check `CRON_SECRET`; GHL uses `verifyGhlWebhook()`.
- **Tenant-bind anything the caller can name.** Both GHL webhooks pick the agency from the payload's `locationId`, which the caller controls — so authentication alone was not enough. `locationBelongsToAgency()` rejects a request whose `locationId` isn't owned by the token's agency.
- **CSV: formula-guard all freeform text.** `toCSV()` prefixes any cell starting with `=`, `+`, `-`, `@`, tab, or CR. Quoting does NOT prevent Excel formula execution. Client names come from lead-submitted GHL forms — i.e. attacker-controlled. Only `RawCsvCell` (from `forceCsvText()`) bypasses the guard.
- **Allowlist any URL the server will fetch.** Push subscription endpoints are checked against the real push services (`src/lib/push/endpoint.ts`) — `web-push` will POST to any host it's given, which made the portal an SSRF primitive.
- **Re-check entitlement on every request, not just at issuance.** Agency API keys verify `hasApiAccess(plan)` + `plan_status` on each call, so a downgraded/cancelled agency's existing keys stop working.

> ⚠️ **Known outstanding risk (not a code issue):** the live GHL onboarding form collects **full SSN + bureau login credentials, security-question answers, and PINs** into plaintext GHL custom fields. This is the single largest exposure in the system and the root cause behind several past bugs. The credential-free path already exists — enroll clients via the credit-monitoring provider (`src/lib/credit-monitoring/`) and pull reports by API instead of holding their passwords.

## Environment Variables Required
See `.env.example` for the full annotated list. Notable:
```
NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL
ANTHROPIC_API_KEY                      # mock letters if empty
STRIPE_SECRET_KEY / _WEBHOOK_SECRET / NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_PRICE_SOLO                      # Starter plan ($49) — id stays "solo"
STRIPE_PRICE_PRO                       # Pro ($129)
STRIPE_PRICE_AGENCY                    # Agency ($249)
GHL_WEBHOOK_SECRET                     # LEGACY/RETIRED — keep UNSET. Webhooks now use
                                       # the per-agency agencies.webhook_token (migration
                                       # 031). If set, it is still accepted as a global
                                       # credential that cannot be tenant-bound.
RESEND_API_KEY                         # emails logged to console if empty
CRON_SECRET
PORTAL_TOKEN_SECRET
ADMIN_PASSWORD                         # super-admin /admin login (required for admin access)
ADMIN_EMAIL                            # optional audit label only
GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET  # Google Drive OAuth (Drive no-ops if unset)
VAPID_PRIVATE_KEY / VAPID_SUBJECT / NEXT_PUBLIC_VAPID_PUBLIC_KEY  # Web Push (portal PWA; no-ops if unset)
VERCEL_TOKEN / VERCEL_PROJECT_ID / VERCEL_TEAM_ID  # custom portal domains (Agency plan)
```
> Vercel env changes only apply to the **next deployment** — redeploy after editing.
> ⚠️ Deleting a secret an endpoint depends on takes effect on the next deploy and, with
> fail-closed auth, silently rejects live traffic. Sequence env changes with the code
> that needs them.

## Build Status
Core build complete (Weeks 1–7): schema, auth, clients/items, dispute rounds + AI
letters, round lifecycle + results, GHL two-way sync, client portal, dashboard
analytics, landing page.

**Shipped since (post-launch sessions):**
- **Session 1** — Super-admin panel rebuild (password auth, agency slide-over, GHL
  tools, pending queue, system health); pricing overhaul (Starter/Pro/Agency) +
  team-member limits; 609/611/623 letter templates (migration 010).
- **Session 2** — GHL-native onboarding webhook + e-signature capture/display;
  per-agency Google Drive integration (OAuth, non-blocking sync for onboarding
  docs / round letters / portal uploads / backfill); GHL field-key mapping UI
  (migrations 011 + 012).
- **Session 5** — AI credit-report PDF parser (`/api/ai/parse-credit-report` →
  Claude document extraction → staff review → reuses `addItems`); auto-create-next-round
  cron (`/api/cron/auto-create-rounds`, gated on `settings.auto_create_rounds`) +
  payment gate on `createRound`; client→team-member assignment (`clients.assigned_to`)
  + team caseload dashboard + `?assigned=` list filter; bureau success-rate / negative-type /
  retention reporting (`src/lib/reports/metrics.ts`); AI dispute-strategy advisor
  (`/api/ai/strategy` + client-header panel); case-completion review-request automation
  (extended `syncClientCompleted`, `/api/ghl/send-review-request`, portal celebration +
  review/referral links); `personal_info_error` + `duplicate_account` item types
  (migrations 013 + 014 + 015).
- **Session 6** — GHL notification webhooks + pipeline-stage sync (the deferred
  Sessions 3–4 GHL workflow wiring, done as two phases): new independent
  `src/lib/ghl/notifications.ts` service (10 notification types, GHL webhook →
  Resend → log-only fallback chain, never throws) wired into all round/client/
  payment/staff-alert events alongside the existing tag/field sync; Settings →
  GHL config UI (webhook URLs + Test buttons, pipeline configuration) and a
  `/onboarding/ghl-setup` guide page; best-effort GHL opportunity/pipeline-stage
  sync (`src/lib/ghl/pipeline.ts`, migration 016 `ghl_opportunity_id`); monthly
  client-progress cron (`/api/cron/monthly-progress`); notification-method badge
  on the client Timeline tab + admin notification-health widget.
- **Session 7 (Part A)** — UI/UX visual redesign: design system tokens (button
  press state, input focus ring, badge dot/size variants), sidebar upgrade
  (active-state left border, workspace-switcher affordance), dashboard stat
  cards + gradient onboarding banner + deletions chart styling, client list
  (avatars, hover actions, status pills, table/card view toggle), client
  detail header (bureau score cards, progress bar, item status icons); new
  rounds kanban pipeline board with list/pipeline view toggle (click-only —
  no drag-and-drop yet); landing page hero/pricing-card/comparison-table
  upgrades; empty-state polish across clients list, timeline, and reports.
- **Session 7 (Part B)** — Credit monitoring integration, gated to the
  **Agency** plan (`isAgencyPlanOrHigher()`): per-agency provider connection
  (MyFreeScoreNow/IdentityIQ/SmartCredit) in Settings → Credit Monitoring;
  `credit_monitoring_pulls` audit table (migration 017); a Pull Scores flow on
  client detail that fetches bureau scores, writes `score_history`, and syncs
  the GHL score custom fields; an opt-in, non-blocking auto-pull fired from
  the GHL onboarding webhook for new clients (`settings.auto_pull_scores`);
  a Reports "Credit Score Analytics" section; and an admin agency slide-over
  tool to check credit-monitoring status and test the stored connection.
- **Session 8** — (a) Light/dark **font-contrast fix**: pastel accent `-300/-400`
  text was ~invisible on white in light mode; `globals.css` now darkens accent
  text in the `.app-content` light layer and re-asserts bright shades inside
  `.always-dark`. (b) **Landing-nav cleanup**: dropped the "GHL Snapshot" nav
  link (page still at `/snapshot`), outline "Log In", and the generic "Start
  Free Trial" CTAs (nav/hero/final) scroll to `#pricing` while the plan cards
  keep the real `/signup` link. (c) **Granular 8-stage GHL pipeline**: expanded
  `ghl_pipeline_stages` from 3 keys to 8, granular stage moves on round
  sent/results, opportunity creation at onboarding (Analysis stage) +
  `/api/ghl/setup/create-opportunities` backfill + a Settings → GHL 8-stage
  config/status UI and "Create Opportunities for All Clients" tool. No new
  migrations (reuses `clients.ghl_opportunity_id` + `agencies.settings`).
- **Session 9** — **Product rename: ClientDeck Pro → RoundTrack Pro** (domain
  `clientdeckpro.com → roundtrackpro.com`). Branding-only text sweep across
  `src/`, docs, and config (`package.json` name → `roundtrack-pro`, marketing
  metadata, logo wordmark, email FROM addresses, legal/portal/onboarding copy).
  **Zero** schema/API/logic changes. At the time, the ClientDeck-era identifiers
  (field keys, notification tags, admin cookie, webhook header) were deliberately
  left alone for backward compatibility with live GHL installs.
  **Superseded 2026-07-14** — see the Identifier rename note at the top of this
  file: they have since ALL been renamed to `rtp*` in a clean break.
- **Session 10 — Agency API, security audit + remediation, GHL field/webhook hardening.**
  - **Agency API** (Agency plan only, gated by `hasApiAccess()`): key generation with
    sha256 hashing + one-time reveal (Settings → API, migration 027); Bearer auth
    (`src/lib/api/auth.ts`) that re-checks plan entitlement on **every** request;
    Postgres fixed-window rate limiting (100 req/hr per key, migration 029 — *not* the
    in-memory helper, which doesn't hold across serverless instances); endpoints
    `GET /api/v1/clients`, `/clients/:id`, `/clients/:id/rounds`, `POST /api/v1/clients`;
    docs page at `/settings/api/docs`. Cross-agency reads 404 identically whether the id
    exists elsewhere or not.
  - **Security audit + fixes** — full SSN reachable via the onboarding webhook (**H1**,
    migration 030); CSV formula injection in the client export; blind SSRF via portal push
    subscription endpoints; API keys surviving plan downgrade/cancellation. See
    "Security Rules" for the invariants each one established.
  - **GHL field cross-contamination (real, caught pre-impact).** In a GHL location shared
    with TaxIntake Pro (`ti__*`) and Due Diligence Pro (`dd_*`), name-based auto-detect had
    mapped **"Equifax Score" → a field named "Equifax Password"** and **"SSN Last 4" → a
    *dependent's* SSN**. Zero clients had onboarded through it. Fixed by making the 9
    identity fields RTP-owned (`RTP_IDENTITY_FIELDS`) instead of agency-mapped, and
    hardening the score suggester (credential denylist, dependent/spouse exclusion,
    `NUMERICAL` type gate, `rtp__` preferred, **no guess when nothing passes**,
    propose-and-confirm instead of silent-fill, human-readable field names in the UI).
  - **Webhook auth.** Both GHL webhooks were **fail-open** (`if (secret) { check }`) and
    production had no secret set — unauthenticated writes were possible using only the
    `locationId` (which is not a secret). Now fail-closed with a **per-agency
    `webhook_token`** (migration 031) plus **tenant binding**, so a valid token for one
    agency cannot write into another.
  - Pipeline: 9th stage `round_3_plus_results`; `find-pipeline` prefers the RTP/CDP-prefixed
    pipeline; setup tools now `router.refresh()` so saved config stops rendering stale.
  - PWA install fix (manifest/`sw.js` were being auth-redirected by middleware).
- **Session 11 — staff-alert detail + portal-link rotation fix.**
  - **Staff alerts now tag the CLIENT's contact** (`staff_new_client`, `staff_round_overdue`,
    `staff_next_round_ready`), so the agency's GHL workflow finally has client merge fields to
    build a real message with; 3 new `rtp__alert_*` custom fields (28 total). **Breaking** for
    agencies that already built these 3 workflows — see the Notifications section. Also
    corrected this file's long-stale claim that notifications POST to an
    `agencies.settings.ghl_webhook_triggers` "Custom Webhook" URL — that design was replaced
    by the tag mechanism back in `cb32103` and no longer exists anywhere in the code.
  - **Portal magic links stopped rotating on every share** (`generatePortalLink` minted a new
    token on *every* call, and Copy Link / Send Email / Send SMS / onboarding sync all call it
    — so copying a link silently killed the one already in the client's inbox, and the portal
    then told them it had "expired"). Now reuses the existing token, replacing it only when
    missing/expired/<7 days left; rotation is opt-in via a new explicit **Regenerate link**
    action behind a confirm.
- **Session 12 — Staff in-app notifications + web push; 10 onboarding-details intake
  fields; hardening pass.**
  - **Staff notifications** (migrations 032/033): `staff_notifications` table (in-app
    feed, RLS-scoped, written only by the server-side notification pipeline) + staff web
    push (`push_subscriptions` extended with a nullable `client_id`/new `team_member_id`
    and an exactly-one-owner `CHECK`); both fire alongside the existing GHL-tag/Resend
    channel for the 4 staff-facing notification types (`notifyStaffChannels()`); a
    notification bell in the dashboard header (`api/notifications/*`) surfaces them.
  - **10 Onboarding Details intake fields** (migration 034): `credit_score_range`,
    `reviewed_credit_report_recently`, `negative_items_reported`, `enrolled_other_program`,
    `primary_goal`, `results_timeline`, `employment_status`, `bankruptcy_filed`,
    `bankruptcy_date`, `intake_concerns` — RTP-owned fixed GHL keys (28 → 38 total), read by
    the onboarding webhook, surfaced in an "Onboarding Details" card on client detail, the
    CSV export, and the Agency API's client endpoints.
  - **Hardening pass** (a full 4-phase audit — security / silent-failure sweep /
    doc-drift / logic-consistency): `signed_at`/`dob`/`bankruptcy_date` in the onboarding
    webhook now go through a validating `parseTimestamp()` instead of a raw
    `new Date(x).toISOString()` that could throw and abort the whole webhook for one bad
    field; the webhook's returning-client update path now checks its own query error and
    logs failures to `activity_log` instead of silently no-oping; the same
    unchecked-query-error pattern was found and fixed in `clients/[id]/rounds/actions.ts`
    (6 mutations) and `api/cron/auto-create-rounds/route.ts`. `ssn_last4` was also removed
    from the client CSV export (it had been present, unrelated to the onboarding fields).

## Outstanding (known, not yet done)
- **Onboarding form collects bureau credentials.** The live GHL onboarding form asks for
  full SSN, Experian/Equifax/TransUnion **logins, security-question answers, and PINs**,
  all landing in plaintext GHL custom fields. This is the largest remaining exposure and
  the root cause behind the field-mapping bugs above. The credential-free path already
  exists: enroll clients through the credit-monitoring provider (`src/lib/credit-monitoring/`)
  and pull reports by API instead of holding client passwords.
- **Per-agency GHL setup still manual.** GHL has **no public API to create or edit forms**,
  and creating a custom field does not populate it — so each agency must, by hand:
  (a) run *Create Custom Fields* (38 now — 10 Onboarding Details fields are new in Session 12);
  (b) point their GHL onboarding form at the `rtp__` identity fields;
  (c) repoint every `{{contact.cdp__*}}` merge tag → `{{contact.rtp__*}}` (else **blank**);
  (d) change every workflow **Tag Added** trigger `cdp-*` → `rtp-*` (else it **silently
  never fires** — no error, notifications just stop);
  (e) **rebuild the 3 staff-alert workflows** — they now trigger on the *client's* contact,
  so an SMS action still addressed to "Contact" will **text the client** (Session 11);
  (f) re-run *Find & Connect Pipeline* for the 9th stage;
  (g) re-copy their tokenized webhook URLs into GHL.
- **`staff_monthly_progress` still fires on the staff member's own contact** — it has the
  same "no client merge fields" limitation the other 3 staff alerts had before Session 11.
  Left out of that change deliberately (scoped to 3); moving it is a small, mechanical
  follow-up: add it to `CLIENT_TAGGED_STAFF_TYPES` and give it `buildNotificationFields` cases.
- **Low-severity, open:** plan-limit checks are check-then-act (concurrent imports can
  overshoot `max_clients`); the GHL onboarding webhook bypasses the plan limit entirely;
  Agency API rate limiting fails open if the counter query errors; a push subscription row
  can be taken over given a known endpoint URL (denial, not interception).

## Common Commands
```bash
npm run dev          # Start dev server (restart fully after editing middleware.ts)
npm run build        # Production build
npm run lint         # ESLint (React 19 rules: no Date.now()/setState-in-effect in render)
npx tsc --noEmit     # Type check
```

## Deploy
- Local branch is **`master`**; Vercel production branch is **`main`**.
  Deploy with `git push origin master:main`.
- Vercel **Hobby plan**: `maxDuration` may go up to **300s** (the old 60s cap is gone —
  `letters/generate` and `cron/retry-ghl-syncs` already use 300s). **Crons are daily-only.**
- Long/after-response work uses Next 16 `after()` (not bare `.catch()`), which
  survives the serverless response on Vercel.
- ⚠️ **Verify GHL-facing changes against a real GHL location, not just a green build.**
  GHL **silently ignores** writes to a non-existent field key and **silently never fires**
  a workflow whose trigger tag no longer matches — both look identical to success from
  the app side. Several bugs here shipped clean builds.

## Post-Rename Manual Steps (roundtrackpro.com)

The code rebrand (ClientDeck Pro → RoundTrack Pro) is done. These infrastructure
steps are manual and happen outside the codebase:

**Infrastructure (do after code is deployed):**
- [ ] Register `roundtrackpro.com` (~$12/yr)
- [ ] Register `roundtrack.pro` (brand protection, ~$10/yr)
- [ ] Add `roundtrackpro.com` to Vercel: Project → Settings → Domains
- [ ] Update `NEXT_PUBLIC_APP_URL` in Vercel env vars → `https://roundtrackpro.com` (redeploy after)
- [ ] Update Google OAuth redirect URIs:
  - Add: `https://roundtrackpro.com/api/google-drive/callback`
  - Keep: `https://clientdeck-pro.vercel.app/api/google-drive/callback` (keep working)
- [ ] Update Supabase Auth redirect URLs: Auth → URL Configuration → add `roundtrackpro.com`
- [ ] Update Resend sender domain once `roundtrackpro.com` DNS is set up

**Email/comms:**
- [ ] Create `support@roundtrackpro.com` (Google Workspace or similar)
- [ ] Add `roundtrackpro.com` in Resend → Domains
- [ ] Update email signatures

**Redirects (keep old URLs working):**
- [ ] `clientdeck-pro.vercel.app` stays working automatically (Vercel project unchanged)
- [ ] If `clientdeckpro.com` was registered, add a Vercel redirect → `roundtrackpro.com`

**Existing GHL agencies (notify beta users):**
- [ ] Update webhook URLs in their Settings → GHL (`.../api/ghl/webhook`, `.../api/ghl/onboarding`) to `roundtrackpro.com`
- [ ] GHL custom fields renamed to `rtp__*` (names "RTP - ...") — **re-run Create Custom Fields, then repoint merge tags + the onboarding form**
- [ ] GHL notification tags renamed to `rtp-*` — **update every workflow Tag-Added trigger**
- [ ] Webhooks now authenticate with the per-agency token in the URL (`?secret=`) — re-copy both URLs from Settings → GHL
- [ ] **Rebuild the 3 staff-alert workflows (Session 11).** They now trigger on the
      **client's** contact, not the owner's. The tag names and Tag-Added trigger are
      unchanged, so the workflow still fires — but if its SMS action is still addressed to
      "Contact", the staff alert now **texts the client**. Repoint each to a fixed staff
      number and rewrite the copy using the client merge fields (`/onboarding/ghl-setup`
      lists them). The 7 client-facing alerts are unaffected.

**Not changed (intentionally):** GitHub repo URL, Supabase project name, Vercel
project name (`clientdeck-pro`), and DB schema/table/column names. Rename these later if desired.
