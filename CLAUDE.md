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
2. **GHL-Native Onboarding:** Lead pays → GHL onboarding form (+ e-signature) → tag `onboarding-complete` fires webhook → `/api/ghl/onboarding` pulls the contact, upserts the client (via `ghl_field_keys` mapping), generates the portal link, syncs docs to Drive + writes back to GHL. Always returns 200 to GHL.
3. **Dispute Round:** Select items → generate letters with Claude → review/edit → finalize → export PDF → mark sent → GHL sync + Drive letter backup fires
4. **Results Logging:** Staff logs results per item → deletions update client stats → GHL gets win notification
5. **Client Portal:** Magic link via SMS (GHL workflow) → score chart, progress timeline, document upload (mirrored to Drive)

## Database Tables (Supabase)
- `agencies` — SaaS customers. Incl. `ghl_field_keys` (JSONB GHL field map), `google_drive_*` (OAuth tokens/email/root folder), `ghl_api_key`, `credit_monitoring_service`/`credit_monitoring_api_key`/`credit_monitoring_api_secret` (Agency-plan credit monitoring, migration 017), `max_clients`, `plan`/`plan_status`, `settings` (JSONB: onboarding_steps, admin_notes, etc.)
- `team_members` — Staff accounts linked to agencies (roles: owner/admin/staff/viewer)
- `clients` — End-clients. Incl. signature fields (`signature_status`, `signed_at`, `signature_type`, `service_agreement_version`), `onboarding_form_submitted`, `ghl_drive_folder_id`, `portal_token`, `ghl_opportunity_id` (cached GHL pipeline opportunity id, migration 016)
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
016 ghl_opportunity_id · 017 credit_monitoring ·
**018 security_hardening** (adds the missing `documents` UPDATE RLS policy)

## Key Libraries & Locations
- `src/lib/supabase/{client,server,admin}.ts` — browser / SSR / service-role clients
- `src/lib/claude/generate-letter.ts` — AI letter generation (single + bulk)
- `src/lib/ghl/api.ts` — GHL API v2 wrapper (contacts, tags, pipeline, tasks, custom fields, pipelines, opportunity find-or-create)
- `src/lib/ghl/webhook.ts` — Inbound GHL webhook handler
- `src/lib/ghl/field-detect.ts` — heuristic GHL custom-field → CDP key mapping (auto-detect)
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
- **Inbound webhook URL:** `/api/ghl/webhook` — handles ContactCreate, ContactUpdate, ContactTagUpdate
- **Onboarding webhook:** `/api/ghl/onboarding` — trigger from GHL on tag `onboarding-complete`. Upserts client from contact + `ghl_field_keys`, generates portal link, syncs docs to Drive + writes `clientdeck_client_id`/`clientdeck_portal_link` back. Heavy work runs in Next `after()`; always 200.
- **Signature request:** `/api/ghl/send-signature-request` — adds tag `signature-requested` to fire the agency's GHL form workflow.
- **Outbound sync:** Uses per-agency `ghl_api_key` stored in `agencies` table
- **Sync events:** Round sent → pipeline move (`round_N_sent`) + tag + note. Results logged → pipeline move (`round_N_results`). Deletion → tag + field update. Score update → custom fields. Completion → `goal_achieved` stage + tag.
- **GHL custom fields** the snapshot expects: `dispute_round_current`, `items_deleted_total`, `total_negative_items`, `next_dispute_date`, `credit_score_eq_current`, `credit_score_exp_current`, `credit_score_tu_current`, `clientdeck_portal_link`, `clientdeck_client_id`
- **Field mapping (`agencies.ghl_field_keys` JSONB):** because GHL field IDs are unique per location, each agency maps its keys (SSN, DOB, scores, signature status/date, credit-report/ID/proof-of-address uploads) in Settings → GHL. Manual entry or heuristic "Auto-detect" (`field-detect.ts`).

## GHL Notifications & Pipeline Sync (Session 6)
- **Independent channel, additive to outbound sync above.** `src/lib/ghl/notifications.ts` POSTs to an agency-configured GHL "Custom Webhook" trigger URL per event (`agencies.settings.ghl_webhook_triggers`, one URL per `GHLNotificationType`), falling back to Resend email (only 4 of 10 types have a template — `round_sent`/`deletion_win`/`goal_achieved`/`payment_failed`), falling back to a log-only no-op. Every send is logged to `activity_log` (`action: "notification_sent"`) and never throws past its caller.
- **10 notification types**, each wired into one event: `round_sent`, `deletion_win`, `round_results_in` (round lifecycle), `goal_achieved` (client completed), `payment_failed` (Stripe webhook — client's own `stripe_customer_id`, distinct from the agency's SaaS subscription), `portal_link` (regeneration), `staff_new_client` (onboarding webhook), `staff_round_overdue` / `staff_next_round_ready` (crons), `monthly_progress` (new monthly cron, `/api/cron/monthly-progress`, `0 9 1 * *`). Staff-facing types need `agencies.settings.owner_ghl_contact_id` configured.
- **Configure at Settings → GHL:** "Notification Webhooks" (per-type URL + Test button, backed by `/api/ghl/test-webhook`), "Pipeline Configuration", and a link to the full setup guide at `/onboarding/ghl-setup`.
- **Pipeline-stage sync** (`src/lib/ghl/pipeline.ts`, `moveClientPipelineStage`): moves a client's GHL opportunity through the **8-stage** "Active Client" pipeline — `analysis`, `ready_to_dispute`, `round_1_sent`, `round_1_results`, `round_2_sent`, `round_2_results`, `round_3_plus`, `goal_achieved` (configured via `agencies.settings.ghl_pipeline_id`/`ghl_pipeline_stages`; labels + `stageForRoundSent`/`stageForRoundResults`/`stageForClientState` helpers live in `pipeline.ts`). Wired into round events in `clients/[id]/rounds/actions.ts` (round sent → `round_N_sent`, results logged → `round_N_results`, completion → `goal_achieved`); lazily finds-or-creates the opportunity via `findOrCreateGHLOpportunity()`, caching it on `clients.ghl_opportunity_id`. New clients are placed in `analysis` at onboarding; `/api/ghl/setup/create-opportunities` backfills opportunities for all synced clients (each in the stage matching its progress); `/api/ghl/setup/find-pipeline` auto-maps stage ids by name. Best-effort, no-ops cleanly if unconfigured. **Requires the agency's GHL "Active Client" pipeline to actually contain all 8 stages** — unmapped stages just no-op. (Session 6; expanded from 3 to 8 stages in Session 8.)
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
- NEVER store full SSN — only `ssn_last4`
- NEVER store raw credit report data in the database
- RLS on every table — `agency_id` isolation enforced at DB level
- Portal uses `portal_token` (random 64-char hex) with expiry — NOT Supabase Auth
- GHL API keys stored in `agencies` table — encrypted at rest by Supabase
- All webhook endpoints verify source (GHL signature, Stripe signature)

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
GHL_WEBHOOK_SECRET
RESEND_API_KEY                         # emails logged to console if empty
CRON_SECRET
PORTAL_TOKEN_SECRET
ADMIN_PASSWORD                         # super-admin /admin login (required for admin access)
ADMIN_EMAIL                            # optional audit label only
GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET  # Google Drive OAuth (Drive no-ops if unset)
```
> Vercel env changes only apply to the **next deployment** — redeploy after editing.

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
