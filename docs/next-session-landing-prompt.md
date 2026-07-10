# Next Session Prompt — Part A: Landing Page Redesign (clientdeck.pro style)

> Paste everything below the line into a fresh Claude Code session at the repo root.

---

Read CLAUDE.md for full context. This session does **one thing**: completely rewrite the marketing landing page to match clientdeck.pro's structure and clean minimal aesthetic. Do **not** touch the dashboard, portal, admin, auth, or any backend/API/GHL/Stripe logic.

## Repo facts you must know (don't re-derive)

- **Stack:** Next.js 16 App Router, React 19, TypeScript, **Tailwind CSS v4** — the theme is configured in `src/app/globals.css` via `@theme`, there is **NO `tailwind.config.ts`**. Add any new keyframes/utilities to `globals.css`.
- **File to replace completely:** `src/app/(marketing)/page.tsx`.
- **Marketing frame already exists** — reuse or update, don't duplicate:
  - `src/app/(marketing)/layout.tsx` — nav + footer wrapper (bg `#13131f`).
  - `src/app/(marketing)/marketing-nav.tsx` — sticky nav (scroll-spy, mobile menu, logged-in state).
  - `src/app/(marketing)/faq-accordion.tsx` + `faq-data.ts` — dark accordion + questions.
  - `src/app/(marketing)/reveal.tsx` — `<Reveal delay>` scroll fade-up wrapper (use for section entrances).
- **Pricing = single source of truth:** import `PLANS` from `src/lib/billing/plans.ts`. Plans: **Starter $49** (internal id `solo`, 100 clients, 2 seats), **Pro $129** (700 clients, 5 seats, "Most Popular"), **Agency $249** (unlimited, removes branding, API/credit-monitoring). Do not hardcode prices — read from `PLANS`.
- **Logged-in state:** the page is a server component; call `getSessionContext()` from `@/lib/auth/session`. If a session exists, the nav + CTAs show **"Go to Dashboard"** (`/dashboard`); otherwise **"Start Free Trial"** (`/signup`).
- **Design system already in `globals.css`:** dark tokens, `.glass-card` / `.glass-panel`, `.animate-fade-up`, `.reveal`/`.reveal-visible`. Add a `@keyframes marquee` and a mockup float animation as needed.
- **Legal positioning (keep verbatim intent):** "Practice management software for credit professionals. Not a credit repair service. Not legal advice." Not affiliated with HighLevel, Inc.
- **Icons:** Lucide React only.
- **Deploy:** local branch is `master`, production is `main` → `git push origin master:main`. Vercel Hobby.
- **Definition of done:** `npx tsc --noEmit` clean AND `npm run build` passes. Then commit; ask before pushing.

## Aesthetic (clientdeck.pro)

- Dark navy hero/dark sections: **`#0F1730`**; light sections: `#ffffff` / `#f8fafc`.
- Primary text on dark `#ffffff`, secondary `#94a3b8`; on light `#0f172a` / `#475569`.
- Accent purple `#8B5CF6` / blue `#2563EB`; CTA = purple→blue gradient.
- Headlines: `font-bold tracking-tight`, `text-4xl`→`text-6xl`. Body `text-lg leading-relaxed`. Inter (already loaded).
- Section padding `py-24` desktop / `py-16` mobile. Content `max-w-6xl mx-auto px-6`.
- **All app mockups are pure HTML/CSS — no images.** Dark mockup cards `#13131f` + `border border-white/8`, `rounded-2xl`, `shadow-2xl`, glassmorphism inner elements. Slight 3D tilt on hero mockup: `transform: perspective(1200px) rotateX(3deg)`. Subtle float animation (translateY 0→-8px→0, 4s ease infinite). Respect `prefers-reduced-motion`.
- Marquee (agency types) = CSS `@keyframes marquee` only. Mobile: hero stacks vertically.

## Section flow (top → bottom)

