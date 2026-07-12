# Agency custom portal domain — design

## Context

The Agency plan (`plans.ts`) advertises "Custom portal domain" as a feature, but
nothing backs it: `agencies.custom_domain` is an unused column (migration 001),
never read or written anywhere in the codebase, and there's no Vercel API
integration of any kind. This spec covers building it for real.

## Scope

**Portal only.** The custom domain white-labels the client-facing portal URL
(clients hit e.g. `portal.theiragency.com` instead of
`roundtrackpro.com/portal`). Staff auth, the dashboard, and `/admin` always
stay on the default `roundtrackpro.com` domain — this is not a whole-app
multi-tenant domain feature. That matches the existing feature copy and keeps
Supabase Auth's cookie/redirect flow untouched.

**URL shape is unchanged.** The custom domain serves the exact same route
tree — `/portal?token=xxx` → `/portal/dashboard`, `/portal/billing`, etc. — 
just on a different Host. No path rewriting, no root-level route tree for the
portal.

## Key finding: middleware needs almost no new logic

The existing `/portal` handling in `middleware.ts` (lines 24–52) is already
host-agnostic: it reads `request.nextUrl`, sets a relative `portal_session`
cookie, and redirects within the incoming request's own host. Nothing
hardcodes `roundtrackpro.com`. `validatePortalToken()` resolves client +
agency entirely from the token, never from the Host header.

That means once a domain is attached and DNS-verified on the Vercel project,
`/portal?token=xxx` on that domain works with **zero changes** to the
token/cookie flow — Vercel's own domain routing decides whether traffic for
that Host reaches this deployment at all.

The only addition is a thin defense-in-depth guard: if the incoming Host is
not the primary app domain and the path starts with `/portal`, look up
`agencies` by `custom_domain`; proceed only if `custom_domain_verified =
true`. This mostly protects against a stale DNS record after an agency
disconnects their domain (a scenario Vercel's own domain detachment would
likely already block, so this is belt-and-suspenders, not load-bearing).

## Data model

New migration `026_custom_domain.sql`:
- `agencies.custom_domain_verified BOOLEAN NOT NULL DEFAULT false` (new column
  — `custom_domain` already exists as a bare `TEXT` column from migration 001).
- Unique partial index on `custom_domain` (`WHERE custom_domain IS NOT NULL`)
  so two agencies can't claim the same domain in our own table.

DNS verification instructions (record type/value) returned by Vercel are
**not persisted** — always fetched live from Vercel when the Settings page
renders an unverified domain, so they can't go stale relative to Vercel's
actual state.

## Vercel API integration

`src/lib/vercel/domains.ts` — plain `fetch()` against `api.vercel.com`
(no new dependency; mirrors the wrapper shape of `src/lib/ghl/api.ts`),
authenticated with a `VERCEL_TOKEN` bearer header, scoped to
`VERCEL_PROJECT_ID` / `VERCEL_TEAM_ID`.

Functions:
- `addDomainToProject(domain)` — POSTs the domain to the project. Inspects
  the response for a `verification` array: if it contains a `TXT`-type
  challenge, the domain is already attached to a *different* Vercel project
  and requires ownership proof rather than the standard CNAME flow — this
  case is surfaced distinctly (see UI below), not as a generic failure.
- `getDomainVerification(domain)` — fetches current config/verification
  state live (used both right after connecting and whenever the Settings
  page re-renders an unverified domain).
- `verifyDomain(domain)` — triggers Vercel's verification check.
- `removeDomainFromProject(domain)` — DELETEs the domain from the project.

New env vars (documented in `.env.example`):
```
VERCEL_TOKEN       # Vercel API token, domain-management scope on the team
VERCEL_PROJECT_ID  # prj_1xP9e4FtX9RTg3Hun0E9chcRrvFX
VERCEL_TEAM_ID     # team_mDOpQbtGfJpBuYcNc3GNkX3g (project is team-owned)
```

## Settings → Domain page

`src/app/(dashboard)/settings/domain/` — gated via `isAgencyPlanOrHigher()`,
same upgrade-gate pattern as Settings → Credit Monitoring (Starter/Pro see an
upgrade card instead of the form).

States for Agency-plan agencies:
1. **Not connected** — text input + "Connect" button.
2. **Connected, unverified, standard case** — shows the CNAME (or A) record
   to add, with a "Verify" button.
3. **Connected, unverified, already-claimed-elsewhere case** — shows the TXT
   ownership-proof record distinctly, with copy explaining the domain is
   currently attached to a different Vercel project.
4. **Connected + verified** — shows the live domain and a "Remove domain"
   button.

Server actions (`settings/domain/actions.ts`):
- `connectDomain(domain)` — validates format, checks the unique index isn't
  already claimed by another agency, calls `addDomainToProject`, stores
  `custom_domain` (verified stays `false`).
- `checkDomainVerification()` — calls `verifyDomain`; on success sets
  `custom_domain_verified = true`.
- `removeDomain()` — calls `removeDomainFromProject`, clears both columns.

## Magic-link generation

`generatePortalLink()` (`src/lib/utils/portal-token.ts`) currently always
builds links against `NEXT_PUBLIC_APP_URL`. It will look up the agency's
`custom_domain` / `custom_domain_verified`; if verified, the link is built on
that domain, otherwise it falls back to the default app URL exactly as
today. Without this change the feature would have no visible effect — SMS
links would keep pointing at `roundtrackpro.com` even after an agency
"connects" their domain.

## Testing

- `npm run build` must pass.
- Live end-to-end test against a real domain the user controls: connect →
  add the DNS record → verify → confirm the portal loads correctly over
  HTTPS on that domain. Run via the Vercel MCP connection, which has
  confirmed access to the real `clientdeck-pro` project.

## Explicitly out of scope

- Whole-app (staff dashboard / admin) custom domains.
- Persisting DNS verification instructions in the database.
- Branding the pre-token "invalid/expired link" page per-domain (it isn't
  branded per-agency today even on the default domain).
- `@vercel/sdk` — using a plain `fetch()` wrapper instead to avoid a new
  dependency.
