# RoundTrack Pro — CLAUDE.md

## Project Overview
RoundTrack Pro is a B2B SaaS dispute management platform for credit repair agencies. It provides AI-powered letter generation, dispute round tracking, a client portal, and native GoHighLevel (GHL) CRM integration. Built as a white-label multi-tenant system where each agency gets their own branded experience.

**Domain:** roundtrackpro.com
**Tagline:** "The dispute management platform built for GoHighLevel credit repair agencies"
**Short tagline:** "Run every dispute round from one connected platform."
**Positioning:** "Practice management software for credit professionals" — NOT credit repair software (legal distinction).

> **Rename note (2026-07-10):** The product was renamed from **ClientDeck Pro → RoundTrack Pro** (domain `clientdeckpro.com → roundtrackpro.com`). This was a branding-only change — no schema, API, or logic changes. GHL custom-field keys (`cdp__*`), notification tags (`cdp-*`), the `cdp_admin_session` cookie, and the `x-clientdeck-secret` webhook header **intentionally keep their old identifiers** for backward compatibility with live agency GHL installs. See the "Post-Rename Manual Steps" section at the bottom.

## Tech Stack
- **Framework:** Next.js 16 (App Router, React 19, TypeScript, `src/` directory)
- **Styling:** Tailwind CSS (dark/professional theme, blue accent `#2563EB`)
- **Database:** Supabase (PostgreSQL with Row Level Security)
- **Auth:** Supabase Auth (email/password for agencies, magic links for client portal). Super-admin `/admin` uses a **standalone password + cookie**, NOT Supabase Auth.
- **AI:** Claude API (Sonnet 4.6) for dispute letter generation
- **Payments:** Stripe (subscriptions + customer portal) + manual/off-platform payment recording via admin
- **CRM Sync:** GoHighLevel API v2 (two-way webhook sync + native onboarding flow)
- **Document backup:** Google Drive — per-agency OAuth (`drive.file` scope), non-blocking sync
- **Hosting:** Vercel (Hobby plan — function `maxDuration` capped at 60s)
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
(auth)/          — Login, signup (agency staff)
(dashboard)/     — Main app (protected, requires Supabase auth)
  clients/       — Client list, detail, items, rounds, letters, docs, signature
  templates/     — AI letter template management
  reports/       — Analytics dashboards
  team/          — Staff management (+ plan-based member limit)
  settings/      — General, GHL config + field mapping, Documents (Drive), branding, billing
