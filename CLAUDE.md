# ClientDeck Pro — CLAUDE.md

## Project Overview
ClientDeck Pro is a B2B SaaS dispute management platform for credit repair agencies. It provides AI-powered letter generation, dispute round tracking, a client portal, and native GoHighLevel (GHL) CRM integration. Built as a white-label multi-tenant system where each agency gets their own branded experience.

**Domain:** clientdeckpro.com
**Positioning:** "Practice management software for credit professionals" — NOT credit repair software (legal distinction).

## Tech Stack
- **Framework:** Next.js 14 (App Router, TypeScript, `src/` directory)
- **Styling:** Tailwind CSS (dark/professional theme, blue accent `#2563EB`)
- **Database:** Supabase (PostgreSQL with Row Level Security)
- **Auth:** Supabase Auth (email/password for agencies, magic links for client portal)
- **AI:** Claude API (Sonnet 4.6) for dispute letter generation
- **Payments:** Stripe (subscriptions + customer portal)
- **CRM Sync:** GoHighLevel API v2 (two-way webhook sync)
- **Hosting:** Vercel
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
(dashboard)/     — Main app (protected, requires auth)
  clients/       — Client list, detail, items, rounds, letters, docs
  templates/     — AI letter template management
  reports/       — Analytics dashboards
  team/          — Staff management
  settings/      — Agency profile, GHL config, billing, branding
portal/          — Client-facing portal (magic link auth, white-labeled)
api/             — API routes (GHL webhooks, letter generation, Stripe, etc.)
```

### Key Flows
1. **Client Intake:** GHL webhook → auto-create client in app OR manual creation
2. **Dispute Round:** Select items → generate letters with Claude → review/edit → finalize → export PDF → mark sent → GHL sync fires
3. **Results Logging:** Staff logs results per item → deletions update client stats → GHL gets win notification
4. **Client Portal:** Magic link via SMS (GHL workflow) → score chart, progress timeline, document upload

## Database Tables (Supabase)
- `agencies` — SaaS customers (credit repair businesses)
- `team_members` — Staff accounts linked to agencies
- `clients` — Credit repair end-clients (with scores, status, portal token)
- `negative_items` — Items on credit reports to dispute (per bureau)
- `dispute_rounds` — Round lifecycle (preparing → sent → awaiting → complete)
- `disputes` — Individual item disputes within a round (with AI-generated letter content)
- `letter_templates` — AI prompt templates (system defaults + agency custom)
- `documents` — File uploads (IDs, reports, letters) via Supabase Storage
- `activity_log` — Full audit trail

## Key Libraries & Locations
- `src/lib/supabase/client.ts` — Browser Supabase client
- `src/lib/supabase/server.ts` — Server-side Supabase client (SSR)
- `src/lib/supabase/admin.ts` — Service role client (bypasses RLS)
- `src/lib/claude/generate-letter.ts` — AI letter generation (single + bulk)
- `src/lib/ghl/api.ts` — GHL API v2 wrapper (contacts, tags, pipeline, tasks)
- `src/lib/ghl/webhook.ts` — Inbound GHL webhook handler
- `src/lib/utils/helpers.ts` — Formatting, status colors, letter type logic
- `src/lib/utils/license.ts` — License key validation
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

## GHL Integration Details
- **Inbound webhook URL:** `/api/ghl/webhook` — handles ContactCreate, ContactUpdate, ContactTagUpdate
- **Outbound sync:** Uses per-agency `ghl_api_key` stored in `agencies` table
- **Sync events:** Round sent → pipeline move + tag + note. Deletion → tag + field update. Score update → custom fields. Completion → goal-achieved tag.
- **GHL custom fields** the snapshot expects: `dispute_round_current`, `items_deleted_total`, `total_negative_items`, `next_dispute_date`, `credit_score_eq_current`, `credit_score_exp_current`, `credit_score_tu_current`, `clientdeck_portal_link`, `clientdeck_client_id`

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
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_PRICE_SOLO
STRIPE_PRICE_PRO
STRIPE_PRICE_AGENCY
GHL_WEBHOOK_SECRET
RESEND_API_KEY
NEXT_PUBLIC_APP_URL
PORTAL_TOKEN_SECRET
```

## Build Phases (Current: Week 1)
- Week 1: Foundation (schema, auth, layout, settings) ← CURRENT
- Week 2: Client & item management + GHL inbound webhooks
- Week 3: Dispute rounds + AI letter generation
- Week 4: Round lifecycle + results logging + GHL outbound sync
- Week 5: Client portal (magic link, dashboard, timeline, docs)
- Week 6: GHL snapshot + dashboard analytics + polish
- Week 7: Beta with Jetlag Recovery + landing page + launch

## Common Commands
```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
npx tsc --noEmit     # Type check
```
