---
name: verify
description: How to build, launch, and drive RoundTrack Pro locally to verify changes at the running-app surface
---

# Verifying RoundTrack Pro changes

## Launch

- `npm run build` then `npx next start -p 3001` — use a non-3000 port; the user
  usually has `next dev` running on 3000 and Next 16 refuses a second dev
  server for the same directory (`next start` does not conflict).
- Env comes from `.env.local` (Supabase URL/keys, etc.). Extra vars (e.g.
  `ADMIN_PASSWORD`) can be set inline when starting:
  `$env:ADMIN_PASSWORD='...'; npx next start -p 3001`.
- ⚠️ **PowerShell `$env:VAR=''` REMOVES the variable** — the child process then
  falls back to `.env.local`. To run without a var that's set in `.env.local`
  (e.g. `RESEND_API_KEY` to force the `[Email DEV]` console fallback), comment
  it out in `.env.local` for the run and restore it after.
- ⚠️ **`NEXT_PUBLIC_*` vars are INLINED AT BUILD TIME** (server bundles too) —
  overriding them at `next start` time does nothing. Pointing the app at a
  different Supabase URL requires a rebuild with the override set, and a clean
  rebuild afterward.
- Server is ready when `GET /login` returns 200 (a few seconds).

## Drive surfaces

- **GHL webhooks** (unauthenticated surface): `POST /api/ghl/webhook` and
  `POST /api/ghl/onboarding`. Secret goes in `x-rtp-secret`, `x-wh-secret`, or
  `?secret=` — the per-agency `agencies.webhook_token` (migration 031), NOT an
  env var. An invalid secret returns 200 `{"received":true,"processed":false}`
  (fail-closed but 200 so GHL doesn't retry-storm).
- **Super-admin API** (`/api/admin/*`) and `/admin` pages: auth is a single
  cookie `rtp_admin_session` whose value is `sha256("rtp-admin-" + ADMIN_PASSWORD)`
  (see `src/lib/admin/session.ts`). Set your own ADMIN_PASSWORD at launch and
  mint the cookie — no login flow needed. No cookie → 401 (API) / 307 to
  /admin/login (pages).
- **DB ground truth**: Supabase REST with the service-role key from
  `.env.local`: `GET {SUPABASE_URL}/rest/v1/{table}?select=...` with
  `apikey` + `Authorization: Bearer` headers. Read-only checks only.
  ⚠️ Values in `.env.local` can have leading spaces / CRLF — trim before use
  (`| tr -d '\r' | xargs`), or auth mysteriously fails.
- **Server Actions CAN be driven over HTTP.** Each page's compiled actions are
  listed with their ids in
  `.next/server/app/<route>/page/server-reference-manifest.json`
  (`node.<id>.exportedName`). Call one with:
  `POST <page-url>` + headers `Next-Action: <id>`,
  `Content-Type: text/plain;charset=UTF-8`, `Accept: text/x-component`, plus
  auth cookies; body = JSON array of the action's arguments. The flight
  response's `1:{...}` line carries the return value. Ids change per build —
  always re-read the manifest.
- **Staff session cookie without a browser**: POST
  `{SUPABASE_URL}/auth/v1/token?grant_type=password` (anon key,
  demo@roundtrackpro.com / Demo1234! after `npm run seed`), then send
  `sb-<project-ref>-auth-token=base64-<base64url(JSON session)>` (chunk at
  3180 chars into `.0`/`.1` suffixes if longer).
- **Supabase MCP / CLI cannot reach this project's DB** (the connector is
  logged into a different Supabase account; the CLI has no access token) —
  migrations must be run by the user in the SQL editor. For testing
  not-yet-applied tables, a tiny in-memory PostgREST mock + a rebuild with
  `NEXT_PUBLIC_SUPABASE_URL` pointed at it works (see scratchpad
  `mock-postgrest.mjs` pattern: eq/gte/is filters, HEAD + `Content-Range: */N`
  for counts, 201 on insert, 409 `{code:"23505"}` for unique violations).

## Gotchas

- Kill your `next start` when done (background task) so the port frees up.
- `.env.local` had `GOOGLE_CLIENT-ID` (hyphen typo) as of 2026-07 — Drive
  OAuth is dead locally regardless of your change.
- **`.env.local`'s `RESEND_API_KEY` 403s** ("domain not verified", as of
  2026-07-16): it belongs to a Resend account that never verified
  `roundtrackpro.com`. The working key lives only in Vercel as a
  **sensitive** env var (cryptographically unreadable, even via
  VERCEL_TOKEN) — so real email delivery can only be verified against the
  deployed app. Locally, test email paths via the dev fallback (comment the
  key out → `[Email DEV] subject → to` in server log).
- Consuming a Supabase action/recovery link (even via `fetch`) sets the
  user's `last_sign_in_at` — team members then count as "accepted", not
  "Pending".