(admin)/admin/   — Super-admin panel (password/cookie auth, cross-agency, force-dynamic)
(admin-auth)/    — /admin/login (unguarded, separate route group)
portal/          — Client-facing portal (magic link auth, white-labeled)
api/
  ghl/           — webhook (inbound), onboarding (native flow), sync, send-signature-request
  google-drive/  — connect, callback, disconnect, backfill
  admin/         — logout, agencies/[id] (panel data), tools/* (GHL fields/pipelines/sync/welcome)
  letters/, stripe/, portal/, cron/, settings/
```

**Route-group URL note:** the `(dashboard)` and `(admin)` groups are erased from the
URL — pages live at `/clients`, `/settings/ghl`, `/admin`, etc. (NOT `/dashboard/...`).

### Key Flows
1. **Client Intake:** GHL webhook → auto-create client in app OR manual creation
2. **GHL-Native Onboarding:** Lead pays → GHL onboarding form (+ e-signature) → tag `rtp-onboarding-completed` fires webhook → `/api/ghl/onboarding` pulls the contact, upserts the client (identity/docs from the fixed `cdp__*` keys; scores from the `ghl_field_keys` mapping), generates the portal link, syncs docs to Drive + writes back to GHL. Always returns 200 to GHL.
3. **Dispute Round:** Select items → generate letters with Claude → review/edit → finalize → export PDF → mark sent → GHL sync + Drive letter backup fires
4. **Results Logging:** Staff logs results per item → deletions update client stats → GHL gets win notification
5. **Client Portal:** Magic link via SMS (GHL workflow) → score chart, progress timeline, document upload (mirrored to Drive)

## Database Tables (Supabase)
- `agencies` — SaaS customers. Incl. `ghl_field_keys` (JSONB — **bureau scores ONLY** since Session 10), `google_drive_*` (OAuth tokens/email/root folder), `ghl_api_key`, `webhook_token` (**per-agency inbound webhook credential**, migration 031 — secret, never sent to the browser except inside that agency's own webhook URL), `credit_monitoring_service`/`credit_monitoring_api_key`/`credit_monitoring_api_secret` (Agency-plan credit monitoring, migration 017), `custom_domain`/`custom_domain_verified` (migration 026), `max_clients`, `plan`/`plan_status`, `settings` (JSONB: onboarding_steps, admin_notes, `ghl_pipeline_id`/`ghl_pipeline_stages`, etc.)
- `team_members` — Staff accounts linked to agencies (roles: owner/admin/staff/viewer)
- `clients` — End-clients. Incl. signature fields (`signature_status`, `signed_at`, `signature_type`, `service_agreement_version`), `onboarding_form_submitted`, `ghl_drive_folder_id`, `portal_token`, `ghl_opportunity_id` (cached GHL pipeline opportunity id, migration 016), `ssn_last4` (**CHECK-constrained to exactly 4 digits**, migration 030)
- `agency_api_keys` — Agency API keys: `key_hash` (sha256), `key_prefix` (display), `revoked_at` (migration 027)
- `api_rate_limits` — Fixed-window counter for the Agency API, 100 req/hr per key (migration 029)
- `push_subscriptions` — Web Push subscriptions for the portal PWA (migration 022)
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
**031 agency_webhook_token** (per-agency inbound webhook credential)

## Key Libraries & Locations
- `src/lib/supabase/{client,server,admin}.ts` — browser / SSR / service-role clients
- `src/lib/claude/generate-letter.ts` — AI letter generation (single + bulk)
- `src/lib/ghl/api.ts` — GHL API v2 wrapper (contacts, tags, pipeline, tasks, custom fields, pipelines, opportunity find-or-create)
- `src/lib/ghl/webhook.ts` — Inbound GHL webhook handler
- `src/lib/ghl/webhook-auth.ts` — **inbound webhook auth (Session 10).** `verifyGhlWebhook()` (per-agency `webhook_token`, falling back to the legacy global `GHL_WEBHOOK_SECRET` if still set) + `locationBelongsToAgency()` (tenant binding). **Fails closed.**
- `src/lib/ghl/field-detect.ts` — hardened score-field suggester (Session 10; propose-only, never saves)
- `src/lib/ghl/field-status.ts` — resolves GHL field keys → human names; reports which identity fields exist
- `src/lib/api/{auth,log,clients}.ts` — Agency API: key hashing + Bearer auth + rate limit + plan entitlement; `activity_log` writer; shared client field scope
- `src/lib/push/{send,endpoint}.ts` — Web Push sender + **push-service endpoint allowlist** (SSRF guard)
- `src/lib/vercel/domains.ts` — Vercel Domains API wrapper (custom portal domains)
- `src/lib/ghl/notifications.ts` — GHL webhook notification service (10 `GHLNotificationType`s → agency's own GHL workflow, Resend email fallback, log-only no-op; never throws)
- `src/lib/ghl/pipeline.ts` — best-effort GHL opportunity/pipeline-stage sync (`moveClientPipelineStage`)
- `src/lib/google-drive/{auth,client,sync,letter-sync}.ts` — OAuth, Drive API, non-blocking sync
- `src/lib/admin/session.ts` — super-admin password/cookie auth (`cdp_admin_session`)
- `src/lib/admin/{mrr,avatar,agency-panel,tool-helpers}.ts` — admin dashboard helpers
- `src/lib/billing/plans.ts` — **single source of truth for plans/pricing/limits**
- `src/lib/team/limits.ts` — team-member limit enforcement
- `src/lib/utils/{helpers,license,portal-token}.ts` — formatting, license, portal links
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
- **Inbound webhook auth (Session 10):** both inbound webhooks authenticate with the agency's own `agencies.webhook_token`, passed as `?secret=<token>` (or the `x-clientdeck-secret` / `x-wh-secret` header). Settings → GHL renders each agency's tokenized URL for copy-paste — **the URL is a live credential**. Auth **fails closed**, and the request is **tenant-bound**: the payload's `locationId` must belong to the token's agency, otherwise a valid token for agency A could write into agency B. The old global `GHL_WEBHOOK_SECRET` is still accepted *if set* (legacy migration path) but identifies no agency and so can't be tenant-bound — **keep it unset**. Rejections return **200** with `processed: false` (GHL retry-storms on non-2xx), so a misconfigured URL **fails silently** — verify with a real contact edit, not by looking for errors in GHL.
- **Inbound webhook URL:** `/api/ghl/webhook` — handles ContactCreate, ContactUpdate, ContactTagUpdate. ⚠️ `ContactCreate` creates a RoundTrack client for **every** contact it receives — in a GHL location shared with other products, trigger it from a *targeted* workflow, never a blanket "contact created".
- **Onboarding webhook:** `/api/ghl/onboarding` — trigger from GHL on tag `rtp-onboarding-completed` (`ONBOARDING_COMPLETE_TAG` in `notification-tags.ts`; namespaced because a bare `onboarding-complete` is a common tag in credit-repair GHL accounts and another product's workflow adding it would create clients here. **Nothing in the code reads the tag** — the route acts on whatever `contactId`/`locationId` it is POSTed; the tag is purely the GHL-side trigger). This is the primary client-creation path. Upserts the client (identity/docs from the fixed `cdp__*` keys; scores from `ghl_field_keys`), generates the portal link, syncs docs to Drive + writes `clientdeck_client_id`/`clientdeck_portal_link` back. Heavy work runs in Next `after()`; always 200.
- **Signature request:** `/api/ghl/send-signature-request` — adds tag `signature-requested` to fire the agency's GHL form workflow.
- **Outbound sync:** Uses per-agency `ghl_api_key` stored in `agencies` table
- **Sync events:** Round sent → pipeline move (`round_N_sent`) + tag + note. Results logged → pipeline move (`round_N_results`). Deletion → tag + field update. Score update → custom fields. Completion → `goal_achieved` stage + tag.
- **GHL custom fields — single source of truth is `src/lib/ghl/field-keys.ts`.** GHL derives a field's stored key from its NAME ("CDP - Portal Link" → `cdp__portal_link`; the `" - "` collapses to a **double** underscore). The setup tool (`CDP_ALL_CUSTOM_FIELDS` in `setup-config.ts`) creates **25** fields in three groups:
  - **9 core tracking** (`CDP_CUSTOM_FIELDS`): `cdp__round_number`, `cdp__items_deleted`, `cdp__total_items`, `cdp__next_dispute_date`, `cdp__eq_score`, `cdp__exp_score`, `cdp__tu_score`, `cdp__portal_link`, `cdp__client_id`
  - **7 notification** (`CDP_NOTIFICATION_FIELDS`): `cdp__items_disputed`, `cdp__deletions_this_round`, `cdp__deleted_items_list`, `cdp__score_improvement`, `cdp__monthly_fee`, `cdp__agency_phone`, `cdp__google_review_link`
  - **9 identity/intake** (`CDP_IDENTITY_FIELDS`, Session 10 — the **read** side): `cdp__ssn_last_4` (TEXT — note `_last_4`, since "CDP - SSN Last 4" turns *each* space into an underscore), `cdp__dob` (DATE), `cdp__signature_status` (TEXT), `cdp__signature_date` (DATE), `cdp__id_document`, `cdp__proof_of_address`, `cdp__credit_report_eq`, `cdp__credit_report_exp`, `cdp__credit_report_tu` (all FILE_UPLOAD)

  > **Note:** earlier revisions of this file listed names like `dispute_round_current` / `credit_score_eq_current` / `clientdeck_portal_link`. Those were **never** the real keys — always trust `field-keys.ts`.

- **Field mapping (`agencies.ghl_field_keys` JSONB) — scores ONLY.** Only `score_eq` / `score_exp` / `score_tu` are agency-configurable (Settings → GHL), because an agency captures starting scores on its own intake form. Everything identity-related is read from the fixed `cdp__*` keys above.

  **Why (Session 10):** these 9 were previously agency-mapped by name via `field-detect.ts`. In a live GHL location shared with TaxIntake Pro (`ti__*`) and Due Diligence Pro (`dd_*`), auto-detect resolved **"Equifax Score" → a field named "Equifax Password"**, **"SSN Last 4" → a *dependent's* SSN**, and "Proof of Address" → a yes/no radio. Caught before any client onboarded through it. Fixed keys make the collision structurally impossible. Auto-detect (scores only) is now **propose-and-confirm** and gated: credential denylist (password/login/PIN/secret), dependent/spouse exclusion, `NUMERICAL`-type requirement, `cdp__` preferred over `dd_`/`ti__`, and **no guess when nothing passes**.

  ⚠️ Creating the identity fields does **not** populate them — each agency must point their own GHL onboarding form/workflow at the new `cdp__` fields. Surfaced by the `IdentityFieldsNotice` banner in Settings → GHL.

## GHL Notifications & Pipeline Sync (Session 6)
- **Independent channel, additive to outbound sync above.** `src/lib/ghl/notifications.ts` POSTs to an agency-configured GHL "Custom Webhook" trigger URL per event (`agencies.settings.ghl_webhook_triggers`, one URL per `GHLNotificationType`), falling back to Resend email (only 4 of 10 types have a template — `round_sent`/`deletion_win`/`goal_achieved`/`payment_failed`), falling back to a log-only no-op. Every send is logged to `activity_log` (`action: "notification_sent"`) and never throws past its caller.
- **10 notification types**, each wired into one event: `round_sent`, `deletion_win`, `round_results_in` (round lifecycle), `goal_achieved` (client completed), `payment_failed` (Stripe webhook — client's own `stripe_customer_id`, distinct from the agency's SaaS subscription), `portal_link` (regeneration), `staff_new_client` (onboarding webhook), `staff_round_overdue` / `staff_next_round_ready` (crons), `monthly_progress` (new monthly cron, `/api/cron/monthly-progress`, `0 9 1 * *`). Staff-facing types need `agencies.settings.owner_ghl_contact_id` configured.
- **Configure at Settings → GHL:** "Notification Webhooks" (per-type URL + Test button, backed by `/api/ghl/test-webhook`), "Pipeline Configuration", and a link to the full setup guide at `/onboarding/ghl-setup`.
- **Pipeline-stage sync** (`src/lib/ghl/pipeline.ts`, `moveClientPipelineStage`): moves a client's GHL opportunity through the **9-stage** "Active Client" pipeline — `analysis`, `ready_to_dispute`, `round_1_sent`, `round_1_results`, `round_2_sent`, `round_2_results`, `round_3_plus`, `round_3_plus_results`, `goal_achieved` (configured via `agencies.settings.ghl_pipeline_id`/`ghl_pipeline_stages`; labels + `stageForRoundSent`/`stageForRoundResults`/`stageForClientState` helpers live in `pipeline.ts`). Wired into round events in `clients/[id]/rounds/actions.ts` (round sent → `round_N_sent`, results logged → `round_N_results`, completion → `goal_achieved`); lazily finds-or-creates the opportunity via `findOrCreateGHLOpportunity()`, caching it on `clients.ghl_opportunity_id`. New clients are placed in `analysis` at onboarding; `/api/ghl/setup/create-opportunities` backfills opportunities for all synced clients; `/api/ghl/setup/find-pipeline` auto-maps stage ids by name (GHL never exposes stage ids in its UI — this tool is the only way to get them) and **prefers a `CDP - ` prefixed pipeline** over any other name containing "active client". Best-effort, no-ops cleanly if unconfigured; unmapped stages just no-op. (Session 6; 3 → 8 stages in Session 8; rounds 3+ gained their own results stage in Session 10.)
  - `PipelineStageKey` (pipeline.ts) and `AgencySettings.ghl_pipeline_stages` (types/index.ts) duplicate the same key union — they can't import each other (circular). A **compile-time assertion in `pipeline.ts` makes any drift a build error**; don't "fix" it by deleting the assertion.
  - After changing the stage model, agencies must **re-run Find & Connect Pipeline** — existing `ghl_pipeline_stages` rows won't contain the new key until they do.
- **Visibility:** client Timeline tab shows a "✓ GHL" / "⚠ Email fallback" badge on notification entries; admin agency slide-over's GHL Config tab shows a 10-row configured/not-set breakdown.

## Credit Monitoring Integration (Session 7)
- **Gated to the Agency plan** via `isAgencyPlanOrHigher()` (`src/lib/billing/plans.ts`) — Starter/Pro agencies see an upgrade-gate card at Settings → Credit Monitoring instead of the connection form, and `/api/credit-monitoring/pull` returns 403 for non-Agency agencies.
- **Three provider adapters** under `src/lib/credit-monitoring/` (`myfreescorenow.ts`, `identityiq.ts`, `smartcredit.ts`, dispatched via `index.ts`'s `pullCreditScores()`/`testConnection()`) — each carries a standing `TODO: Verify endpoint URL and field names` comment; these are unverified placeholder API calls pending real partner API docs, not confirmed integrations.
- **`credit_monitoring_pulls`** (migration 017) — per-pull audit row (`agency_id`, `client_id`, `service`, scores, `status`/`error_message`, `raw_response`). Credentials live on `agencies.credit_monitoring_service`/`_api_key`/`_api_secret`.
- **Settings tab** at Settings → Credit Monitoring: provider select + API key/secret fields (cleared on provider change), Test Connection button. **Pull Scores button** lives on client detail — calls `/api/credit-monitoring/pull`, writes `score_history`, and syncs the GHL score custom fields. An opt-in auto-pull (`settings.auto_pull_scores`) also fires non-blocking from the GHL onboarding webhook for newly onboarded clients.
- Also surfaced in Reports ("Credit Score Analytics" section) and the admin agency slide-over (status + test-connection tool, `/api/admin/tools/test-credit-monitoring`).

## Super-Admin Panel (`/admin`)
- **Auth is standalone** — password (`ADMIN_PASSWORD`) → SHA-256 → httpOnly `cdp_admin_session` cookie. NO Supabase Auth. Middleware lets all `/admin/*` through; `(admin)/layout.tsx` guards via `requireAdmin()`; `/admin/login` lives in a separate `(admin-auth)` group. `ADMIN_EMAIL` is only an optional audit label.
- **Features:** dashboard (agencies, MRR, pending-setup), agency **slide-over panel** (Status / GHL Config / Tools / Branding / Payments), Pending Setup queue, manual payments, snapshot requests, activity + system health (Supabase/Vercel/GHL sync failures).
- **GHL setup tools** (`/api/admin/tools/*`): create 9 custom fields, create pipelines (best-effort), sync clients, resend welcome email.
- All admin reads use `createAdminClient()` (service role, cross-agency).

## Google Drive Integration
- **Per-agency OAuth** (`drive.file` + `userinfo.email` scopes). Tokens on `agencies.google_drive_*`. Connect at Settings → Documents.
- **Folder layout:** `RoundTrack Pro / {Client Name} / {Onboarding | Round_N | Bureau_Responses | Client_Uploads | Letters}`.
- **ALWAYS non-blocking** via `syncDocumentToDrive()` (swallows errors, returns null if not connected). Triggered by: onboarding docs, round-sent letter PDFs (regenerated), portal uploads, and the Settings → Documents **backfill** button.
- Requires `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` + redirect URI `{APP_URL}/api/google-drive/callback` (see README).

## Plans & Pricing (`src/lib/billing/plans.ts` — single source of truth)
- **Starter** $49/mo — 100 clients, 2 team members (internal plan id stays `solo`)
- **Pro** $129/mo — 700 clients, 5 team members
- **Agency** $249/mo — unlimited clients + team, API/custom domain, removes branding
- `enterprise` — provisioned manually. Limits enforced via `maxClientsForPlan()` / `maxTeamMembersForPlan()` and stored on `agencies.max_clients`.

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
- Portal uses `portal_token` (random 64-char hex) with expiry — NOT Supabase Auth
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
  **Zero** schema/API/logic changes. Intentionally preserved for backward
  compatibility with live GHL installs: `cdp__*` field keys, `cdp-*` notification
  tags, the `cdp_admin_session` cookie, theme/view storage keys, and the
  `x-clientdeck-secret` webhook header. GHL field NAMES keep the `"CDP - "`
  prefix because GHL derives the stored `cdp__` key from the name — renaming to
  `"RTP - "` would generate `rtp__` keys and break the mapping (see the REBRAND
  NOTE comments in `field-keys.ts`/`setup-config.ts`). See "Post-Rename Manual
  Steps" below for the outstanding infra/domain cutover checklist.
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
    identity fields RTP-owned (`CDP_IDENTITY_FIELDS`) instead of agency-mapped, and
    hardening the score suggester (credential denylist, dependent/spouse exclusion,
    `NUMERICAL` type gate, `cdp__` preferred, **no guess when nothing passes**,
    propose-and-confirm instead of silent-fill, human-readable field names in the UI).
  - **Webhook auth.** Both GHL webhooks were **fail-open** (`if (secret) { check }`) and
    production had no secret set — unauthenticated writes were possible using only the
    `locationId` (which is not a secret). Now fail-closed with a **per-agency
    `webhook_token`** (migration 031) plus **tenant binding**, so a valid token for one
    agency cannot write into another.
  - Pipeline: 9th stage `round_3_plus_results`; `find-pipeline` prefers the `CDP - `
    pipeline; setup tools now `router.refresh()` so saved config stops rendering stale.
  - PWA install fix (manifest/`sw.js` were being auth-redirected by middleware).

## Outstanding (known, not yet done)
- **Onboarding form collects bureau credentials.** The live GHL onboarding form asks for
  full SSN, Experian/Equifax/TransUnion **logins, security-question answers, and PINs**,
  all landing in plaintext GHL custom fields. This is the largest remaining exposure and
  the root cause behind the field-mapping bugs above. The credential-free path already
  exists: enroll clients through the credit-monitoring provider (`src/lib/credit-monitoring/`)
  and pull reports by API instead of holding client passwords.
- **Per-agency GHL setup still manual:** each agency must (a) run *Create Custom Fields*,
  (b) point their GHL onboarding form at the new `cdp__` identity fields (creating them does
  **not** populate them), (c) re-run *Find & Connect Pipeline* for the 9th stage, and
  (d) re-copy their tokenized webhook URLs into GHL.
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
- Vercel **Hobby plan**: function `maxDuration` must be ≤ 60s; crons are daily-only.
- Long/after-response work uses Next 16 `after()` (not bare `.catch()`), which
  survives the serverless response on Vercel.

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
- [ ] GHL custom fields keep the `cdp__` key prefix — **no action needed** (field NAMES stay "CDP - ...")
- [ ] GHL notification tags keep the `cdp-` prefix — **no action needed**
- [ ] The `x-clientdeck-secret` webhook header is unchanged — **no action needed**
- [ ] Only the webhook URL (domain) needs updating on the agency side

**Not changed (intentionally):** GitHub repo URL, Supabase project name, Vercel
project name (`clientdeck-pro`), DB schema/table/column names, the `cdp_*`/`cdp-*`
code identifiers, and `x-clientdeck-secret`. Rename these later if desired.