1. **Nav** — Logo left · Features · How It Works · Pricing · GHL Snapshot · Compare · Login · [Start Free Trial →]. Sticky, `backdrop-blur-md`, bg `rgba(15,23,48,0.9)`, bottom border `rgba(255,255,255,0.06)`. Logged-in → [Go to Dashboard →].
2. **Hero** (`#0F1730`, centered) — pill badge "✦ Built exclusively for GoHighLevel agencies" (purple-500/15, border purple-500/30, text purple-300); headline "Run your entire credit repair operation from one connected platform."; subhead (gray-400) about dispute letters + client tracking + GHL sync + portal replacing CDM/spreadsheets/GHL juggling; two CTAs (gradient + white outline "See how it works ↓"); trust line "14-day free trial · No credit card required · Built for GHL"; **live dashboard mockup** (stat cards 24/47/$3,096/68% with green trend arrows, dispute pipeline row, two round cards + Recent Activity "Live" feed), tilted + float, overflow cropped; below it a **marquee** of agency types (Credit Repair Agencies · Dispute Specialists · GHL Agencies · Credit Consultants · Financial Coaches · …).
3. **Pain** (light) — "Your credit repair business isn't disorganized. Your tools are."; 2–3 narrative paragraphs (Monday-morning scenario → tools that don't talk → ClientDeck connects everything); scattered-tools → CDP visual (📊 Spreadsheets + 📋 CDM/DisputeFox + 📱 Manual GHL → [CDP] One Connected Flow 100%).
4. **Zero extra GHL cost** (dark) — "Most dispute tools send notifications through costly GHL webhooks. ClientDeck Pro doesn't."; body on $0.10/execution webhook fees vs. free contact tags; three callout cards ($0/month at 50 / 100 / 200 clients); footer "You still pay GHL's standard subscription. ClientDeck Pro's GHL integration is always free."
5. **Feature overview** (light) — "Everything connected in one credit repair operating system."; 2×3 grid: Dispute Management · AI Letter Generation · Client Portal · Native GHL Sync · Reports & Analytics · Google Drive Sync; embedded **AI letter generator mockup** (item list with Finalized/Generating/Pending states + a rendered FCRA §611 MOV letter preview).
6. **How it works** (dark) — 5 numbered steps (01 Client Onboarding · 02 Credit Analysis · 03 AI Dispute Letters · 04 GHL Runs the Communication · 05 Track Results & Repeat), alternating left/right with a small UI mockup per step (round builder, GHL contact w/ CDP tags+fields, results modal with deletion checkmarks).
7. **Comparison table** (light) — "The same jobs. Without the double entry."; ClientDeck Pro vs CDM / DisputeFox / DisputeBee across: Native GHL Integration, AI Letters, Free GHL Notifications (tags), Branded Portal, Auto Pipeline Moves, Google Drive Sync, AI Credit Report Parser, Starting Price ($49/$97/$108/$49), GHL Required. Footer: "CDM, DisputeFox, and DisputeBee pricing verified July 2026. Plans and fees can change." (Use ✅/❌/⚠️.)
8. **Who it's for** (dark) — "Built for GHL-powered credit repair agencies that need more than a dispute tracker."; left "Replaces a stack of…" (CDM/DisputeFox, spreadsheets, manual GHL, separate emails/SMS, Drive filing); right a live client-detail mockup card (Marcus Johnson, scores, items, round status, "GHL synced" badge).
9. **Pricing** (light) — "Simple pricing. No surprises."; Monthly/Annual toggle (annual = save 2 months, visual only unless trivial); **3 cards from `PLANS`** (Starter/Pro★/Agency) with the feature bullets from `plans.ts`; "Prices in USD. Cancel anytime — no contracts."; placeholder recognition badges row.
10. **FAQ** (dark) — reuse the accordion; questions: Do I need GoHighLevel? · Does ClientDeck Pro charge GHL webhook fees? · How does AI letter generation work? · Can I import from CDM or DisputeFox? · What is a "dispute round"? · Is this FCRA compliant? · How does the client portal work? · What happens to my data if I cancel? Emit **FAQ JSON-LD**.
11. **Founder note** (light) — initials/avatar circle; short note about watching agencies juggle CDM + spreadsheets + GHL, goal to make running a credit-repair business feel like serving clients again; signed **Towfiqul Islam, Founder**; "[Read about ClientDeck Pro →]".
12. **Final CTA** (dark) — "Stop running your credit repair business across three different tools."; subline; [Start Your Free 14-Day Trial →]; "✓ No credit card required ✓ Setup in 15 minutes ✓ Cancel anytime".
13. **Footer** — Logo + tagline; Product / Company / Legal columns; support@clientdeckpro.com; social icons; "© 2026 ClientDeck Pro. Not affiliated with HighLevel, Inc. ClientDeck Pro is practice management software. Not a credit repair service. Not legal advice." (The current `layout.tsx` footer may already cover most of this — update rather than duplicate.)

## Technical requirements

- Rewrite `src/app/(marketing)/page.tsx` fresh. Keep it a **server component** (session detection); mockups + accordion + toggle can be small client components if needed.
- Also keep JSON-LD `SoftwareApplication`/product schema (already present) alongside the FAQ schema.
- Preserve the existing SEO `<metadata>` in `layout.tsx`; keep the small SEO text block (What is / Who uses / How it compares).
- Marquee + float = CSS keyframes in `globals.css`. Reduced-motion safe.
- Mobile responsive; no horizontal overflow.
- Zero TypeScript errors; `npm run build` must pass.

## Build order

1. Add any new `@keyframes` (marquee, float) + helper classes to `globals.css`.
2. Build mockup subcomponents (pure CSS) — hero dashboard, AI letter, step cards, client-detail card, scattered-tools graphic.
3. Assemble `page.tsx` section by section using `PLANS`, `getSessionContext()`, `Reveal`, and the accordion.
4. Update `layout.tsx` nav/footer + `marketing-nav.tsx` links (add "Compare") only as needed.
5. `npx tsc --noEmit` + `npm run build` → clean.
6. Commit; ask before `git push origin master:main`.

## Open item to resolve (carried from the dark/light session)

The theme spec assumed the **client portal is light-only**, but the portal was shipped **dark** in an earlier session. Decide before/if it matters here — it does **not** affect the landing page, so it can stay out of scope for Part A.
