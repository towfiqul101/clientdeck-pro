---
name: verify
description: How to build, launch, and drive ClientDeck Pro locally to verify changes at the running-app surface
---

# Verifying ClientDeck Pro changes

## Launch

- `npm run build` then `npx next start -p 3001` — use a non-3000 port; the user
  usually has `next dev` running on 3000 and Next 16 refuses a second dev
  server for the same directory (`next start` does not conflict).
- Env comes from `.env.local` (Supabase URL/keys, `GHL_WEBHOOK_SECRET`, etc.).
  Extra vars (e.g. `ADMIN_PASSWORD`) can be set inline when starting:
  `$env:ADMIN_PASSWORD='...'; npx next start -p 3001`.
- Server is ready when `GET /login` returns 200 (a few seconds).

## Drive surfaces

- **GHL webhooks** (unauthenticated surface): `POST /api/ghl/webhook` and
  `POST /api/ghl/onboarding`. Secret goes in `x-clientdeck-secret`,
  `x-wh-secret`, or `?secret=`; read the value from `.env.local`. A request
  that passes the gate with a fake `locationId` returns
  `{"error":"Agency not found"}` (webhook) or `"Missing contactId or
  locationId"` (onboarding) — proof it entered the handler.
- **Super-admin API** (`/api/admin/*`): auth is a single cookie
  `cdp_admin_session` whose value is `sha256("cdp-admin-" + ADMIN_PASSWORD)`
  (see `src/lib/admin/session.ts`). Set your own ADMIN_PASSWORD at launch and
  mint the cookie — no login flow needed. No cookie → 401.
- **DB ground truth**: Supabase REST with the service-role key from
  `.env.local`: `GET {SUPABASE_URL}/rest/v1/{table}?select=...` with
  `apikey` + `Authorization: Bearer` headers. Read-only checks only.
- **Staff app / portal pages**: need a Supabase login. Demo account
  demo@clientdeckpro.com / Demo1234! exists after `npm run seed` (idempotent,
  only touches the demo agency). Server Actions can't be curl'd (action IDs);
  verify their logic through pages or leave a note about what wasn't driven.

## Gotchas

- Kill your `next start` when done (background task) so the port frees up.
- `.env.local` had `GOOGLE_CLIENT-ID` (hyphen typo) as of 2026-07 — Drive
  OAuth is dead locally regardless of your change.
