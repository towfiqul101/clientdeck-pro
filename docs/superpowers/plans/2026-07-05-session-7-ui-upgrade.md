# Session 7 (Part A) — UI/UX Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin ClientDeck Pro's existing screens (sidebar, dashboard, client list, client detail, landing page) with a more premium visual system, and add one genuinely new UI surface: a click-only kanban board for dispute rounds at `/rounds`.

**Architecture:** This is a visual-layer pass over an already-working app. No new Supabase queries beyond what's needed for the kanban board's per-bureau item counts; no new server actions; no new routes except the kanban view (same `/rounds` URL, client-side view toggle). Reuse existing shared primitives (`Button`, `Input`/`Field`, `Badge`, `Card`, `EmptyState`, `cn()`, `getStatusColor()`) rather than inventing parallel styling systems.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS (no custom theme tokens beyond CSS vars added here), Recharts, lucide-react. No new npm packages.

## Global Constraints

- **No new npm packages.** Pure Tailwind + existing `recharts` + `lucide-react`. Do not add `@dnd-kit` or any drag-and-drop library — the kanban board is explicitly click-only in this plan (drag-and-drop is an out-of-scope Phase 2).
- **No test suite exists in this repo** (confirmed: no jest/vitest/testing-library/playwright in `package.json`). Do not create one. Verification for every task is: `npx tsc --noEmit` clean, `npm run lint` clean, and (for the final task) `npm run build` clean. Where a change is behavior-bearing (the view toggle, filters, kanban card links), verify by reading the rendered logic carefully and, if a dev server is reasonably available, a manual click-through; do not invent automated tests.
- **All transitions use 150ms ease** — use Tailwind `transition-colors duration-150 ease-out` / `transition-all duration-150 ease-out` (or the `--transition-fast: 150ms ease` CSS var from Task 1) consistently; do not use Tailwind's default 200ms/300ms durations for hover/press states.
- **No dark mode.** This codebase has zero `dark:` variants anywhere. Do not introduce any — the "dark sidebar" is a literal `bg-gray-900`/`bg-gray-950` element in an otherwise light-theme app, not a dark-mode toggle.
- **Reuse, don't fork:** use `cn()` from `@/lib/utils/helpers` for all conditional classes; use the existing `Button` (`@/components/ui/button.tsx`), `Input`/`Field`/`Select` (`@/components/ui/field.tsx`), `Badge` (`@/components/ui/badge.tsx`), `Card`/`CardHeader` (`@/components/ui/card.tsx`), `EmptyState` (`@/components/ui/empty-state.tsx`) rather than writing new one-off styled elements that duplicate them.
- **Server Components stay server components.** Only add `"use client"` where new interactive state is introduced (view toggle, filter pills, kanban board). Do not convert an existing server component to client unless a step explicitly says so.
- **Commit after each task** once `tsc`/`lint` are clean for that task's diff.
- **Round status vocabulary is fixed** — the five `RoundStatus` values (`preparing`, `letters_generated`, `sent`, `awaiting_response`, `complete`) defined in `src/types/index.ts:18` are the only kanban columns. Do not invent new statuses or migrate the DB enum.
- **Deviation from the literal spec text, noted deliberately:** the original design brief asks for a new `src/components/ui/status-badge.tsx`. This codebase already has `src/components/ui/badge.tsx` exporting `Badge`, used everywhere status pills appear (items table, clients table, rounds table), backed by the single `getStatusColor()` map in `src/lib/utils/helpers.ts`. Creating a second, parallel status-pill component would fragment that pattern. Task 1 instead **extends the existing `Badge` component** with the two requested props (`showDot`, `size`) in place. This is a deliberate, reasoned substitution, not an oversight — task reviewers should treat "extended `Badge` in `badge.tsx`" as satisfying the "unified status badge system" requirement.

---

### Task 1: Design System Foundation — CSS tokens + Button + Input + Badge

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/ui/button.tsx`
- Modify: `src/components/ui/field.tsx`
- Modify: `src/components/ui/badge.tsx`

**Interfaces:**
- Produces: CSS custom properties `--shadow-card`, `--shadow-elevated`, `--shadow-modal`, `--radius-card`, `--radius-button`, `--radius-input`, `--transition-fast`, `--transition-normal` (available globally via `var(--token-name)` in any Tailwind arbitrary-value class, e.g. `shadow-[var(--shadow-elevated)]`).
- Produces: `Badge` gains two new optional props — `showDot?: boolean` (default `false`) and `size?: "sm" | "md"` (default `"md"`) — every other prop and the component's export name (`Badge`) is unchanged, so all ~15 existing call sites (`<Badge status={...} />`) keep compiling with no changes.
- Consumes: nothing new.

- [ ] **Step 1: Add design tokens to `globals.css`**

Open `src/app/globals.css`. It currently reads:

```css
@import "tailwindcss";

:root {
  --background: #f9fafb;
  --foreground: #111827;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-inter);
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-inter), ui-sans-serif, system-ui, -apple-system,
    "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
```

Add the new tokens inside the existing `:root` block (do not create a second `:root`):

```css
:root {
  --background: #f9fafb;
  --foreground: #111827;
  --shadow-card: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
  --shadow-elevated: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  --shadow-modal: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
  --radius-card: 12px;
  --radius-button: 8px;
  --radius-input: 8px;
  --transition-fast: 150ms ease;
  --transition-normal: 200ms ease;
}
```

- [ ] **Step 2: Verify CSS parses**

Run: `npx tsc --noEmit` (this repo has no CSS test — tsc is a no-op check here but confirms nothing else broke). Then run `npm run build` once to confirm Tailwind/PostCSS accepts the new `:root` vars.
Expected: build succeeds (same as before this change).

- [ ] **Step 3: Update `Button` for the new primary press-state and focus ring shape**

In `src/components/ui/button.tsx`, the `primary` variant currently is:

```ts
primary:
  "bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500 disabled:bg-blue-300",
```

Change it to add the active-press scale (spec A7: `active:scale-[0.98]`):

```ts
primary:
  "bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500 disabled:bg-blue-300 active:scale-[0.98]",
```

And in the base `className={cn(...)}` call inside `Button`, the current base string is:

```ts
"inline-flex items-center justify-center gap-2 rounded-md font-medium shadow-sm transition-colors",
"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
"disabled:cursor-not-allowed",
```

Change `transition-colors` to `transition-all duration-150` so the new `active:scale-[0.98]` actually animates:

```ts
"inline-flex items-center justify-center gap-2 rounded-md font-medium shadow-sm transition-all duration-150",
"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
"disabled:cursor-not-allowed",
```

Leave `secondary`, `danger`, and `ghost` variant strings unchanged — the spec only calls out the primary press state.

- [ ] **Step 4: Update `Input` border/placeholder tokens in `field.tsx`**

In `src/components/ui/field.tsx`, `controlBase` currently is:

```ts
const controlBase =
  "block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500";
```

Change `border-gray-300` → `border-gray-200` and the focus ring from `focus:ring-1 focus:ring-blue-500` to a 2px 20%-opacity ring per spec A7 (`ring-2 ring-blue-500/20`):

```ts
const controlBase =
  "block w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500";
```

This one shared constant feeds `Input`, `Select`, and `Textarea`, so all three pick up the update. Leave `Field`'s error-state red styling as-is (spec doesn't change it).

- [ ] **Step 5: Extend `Badge` with `showDot` and `size` props**

Replace the full contents of `src/components/ui/badge.tsx` with:

```tsx
import { cn, getStatusColor } from "@/lib/utils/helpers";

interface BadgeProps {
  /** Status key resolved via getStatusColor(); falls back to gray. */
  status: string;
  label?: string;
  className?: string;
  /** Renders a small colored dot before the label, using the same color family as the pill. */
  showDot?: boolean;
  /** "sm" is a denser pill for tight table cells; "md" (default) matches existing usage. */
  size?: "sm" | "md";
}

const sizeClasses: Record<NonNullable<BadgeProps["size"]>, string> = {
  sm: "px-1.5 py-0.5 text-[11px]",
  md: "px-2 py-0.5 text-xs",
};

/** Colored status pill. Label defaults to a humanized version of the status. */
export function Badge({ status, label, className, showDot = false, size = "md" }: BadgeProps) {
  const text = label ?? status.replace(/_/g, " ");
  const colorClasses = getStatusColor(status);
  // getStatusColor returns "bg-{color}-100 text-{color}-800"-shaped strings; reuse the
  // text-color half for the dot so it always matches the pill without a second color map.
  const dotColor = colorClasses.split(" ").find((c) => c.startsWith("text-"));
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium capitalize",
        sizeClasses[size],
        colorClasses,
        className
      )}
    >
      {showDot && (
        <span className={cn("h-1.5 w-1.5 rounded-full bg-current", dotColor)} />
      )}
      {text}
    </span>
  );
}
```

Note: `bg-current` on the dot inherits whichever `text-*` class is active on the span (Tailwind's `text-*` sets `color`, and `bg-current` reads that same `color` value for `background-color`), so the dot always matches the pill's text color with no second lookup table. The `dotColor` variable is computed for clarity but not strictly required by the render — keep it, it documents intent for the next reader.

- [ ] **Step 6: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: no errors (in particular, confirm the ~15 existing `<Badge status={...} />` call sites across the codebase still compile with no prop changes required).

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/globals.css src/components/ui/button.tsx src/components/ui/field.tsx src/components/ui/badge.tsx
git commit -m "feat: add design system tokens, button press state, input focus ring, badge dot/size variants"
```

---

### Task 2: Sidebar Upgrade

**Files:**
- Modify: `src/components/dashboard/dashboard-shell.tsx`

**Interfaces:**
- Consumes: `getInitials()` and `cn()` from `@/lib/utils/helpers` (already imported), `NAV_ITEMS` array (already defined in this file), `Logo` from `@/components/ui/logo` (already imported, has a `variant="light"` prop already in use — do not change `Logo`).
- Produces: no new exports; `DashboardShellProps` signature (`{agencyName, userName, userEmail, children}`) is unchanged.

- [ ] **Step 1: Add a left-border active-state indicator and adjust nav item colors**

In `src/components/dashboard/dashboard-shell.tsx`, the nav item `<Link>` currently is:

```tsx
<Link
  key={item.href}
  href={item.href}
  onClick={() => setMobileOpen(false)}
  className={cn(
    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
    active
      ? "bg-blue-600 text-white"
      : "text-gray-300 hover:bg-gray-800 hover:text-white"
  )}
>
  <Icon className="h-5 w-5 shrink-0" />
  {item.label}
</Link>
```

Replace it with a left-border-indicator style (2px solid blue border, translucent blue background, blue icon, white text when active; gray-400 icon / gray-300 text when inactive; explicit 150ms transition per Global Constraints):

```tsx
<Link
  key={item.href}
  href={item.href}
  onClick={() => setMobileOpen(false)}
  className={cn(
    "flex items-center gap-3 rounded-md border-l-2 px-3 py-2 text-sm font-medium transition-colors duration-150",
    active
      ? "border-blue-500 bg-blue-500/15 text-white"
      : "border-transparent text-gray-300 hover:bg-gray-800 hover:text-white"
  )}
>
  <Icon
    className={cn(
      "h-5 w-5 shrink-0",
      active ? "text-blue-400" : "text-gray-400"
    )}
  />
  {item.label}
</Link>
```

Note the icon color is now driven independently of the `<Link>` text color (spec calls for `blue-400` icon specifically on active, `gray-400` on inactive, distinct from the `text-gray-300`/`text-white` label color) — this is why `Icon`'s `className` is no longer just `"h-5 w-5 shrink-0"`.

- [ ] **Step 2: Add the right border on the sidebar shell + workspace-switcher chevron on the agency name**

The desktop sidebar `<aside>` currently is:

```tsx
<aside className="fixed inset-y-0 left-0 z-30 hidden w-64 md:block">
  {sidebar}
</aside>
```

Add `border-r border-gray-800` to the inner `sidebar` div (not the `<aside>`, since the mobile overlay reuses the same `sidebar` JSX and should also get the border). The `sidebar` div's opening tag currently is:

```tsx
const sidebar = (
  <div className="flex h-full flex-col bg-gray-900">
```

Change to:

```tsx
const sidebar = (
  <div className="flex h-full flex-col border-r border-gray-800 bg-gray-900">
```

Then update the agency-name block to read as a workspace switcher with a chevron (visual only — no dropdown behavior is being added, this is a styling-only affordance per the spec's "workspace switcher style"):

```tsx
{/* Agency name */}
<div className="px-4 pb-2">
  <button
    type="button"
    className="flex w-full items-center justify-between rounded-md px-1 py-1 text-left transition-colors duration-150 hover:bg-gray-800"
  >
    <p className="truncate text-xs font-medium uppercase tracking-wide text-gray-500">
      {agencyName}
    </p>
    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-500" />
  </button>
</div>
```

Add `ChevronDown` to the existing `lucide-react` import list at the top of the file (currently `LayoutDashboard, Users, Clock, FileText, BarChart3, UserPlus, Settings, LogOut, Menu, X`):

```tsx
import {
  LayoutDashboard,
  Users,
  Clock,
  FileText,
  BarChart3,
  UserPlus,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";
```

- [ ] **Step 3: Restyle the user row + separate logout into its own icon button**

The current user + logout block is:

```tsx
{/* User + logout */}
<div className="border-t border-gray-800 p-3">
  <div className="flex items-center gap-3 px-1 py-2">
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-700 text-sm font-medium text-white">
      {getInitials(
        userName.split(" ")[0] ?? userName,
        userName.split(" ")[1] ?? userName.slice(1)
      )}
    </span>
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-medium text-white">
        {userName}
      </p>
      <p className="truncate text-xs text-gray-400">{userEmail}</p>
    </div>
  </div>
  <button
    onClick={handleLogout}
    className="mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
  >
    <LogOut className="h-5 w-5" />
    Log out
  </button>
</div>
```

Replace with a single row (colored initials avatar + name/email, logout as a separate icon button to the right, per spec A1):

```tsx
{/* User + logout */}
<div className="border-t border-gray-800 p-3">
  <div className="flex items-center gap-2 px-1 py-2">
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-medium text-white">
      {getInitials(
        userName.split(" ")[0] ?? userName,
        userName.split(" ")[1] ?? userName.slice(1)
      )}
    </span>
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-medium text-white">
        {userName}
      </p>
      <p className="truncate text-xs text-gray-400">{userEmail}</p>
    </div>
    <button
      onClick={handleLogout}
      aria-label="Log out"
      className="shrink-0 rounded-md p-2 text-gray-400 transition-colors duration-150 hover:bg-gray-800 hover:text-white"
    >
      <LogOut className="h-4 w-4" />
    </button>
  </div>
</div>
```

This changes the avatar background from `bg-gray-700` (neutral) to `bg-blue-600` (a "colored circle" per spec A1) — reuses the existing blue accent rather than inventing a new per-user color scheme.

- [ ] **Step 4: Type-check, lint, and manual visual check**

Run: `npx tsc --noEmit` — expected clean.
Run: `npm run lint` — expected clean.
If a dev server is reasonably available (`npm run dev`), open `/dashboard` and visually confirm: active nav item shows a blue left border + translucent blue background + blue icon; sidebar has a visible right border; user row shows a blue-circle avatar with a separate logout icon button to its right; the agency name row shows a chevron and highlights on hover. If no dev server is available in this environment, skip the manual check and note it in the report.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/dashboard-shell.tsx
git commit -m "feat: upgrade sidebar with active-state left border, workspace-switcher affordance, separated logout"
```

---

### Task 3: Dashboard Upgrade — Stat Cards, Onboarding Banner, Deletions Chart

**Files:**
- Modify: `src/components/dashboard/onboarding-banner.tsx`
- Modify: `src/components/dashboard/deletions-chart.tsx`
- No changes needed to `src/components/dashboard/stat-card.tsx` or `src/app/(dashboard)/dashboard/page.tsx` — the existing `StatCard` component already matches the spec exactly (icon in a colored circle via its `accent` prop, `text-2xl` value — spec asks for `text-3xl`, see Step 1 below for the one change needed there).

**Interfaces:**
- Consumes: `OnboardingBanner` props are unchanged (`{steps, completedCount, total, showCongrats, allComplete, firstClientId}`); `DeletionsChart` props are unchanged (`{data: MonthlyDeletion[]}`).
- Produces: nothing new consumed by later tasks.

- [ ] **Step 1: Bump `StatCard` value text size to `text-3xl` and add a trend pill style**

`src/components/dashboard/stat-card.tsx` currently renders the value as:

```tsx
<p className="mt-4 text-2xl font-semibold tracking-tight text-gray-900">
  {value}
</p>
```

and the trend as a plain gray span:

```tsx
{trend && <span className="text-xs text-gray-400">{trend}</span>}
```

Change the value to `text-3xl` (per spec A2 "Large number text-3xl font-bold"; also change `font-semibold` → `font-bold` to match):

```tsx
<p className="mt-4 text-3xl font-bold tracking-tight text-gray-900">
  {value}
</p>
```

Change the trend span to a green pill (spec: `"+3 this month" green-100 text-green-700`):

```tsx
{trend && (
  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
    {trend}
  </span>
)}
```

This file lives at `src/components/dashboard/stat-card.tsx` — read it first to confirm you're editing the exact two spans above (the rest of the component, including the 4-color `accents` map and the icon circle, already matches spec and needs no change).

- [ ] **Step 2: Restyle `OnboardingBanner` as a solid gradient banner**

The banner currently uses a light `border-blue-200 bg-blue-50/60` treatment with dark text. Per spec A2 ("Gradient: from-blue-600 to-blue-700, White text throughout, Progress bar: white/30 track white fill, Step circles: white with checkmark (done) or empty (pending), Action buttons: white/20 bg ghost style"), replace the *not-showCongrats* branch's outer container and every text/control color inside it. The congrats branch (green success banner) is unchanged.

Read the current full file at `src/components/dashboard/onboarding-banner.tsx` first (it's short, ~70 lines). Replace the main (non-congrats) return block:

```tsx
return (
  <div className="rounded-lg border border-blue-200 bg-blue-50/60 shadow-sm">
    <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-3 p-4 text-left">
      <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
        <Rocket className="h-4 w-4 text-blue-600" />
        Get ClientDeck Pro ready in {total} steps
      </span>
      <span className="flex items-center gap-3">
        <span className="text-xs font-medium text-gray-600">{completedCount} of {total} complete</span>
        {open ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
      </span>
    </button>

    <div className="px-4">
      <div className="h-2 w-full overflow-hidden rounded-full bg-blue-100">
        <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>

    {open && (
      <ul className="space-y-1 p-4">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center justify-between rounded-md px-2 py-2">
            <span className="flex items-center gap-2 text-sm text-gray-700">
              <span className={cn("flex h-5 w-5 items-center justify-center rounded-full border", row.done ? "border-green-500 bg-green-500 text-white" : "border-gray-300 bg-white")}>
                {row.done && <Check className="h-3 w-3" />}
              </span>
              <span className={cn(row.done && "text-gray-500 line-through")}>{row.label}</span>
            </span>
            {!row.done && row.cta && (
              <Link href={row.href} className="rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">{row.cta}</Link>
            )}
          </li>
        ))}
      </ul>
    )}

    {open && allComplete && (
      <div className="border-t border-blue-100 p-3 text-right">
        <button onClick={() => router.refresh()} className="text-xs font-medium text-blue-600 hover:text-blue-700">Dismiss — I&apos;ll finish later</button>
      </div>
    )}
  </div>
);
```

with:

```tsx
return (
  <div className="rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 shadow-sm">
    <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-3 p-4 text-left">
      <span className="flex items-center gap-2 text-sm font-semibold text-white">
        <Rocket className="h-4 w-4 text-white" />
        Get ClientDeck Pro ready in {total} steps
      </span>
      <span className="flex items-center gap-3">
        <span className="text-xs font-medium text-blue-100">{completedCount} of {total} complete</span>
        {open ? <ChevronUp className="h-4 w-4 text-blue-100" /> : <ChevronDown className="h-4 w-4 text-blue-100" />}
      </span>
    </button>

    <div className="px-4">
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/30">
        <div className="h-full rounded-full bg-white transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>

    {open && (
      <ul className="space-y-1 p-4">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center justify-between rounded-md px-2 py-2">
            <span className="flex items-center gap-2 text-sm text-white">
              <span className={cn("flex h-5 w-5 items-center justify-center rounded-full border", row.done ? "border-white bg-white text-blue-600" : "border-white/40 bg-transparent")}>
                {row.done && <Check className="h-3 w-3" />}
              </span>
              <span className={cn(row.done && "text-blue-100 line-through")}>{row.label}</span>
            </span>
            {!row.done && row.cta && (
              <Link href={row.href} className="rounded-md bg-white/20 px-3 py-1 text-xs font-medium text-white transition-colors duration-150 hover:bg-white/30">{row.cta}</Link>
            )}
          </li>
        ))}
      </ul>
    )}

    {open && allComplete && (
      <div className="border-t border-white/20 p-3 text-right">
        <button onClick={() => router.refresh()} className="text-xs font-medium text-white hover:text-blue-100">Dismiss — I&apos;ll finish later</button>
      </div>
    )}
  </div>
);
```

Leave the `showCongrats` early-return branch (green success state) untouched — it's a separate, already-correct state per spec (only the in-progress gradient banner changes).

- [ ] **Step 3: Add gradient fill + rounded bar tops + custom tooltip to `DeletionsChart`**

Read the current full file at `src/components/dashboard/deletions-chart.tsx`. It renders a Recharts `<BarChart>` with a single flat `#2563eb` `<Bar>` and the default tooltip. Per spec A2:
- Add a `<defs>` block with a `linearGradient` (light blue → transparent) and reference it as the `<Bar fill="url(#...)" />`.
- Add `radius` to the `<Bar>` for rounded tops.
- Add a custom tooltip component (white card, shadow).
- X axis stays month abbreviations in `gray-400`; Y axis stays hidden — these are almost certainly already true (do not change `<XAxis>`/`<YAxis>` props unless you find they differ from this description when you read the file; if `<YAxis>` is not already `hide`, add `hide` to it).

Inside the component, above the `return`, add a custom tooltip function:

```tsx
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-100 bg-white px-3 py-2 shadow-[var(--shadow-elevated)]">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="text-sm font-semibold text-gray-900">{payload[0].value} deletions</p>
    </div>
  );
}
```

In the returned `<BarChart>`, add the gradient definition as the first child and wire it into the bar, and swap in the custom tooltip:

```tsx
<BarChart data={data}>
  <defs>
    <linearGradient id="deletionsGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#2563eb" stopOpacity={0.8} />
      <stop offset="100%" stopColor="#2563eb" stopOpacity={0.05} />
    </linearGradient>
  </defs>
  <XAxis dataKey="label" tick={{ fill: "#9ca3af", fontSize: 12 }} axisLine={false} tickLine={false} />
  <YAxis hide />
  <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f3f4f6" }} />
  <Bar dataKey="deletions" fill="url(#deletionsGradient)" radius={[6, 6, 0, 0]} />
</BarChart>
```

Adjust the above to match whatever prop values the existing `<XAxis>`/`<Tooltip>`/`<Bar>` already use for `dataKey` (it should be `"label"` and `"deletions"` per the `MonthlyDeletion` interface `{label, deletions}` — confirm against the file, don't guess if it differs). Keep the existing `<ResponsiveContainer>` wrapper and `h-56` height class exactly as they are.

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit` — expected clean (Recharts' `Tooltip content` prop and `payload` typing can be strict; if TypeScript complains about the `ChartTooltip` payload type, loosen the parameter type to match whatever Recharts' own `TooltipProps` shape requires rather than using `any`).
Run: `npm run lint` — expected clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/stat-card.tsx src/components/dashboard/onboarding-banner.tsx src/components/dashboard/deletions-chart.tsx
git commit -m "feat: upgrade dashboard stat cards, gradient onboarding banner, deletions chart styling"
```

---

### Task 4: Client List Upgrade — Table Styling, Card View Toggle, Filter Pills

**Files:**
- Modify: `src/app/(dashboard)/clients/page.tsx`
- Modify: `src/app/(dashboard)/clients/clients-filters.tsx`
- Create: `src/app/(dashboard)/clients/client-cards-view.tsx`

**Interfaces:**
- Consumes: `Client`/`ClientWithStats`-shaped row data already fetched in `clients/page.tsx` (read the file to get the exact row shape/fields before writing `ClientCardsView`'s prop type — do not invent fields that aren't already selected by the existing query; if the card view needs a field the current query doesn't select, e.g. `assigned_to` display name, add it to the existing `.select(...)` call rather than issuing a second query).
- Produces: `ClientCardsView({clients: <the exact row type used by the existing table>})` — a client component rendering the 3-col/1-col card grid described below. This is new; no later task depends on it.

- [ ] **Step 1: Read the current file and note the exact row type/fields**

Read `src/app/(dashboard)/clients/page.tsx` in full. Confirm: the local row interface/type name, every field it selects (especially whether `assigned_to`/team-member name is already joined in, and whether score fields are `score_eq_current`/`score_eq_start` etc. per `Client` in `src/types/index.ts`), and the existing `SignatureDot`/`ScoreCell` helper components. Do not modify the data-fetching query except to add fields genuinely missing for the card view (see Step 4).

- [ ] **Step 2: Restyle the table (rows, avatar cell, hover, sticky header)**

Update the `<thead>` to be sticky with the spec's uppercase/tracking treatment (likely already close — if the current classes differ from `sticky top-0 bg-white text-gray-500 text-xs uppercase tracking-wide`, converge on that; if a `<thead>` is inside a scroll container, add `sticky top-0 z-10` and a solid `bg-white` or `bg-gray-50` so scrolled rows don't show through).

Update the `<tr>` body rows to:

```tsx
className="border-b border-gray-100 bg-white transition-colors duration-150 hover:bg-gray-50 cursor-pointer"
```

(only add `cursor-pointer` if the row is already wrapped in a click-to-navigate handler or every cell already links to the client — check the existing implementation; if only specific cells are links today, do not fabricate a whole-row click handler, just apply the hover/border styling to the `<tr>`.)

In the client-name cell, add a colored initials avatar next to the name+email stack. Import `getInitials` from `@/lib/utils/helpers` (add to the existing import if not already imported) and render:

```tsx
<div className="flex items-center gap-3">
  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-700">
    {getInitials(client.first_name, client.last_name)}
  </span>
  <div className="min-w-0">
    <p className="truncate font-medium text-gray-900">{client.first_name} {client.last_name}</p>
    <p className="truncate text-sm text-gray-500">{client.email}</p>
  </div>
</div>
```

adjusting the wrapping `<Link>`/`<td>` to match whatever structure the file already uses for the name cell (keep the existing link target, just add the avatar).

For the score cells, if a score increased vs. its `_start` counterpart, add a small green up-arrow next to the existing `ScoreCell`/badge — read the existing `ScoreCell` helper first; if it doesn't already compute direction, use `scoreChange(start, current)` from `@/lib/utils/helpers` (already used identically in `client-header.tsx`'s `BureauScore`) and render:

```tsx
{scoreChange(client.score_eq_start, client.score_eq_current).direction === "up" && (
  <ArrowUp className="h-3 w-3 text-green-600" />
)}
```

Import `ArrowUp` from `lucide-react` in this file if not already present.

Add hover-reveal actions (Eye/Pencil/ExternalLink) to a new trailing `<td>` if the table doesn't already have a dedicated actions column — check first; if there's no actions column today, add one as the last `<th>`/`<td>` pair:

```tsx
<td className="px-4 py-3">
  <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
    <Link href={`/clients/${client.id}`} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600" aria-label="View"><Eye className="h-4 w-4" /></Link>
    <Link href={`/clients/${client.id}/edit`} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600" aria-label="Edit"><Pencil className="h-4 w-4" /></Link>
  </div>
</td>
```

(add `group` to the `<tr>` className for `group-hover` to work; import `Eye`, `Pencil` from `lucide-react`.) Do not add an `ExternalLink` portal-link action here unless the row data already contains a portal URL/token — if it doesn't, two actions (Eye, Pencil) satisfy the spec's intent without fabricating a third link target.

- [ ] **Step 3: Replace the filter dropdown(s) with clickable status pills**

Read `src/app/(dashboard)/clients/clients-filters.tsx` in full. It currently renders a `<Select>` (or similar) for status using `CLIENT_STATUSES` from `@/lib/constants`. Per spec A3, add a row of clickable pills for the coarse `[All] [Active] [On Hold] [Completed]` filter, positioned above or alongside the existing detailed status/sort/search controls (do not remove the existing detailed `<Select>` for status if it offers more granularity than these 4 buckets — check `CLIENT_STATUSES`; if it has more than these 4 values, e.g. `onboarding`/`analysis` too, keep the full `<Select>` for those and add the pill row as a quick-filter shortcut for the 4 named buckets, wired to the same `status` search param/URL state the `<Select>` already uses).

Add pill buttons using the same `useTransition`/router-push pattern already present in this file for the debounced search input:

```tsx
const STATUS_PILLS = [
  { value: "", label: "All" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
];

// ...inside the component, alongside the existing filter controls:
<div className="flex flex-wrap gap-2">
  {STATUS_PILLS.map((pill) => (
    <button
      key={pill.value}
      type="button"
      onClick={() => updateParam("status", pill.value)}
      className={cn(
        "rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150",
        currentStatus === pill.value
          ? "bg-blue-600 text-white"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      )}
    >
      {pill.label}
    </button>
  ))}
</div>
```

Use whatever the existing param-update function/pattern in this file is actually named (read it first — do not invent `updateParam` if the file already has an equivalent helper with a different name; reuse that one) and whatever variable already tracks the current status value from `useSearchParams()`.

- [ ] **Step 4: Build the card view + toggle**

Create `src/app/(dashboard)/clients/client-cards-view.tsx`:

```tsx
"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn, getInitials, scoreChange } from "@/lib/utils/helpers";
import { ArrowUp } from "lucide-react";
import type { Client } from "@/types";

interface ClientCardsViewProps {
  clients: Pick<
    Client,
    | "id"
    | "first_name"
    | "last_name"
    | "status"
    | "current_round"
    | "score_eq_start"
    | "score_eq_current"
    | "score_exp_start"
    | "score_exp_current"
    | "score_tu_start"
    | "score_tu_current"
    | "total_items_current"
    | "total_items_deleted"
  >[];
}

function BureauCell({ start, current }: { start: number | null; current: number | null }) {
  const change = scoreChange(start, current);
  return (
    <div className="text-center">
      <p className="font-mono text-sm font-semibold text-gray-900">{current ?? "—"}</p>
      {change.direction === "up" && (
        <p className="flex items-center justify-center gap-0.5 text-xs text-green-600">
          <ArrowUp className="h-3 w-3" />+{change.value}
        </p>
      )}
    </div>
  );
}

export function ClientCardsView({ clients }: ClientCardsViewProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {clients.map((client) => {
        const resolved = client.total_items_current > 0
          ? Math.round((client.total_items_deleted / client.total_items_current) * 100)
          : 0;
        return (
          <Link
            key={client.id}
            href={`/clients/${client.id}`}
            className="block rounded-xl border border-gray-200 bg-white shadow-[var(--shadow-card)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)]"
          >
            <div className="flex items-center gap-3 border-b border-gray-100 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-700">
                {getInitials(client.first_name, client.last_name)}
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium text-gray-900">{client.first_name} {client.last_name}</p>
                <p className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Badge status={client.status} size="sm" />
                  <span>· Round {client.current_round}</span>
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 border-b border-gray-100 p-4">
              <BureauCell start={client.score_eq_start} current={client.score_eq_current} />
              <BureauCell start={client.score_exp_start} current={client.score_exp_current} />
              <BureauCell start={client.score_tu_start} current={client.score_tu_current} />
            </div>
            <div className="p-4">
              <p className="mb-1.5 text-xs text-gray-500">
                {client.total_items_deleted} of {client.total_items_current} items done
              </p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full bg-blue-600" style={{ width: `${resolved}%` }} />
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
```

Adjust the `Pick<Client, ...>` field list if the query in `clients/page.tsx` uses a different local row type name — match it exactly rather than re-selecting from `Client`.

- [ ] **Step 5: Wire the view toggle into `clients/page.tsx`**

Since `clients/page.tsx` is a Server Component, the table/card toggle needs client-side state. Add a small `"use client"` wrapper component in the same file's directory, or — simpler and consistent with this codebase's pattern of colocated small client components (e.g. `clients-filters.tsx`) — create the toggle as part of `clients-filters.tsx` (it already renders client-side filter controls in the page's toolbar) using a URL search param (`?view=cards`) rather than component state, so the Server Component can read `searchParams` and decide whether to render the existing table markup or `<ClientCardsView clients={clients} />`.

In `clients-filters.tsx`, add a toggle button pair next to the existing controls:

```tsx
<div className="flex items-center gap-1 rounded-md border border-gray-200 p-0.5">
  <button
    type="button"
    onClick={() => updateParam("view", "")}
    className={cn("rounded p-1.5 transition-colors duration-150", currentView !== "cards" ? "bg-gray-100 text-gray-700" : "text-gray-400 hover:text-gray-600")}
    aria-label="Table view"
  >
    <List className="h-4 w-4" />
  </button>
  <button
    type="button"
    onClick={() => updateParam("view", "cards")}
    className={cn("rounded p-1.5 transition-colors duration-150", currentView === "cards" ? "bg-gray-100 text-gray-700" : "text-gray-400 hover:text-gray-600")}
    aria-label="Card view"
  >
    <LayoutGrid className="h-4 w-4" />
  </button>
</div>
```

Import `List`, `LayoutGrid` from `lucide-react`. In `clients/page.tsx`, read `view` from the awaited `searchParams` the same way `status`/`sort`/etc. are already read, and branch the render:

```tsx
{view === "cards" ? (
  <ClientCardsView clients={clients} />
) : (
  // ...existing table JSX unchanged...
)}
```

Keep pagination working for both views — reuse whatever pagination the table already has; if pagination links are query-string based (`buildPageUrl`), confirm they preserve the new `view` param (read `buildPageUrl`'s implementation — if it only forwards a fixed allow-list of params, add `"view"` to that list).

- [ ] **Step 6: Type-check and lint**

Run: `npx tsc --noEmit` — expected clean.
Run: `npm run lint` — expected clean.

- [ ] **Step 7: Commit**

```bash
git add src/app/(dashboard)/clients/page.tsx src/app/(dashboard)/clients/clients-filters.tsx src/app/(dashboard)/clients/client-cards-view.tsx
git commit -m "feat: upgrade client list with avatars, hover actions, status pills, and card view toggle"
```

---

### Task 5: Client Detail Header + Tabs + Items Upgrade

**Files:**
- Modify: `src/app/(dashboard)/clients/[id]/client-header.tsx`
- Modify: `src/app/(dashboard)/clients/[id]/client-tabs.tsx`
- Modify: `src/app/(dashboard)/clients/[id]/items/items-manager.tsx`

**Interfaces:**
- Consumes: `scoreChange()`, `cn()` from `@/lib/utils/helpers`; `Badge` from `@/components/ui/badge`; `BUREAU_STYLES` from `@/lib/constants` (already used in `items-manager.tsx`).
- Produces: nothing new for later tasks.

- [ ] **Step 1: Add per-bureau top border color to the bureau score cards in `client-header.tsx`**

Read `src/app/(dashboard)/clients/[id]/client-header.tsx` in full and find the 3-col bureau score grid (the `BureauScore` local component rendered 3 times for EQ/EXP/TU). Add a colored top border distinguishing each bureau card (spec: blue for Equifax, orange for Experian, green for TransUnion — matching the `BUREAU_STYLES` dot colors already used in `items-manager.tsx`, so read `BUREAU_STYLES` in `src/lib/constants.ts` first and reuse its exact border color per bureau rather than inventing new ones). Wrap each of the three `BureauScore` renders (or add the class inside `BureauScore` itself, parameterized by a new `borderClass` prop) so the container div gets, e.g.:

```tsx
<div className="rounded-lg border border-t-2 border-gray-200 border-t-blue-500 p-4">
```

for Equifax, swapping `border-t-blue-500` for the orange/green equivalents pulled from `BUREAU_STYLES.experian`/`BUREAU_STYLES.transunion` on the other two cards. If `BureauScore` currently doesn't accept a class/border prop, add one (`borderTopClass: string`) and pass it from each of the three call sites — do not hardcode three near-duplicate copies of the component.

- [ ] **Step 2: Add a segmented progress bar**

Find the existing single-color progress bar (`resolvedPct`) in `client-header.tsx`. Per spec A4 ("Segmented progress bar: deleted(green) · in dispute(blue) · remaining(gray)"), this requires three counts, not just a resolved percentage. Check what fields are available on the `client` prop passed into `ClientHeader` (`total_items_current`, `total_items_deleted` are on `Client` per `src/types/index.ts`; an "in dispute" count is not directly on `Client` — it would need to come from a query the header doesn't currently make). Given `ClientHeader` receives only `client: Client` and `members`, do not add a new Supabase query here (out of scope for a visual pass) — instead render the two segments computable from existing `Client` fields (`deleted` = `total_items_deleted`, `remaining` = `total_items_current - total_items_deleted`), and treat "in dispute" as a third, zero-width segment only if you find a suitable existing count already passed to this component (check `client-header.tsx`'s existing props/computation once more before deciding). Render:

```tsx
<div className="flex h-2 w-full overflow-hidden rounded-full bg-gray-100">
  <div className="h-full bg-green-500" style={{ width: `${deletedPct}%` }} />
  <div className="h-full bg-gray-300" style={{ width: `${100 - deletedPct}%` }} />
</div>
<p className="mt-1.5 text-xs text-gray-500">
  {client.total_items_deleted} deleted · {client.total_items_current - client.total_items_deleted} remaining
</p>
```

This is a deliberate scope-trim from the spec's 3-segment mockup to a 2-segment one that's honest about the data actually available on this component's existing props — do not fabricate an "in dispute" number from nothing.

- [ ] **Step 3: Upgrade the tab bar underline style in `client-tabs.tsx`**

Read `src/app/(dashboard)/clients/[id]/client-tabs.tsx`. It already uses `border-blue-600 text-blue-600` for the active tab (per the earlier survey) — confirm the underline is `border-b-2` (2px) as spec A4 requires; if it's currently `border-b` (1px), change to `border-b-2`. Spec A4 also asks for count badges next to tab labels ("Items (12)"). This requires per-tab counts (items count, rounds count, letters count, documents count) that `ClientTabs` does not currently receive (it's called with just `{clientId}` from `layout.tsx`). Adding these counts would require a new query in `layout.tsx` and threading four new numeric props through — given this plan's Global Constraint against adding new queries beyond the kanban board's bureau counts, skip the count badges in this task and leave `ClientTabs`' existing `{clientId}` signature and tab list unchanged beyond the border-width fix. Note this trim explicitly in your task report so the reviewer doesn't flag it as an unexplained gap.

- [ ] **Step 4: Add status icons to item status badges in `items-manager.tsx`**

Read the `ItemRow` function inside `src/app/(dashboard)/clients/[id]/items/items-manager.tsx`. It currently renders `<Badge status={item.dispute_status} />` with no icon. Per spec A4 ("Status badges with icons: ✓ Deleted (green), ⏳ In Dispute (blue), ✗ Verified (red)"), add a small icon before the badge text for exactly these three `DisputeStatus` values (`deleted`, `in_dispute`, `verified`), leaving other statuses (`not_disputed`, `updated`, `pending`) with the plain `Badge` as today (the spec doesn't asign them icons). Since `Badge` itself has no icon slot, render the icon as a sibling, not inside `Badge`:

```tsx
const STATUS_ICONS: Partial<Record<DisputeStatus, LucideIcon>> = {
  deleted: Check,
  in_dispute: Clock,
  verified: X,
};

// inside ItemRow's status <td>:
const StatusIcon = STATUS_ICONS[item.dispute_status];
<td className="px-4 py-3">
  <span className="inline-flex items-center gap-1">
    {StatusIcon && <StatusIcon className="h-3 w-3" />}
    <Badge status={item.dispute_status} />
  </span>
</td>
```

Import `Check`, `Clock`, `X` (and the `LucideIcon` type) from `lucide-react` in this file — check the existing import list first to avoid duplicate/conflicting names (this file may already import `Clock` or `X` for something else; alias if so, e.g. `X as XIcon`).

- [ ] **Step 5: Confirm bureau row left-border and dot styling already match spec**

The survey confirmed `GroupRows` already renders a `border-y` bureau-header row using `BUREAU_STYLES[bureau].bg`/`.text`, and `ItemRow` already renders a colored dot + bureau label via `style.dot`/`style.text`. Spec A4 additionally asks for a `border-l-4` colored left border on each item row. Read `ItemRow`'s root `<tr>` className and add the bureau-colored left border if not already present:

```tsx
<tr className={cn("border-l-4", BUREAU_STYLES[item.bureau].border)}>
```

merging with whatever className the `<tr>` already has (don't replace existing hover/border-b classes — append via `cn()`). Confirm `BUREAU_STYLES` in `src/lib/constants.ts` has a `.border` key with a `border-{color}-500`-shaped value for each bureau; if the existing `BUREAU_STYLES` shape only has `{dot, text, bg, border}` as documented in the survey, this is already available — use it as-is, do not add a new key.

- [ ] **Step 6: Type-check and lint**

Run: `npx tsc --noEmit` — expected clean.
Run: `npm run lint` — expected clean.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(dashboard)/clients/[id]/client-header.tsx" "src/app/(dashboard)/clients/[id]/client-tabs.tsx" "src/app/(dashboard)/clients/[id]/items/items-manager.tsx"
git commit -m "feat: upgrade client detail header bureau cards, progress bar, tab underline, and item status icons"
```

---

### Task 6: Kanban Pipeline Board for Rounds

**Files:**
- Modify: `src/app/(dashboard)/rounds/page.tsx`
- Create: `src/app/(dashboard)/rounds/rounds-kanban.tsx`
- Modify: `src/app/(dashboard)/rounds/rounds-filter.tsx`

**Interfaces:**
- Consumes: `RoundStatus` from `@/types`; `daysRemaining()`, `formatDate()`, `getInitials()`, `cn()` from `@/lib/utils/helpers`; the existing `dispute_rounds` Supabase query in `rounds/page.tsx` (extended — see Step 1).
- Produces: `RoundsKanban({rounds: KanbanRound[]})` client component. `KanbanRound` type (defined in `rounds-kanban.tsx`) — no later task in this plan consumes it, but note its shape here for the reviewer: `{id, round_number, status, date_sent, response_deadline, client_id, client: {first_name, last_name} | null, bureauCounts: {equifax: number, experian: number, transunion: number}}`.

**Design decision, stated explicitly (read before implementing):** the original spec's card mockup shows per-stage action buttons ("Generate Letters", "Mark as Sent", "Log Results") as if the board triggers those mutations directly. This codebase's actual mutation logic for all of those actions lives entirely inside `src/app/(dashboard)/clients/[id]/rounds/[roundId]/round-workspace.tsx` (letter generation, marking sent, logging results) and `src/app/(dashboard)/clients/[id]/rounds/new/round-builder.tsx` (starting the next round) — large, stateful client components. Reimplementing those mutations a second time inside the kanban board would duplicate business logic and risk the two copies drifting. Instead, **every kanban card action is a `Link`, not a mutating button**: the context-aware label previews what the user will do next, but clicking always navigates to the existing workspace/builder page where that action already lives. This satisfies the "click-only, no drag-and-drop" MVP framing in the spec while keeping mutation logic in exactly one place.

- [ ] **Step 1: Extend the `dispute_rounds` query in `rounds/page.tsx` with per-bureau dispute counts**

The current query (read `src/app/(dashboard)/rounds/page.tsx` to confirm this hasn't changed) is:

```ts
let query = supabase
  .from("dispute_rounds")
  .select(
    "id, round_number, status, date_sent, response_deadline, total_items_disputed, client_id, client:clients(first_name, last_name)"
  );
```

Extend the `.select(...)` string to also pull each round's disputes' bureaus (needed for the kanban card's per-bureau item breakdown):

```ts
let query = supabase
  .from("dispute_rounds")
  .select(
    "id, round_number, status, date_sent, response_deadline, total_items_disputed, client_id, client:clients(first_name, last_name), disputes(bureau)"
  );
```

Update the local `RoundRow` interface to add `disputes: { bureau: Bureau }[]`, importing `Bureau` from `@/types` alongside the existing `RoundStatus` import.

- [ ] **Step 2: Compute per-bureau counts and pass to the kanban component**

Below the existing `const rounds = (data ?? []) as unknown as RoundRow[];`, add a mapping step that shapes rounds into the `KanbanRound` type (bureau counts computed once, server-side, so the client component does no data transformation):

```ts
const kanbanRounds = rounds.map((r) => ({
  id: r.id,
  round_number: r.round_number,
  status: r.status,
  date_sent: r.date_sent,
  response_deadline: r.response_deadline,
  client_id: r.client_id,
  client: r.client,
  bureauCounts: {
    equifax: r.disputes.filter((d) => d.bureau === "equifax").length,
    experian: r.disputes.filter((d) => d.bureau === "experian").length,
    transunion: r.disputes.filter((d) => d.bureau === "transunion").length,
  },
}));
```

- [ ] **Step 3: Add the List/Pipeline view toggle and branch the render**

Read `sp` (the awaited `searchParams`) in this file — it already reads `status`. Add a `view` param the same way:

```ts
const viewParam = typeof sp.view === "string" ? sp.view : "";
const view = viewParam === "list" ? "list" : "pipeline"; // pipeline is default per spec
```

Add the toggle UI next to the existing `<RoundsFilter />` in the header row:

```tsx
<div className="flex items-center gap-3">
  <div className="flex items-center gap-1 rounded-md border border-gray-200 p-0.5">
    <Link
      href={buildViewUrl("list")}
      className={cn("flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors duration-150", view === "list" ? "bg-gray-100 text-gray-700" : "text-gray-400 hover:text-gray-600")}
    >
      <List className="h-3.5 w-3.5" /> List
    </Link>
    <Link
      href={buildViewUrl("pipeline")}
      className={cn("flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors duration-150", view === "pipeline" ? "bg-gray-100 text-gray-700" : "text-gray-400 hover:text-gray-600")}
    >
      <LayoutGrid className="h-3.5 w-3.5" /> Pipeline
    </Link>
  </div>
  <RoundsFilter />
</div>
```

Add a small local helper above the component to build the URL (preserving the existing `status` param):

```ts
function buildViewUrl(view: string, statusFilter: string) {
  const params = new URLSearchParams();
  if (statusFilter) params.set("status", statusFilter);
  if (view !== "pipeline") params.set("view", view);
  const qs = params.toString();
  return qs ? `/rounds?${qs}` : "/rounds";
}
```

(call it as `buildViewUrl("list", statusFilter)` / `buildViewUrl("pipeline", statusFilter)` — adjust the JSX above accordingly.) Import `Link` (already imported), `List`, `LayoutGrid` from `lucide-react`.

Branch the body render: when `view === "pipeline"`, render `<RoundsKanban rounds={kanbanRounds} />` instead of the existing table markup; when `view === "list"`, keep the existing table exactly as-is (wrap it in the `view === "list"` branch, don't delete it).

- [ ] **Step 4: Build `RoundsKanban`**

Create `src/app/(dashboard)/rounds/rounds-kanban.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { cn, formatDate, getInitials, daysRemaining } from "@/lib/utils/helpers";
import { FileText, CheckSquare, Send, Clock, CheckCircle } from "lucide-react";
import type { RoundStatus, Bureau } from "@/types";
import type { LucideIcon } from "lucide-react";

export interface KanbanRound {
  id: string;
  round_number: number;
  status: RoundStatus;
  date_sent: string | null;
  response_deadline: string | null;
  client_id: string;
  client: { first_name: string; last_name: string } | null;
  bureauCounts: Record<Bureau, number>;
}

interface StageConfig {
  label: string;
  colorBorder: string;
  headerBg: string;
  icon: LucideIcon;
  description: string;
}

const STAGE_CONFIG: Record<RoundStatus, StageConfig> = {
  preparing: {
    label: "Preparing",
    colorBorder: "border-t-gray-400",
    headerBg: "bg-gray-50",
    icon: FileText,
    description: "Letters being prepared",
  },
  letters_generated: {
    label: "Letters Ready",
    colorBorder: "border-t-indigo-500",
    headerBg: "bg-indigo-50",
    icon: CheckSquare,
    description: "Ready to send",
  },
  sent: {
    label: "Sent to Bureaus",
    colorBorder: "border-t-blue-500",
    headerBg: "bg-blue-50",
    icon: Send,
    description: "Awaiting bureau response",
  },
  awaiting_response: {
    label: "Awaiting Response",
    colorBorder: "border-t-amber-500",
    headerBg: "bg-amber-50",
    icon: Clock,
    description: "Bureau has 35 days",
  },
  complete: {
    label: "Complete",
    colorBorder: "border-t-green-500",
    headerBg: "bg-green-50",
    icon: CheckCircle,
    description: "Results logged",
  },
};

const STAGE_ORDER: RoundStatus[] = ["preparing", "letters_generated", "sent", "awaiting_response", "complete"];

const BUREAU_DOTS: Record<Bureau, string> = {
  equifax: "bg-blue-500",
  experian: "bg-orange-500",
  transunion: "bg-green-500",
};

const BUREAU_LABELS: Record<Bureau, string> = {
  equifax: "EQ",
  experian: "EXP",
  transunion: "TU",
};

function DeadlinePill({ status, deadline }: { status: RoundStatus; deadline: string | null }) {
  if (!deadline || status === "complete") return null;
  const days = daysRemaining(deadline);
  if (days < 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
        {Math.abs(days)}d overdue
      </span>
    );
  }
  const tone = days <= 14 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700";
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", tone)}>
      {days}d remaining
    </span>
  );
}

function primaryAction(round: KanbanRound): { label: string; href: string } {
  const workspaceHref = `/clients/${round.client_id}/rounds/${round.id}`;
  switch (round.status) {
    case "preparing":
      return { label: "Generate Letters", href: workspaceHref };
    case "letters_generated":
      return { label: "Mark as Sent", href: workspaceHref };
    case "awaiting_response":
      return { label: "Log Results", href: workspaceHref };
    case "complete":
      return { label: "Start Next Round", href: `/clients/${round.client_id}/rounds/new` };
    case "sent":
    default:
      return { label: "View →", href: workspaceHref };
  }
}

function RoundCard({ round }: { round: KanbanRound }) {
  const workspaceHref = `/clients/${round.client_id}/rounds/${round.id}`;
  const action = primaryAction(round);
  const clientName = round.client ? `${round.client.first_name} ${round.client.last_name}` : "Unknown client";
  const totalItems = round.bureauCounts.equifax + round.bureauCounts.experian + round.bureauCounts.transunion;

  return (
    <div className="w-60 shrink-0 rounded-xl border border-gray-200 bg-white shadow-[var(--shadow-card)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)]">
      <Link href={workspaceHref} className="block border-b border-gray-100 p-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-700">
            {getInitials(round.client?.first_name ?? "?", round.client?.last_name ?? "")}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">{clientName}</p>
            <p className="truncate text-xs text-gray-500">
              Round {round.round_number}{round.date_sent ? ` · ${formatDate(round.date_sent)}` : ""}
            </p>
          </div>
        </div>
      </Link>
      {totalItems > 0 && (
        <div className="space-y-1 border-b border-gray-100 p-3">
          {(["equifax", "experian", "transunion"] as Bureau[]).map((b) =>
            round.bureauCounts[b] > 0 ? (
              <p key={b} className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className={cn("h-1.5 w-1.5 rounded-full", BUREAU_DOTS[b])} />
                {BUREAU_LABELS[b]} {round.bureauCounts[b]} items
              </p>
            ) : null
          )}
        </div>
      )}
      <div className="p-3">
        <DeadlinePill status={round.status} deadline={round.response_deadline} />
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-gray-100 p-3">
        <Link href={action.href} className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white transition-colors duration-150 hover:bg-blue-700">
          {action.label}
        </Link>
        <Link href={workspaceHref} className="text-xs font-medium text-gray-500 hover:text-gray-700">
          View →
        </Link>
      </div>
    </div>
  );
}

export function RoundsKanban({ rounds }: { rounds: KanbanRound[] }) {
  const [expandedMobileStage, setExpandedMobileStage] = useState<RoundStatus>("preparing");
  const [overdueOnly, setOverdueOnly] = useState(false);

  const visibleRounds = overdueOnly
    ? rounds.filter((r) => {
        if (!r.response_deadline || r.status === "complete") return false;
        return daysRemaining(r.response_deadline) < 0;
      })
    : rounds;

  const byStage = STAGE_ORDER.map((status) => ({
    status,
    config: STAGE_CONFIG[status],
    rounds: visibleRounds.filter((r) => r.status === status),
  }));

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOverdueOnly((v) => !v)}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150",
            overdueOnly ? "bg-red-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          )}
        >
          ⚠️ Overdue Only
        </button>
      </div>

      {/* Desktop/tablet: horizontal-scroll columns */}
      <div className="hidden gap-4 overflow-x-auto pb-2 sm:flex">
        {byStage.map(({ status, config, rounds: stageRounds }) => {
          const Icon = config.icon;
          return (
            <div key={status} className="w-60 shrink-0">
              <div className={cn("mb-3 rounded-t-lg border-t-2 px-3 py-2", config.colorBorder, config.headerBg)}>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <Icon className="h-3.5 w-3.5" />
                    {config.label}
                  </span>
                  <span className="rounded-full bg-white px-1.5 py-0.5 text-xs font-medium text-gray-600">
                    {stageRounds.length}
                  </span>
                </div>
              </div>
              <div className="space-y-3">
                {stageRounds.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-200 p-4 text-center text-xs text-gray-400">
                    No rounds here
                  </div>
                ) : (
                  stageRounds.map((round) => <RoundCard key={round.id} round={round} />)
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile: single-column accordion, one stage expanded at a time */}
      <div className="space-y-2 sm:hidden">
        {byStage.map(({ status, config, rounds: stageRounds }) => {
          const Icon = config.icon;
          const expanded = expandedMobileStage === status;
          return (
            <div key={status} className="rounded-lg border border-gray-200">
              <button
                type="button"
                onClick={() => setExpandedMobileStage(status)}
                className={cn("flex w-full items-center justify-between rounded-t-lg border-t-2 px-3 py-2", config.colorBorder, config.headerBg)}
              >
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <Icon className="h-3.5 w-3.5" />
                  {config.label}
                </span>
                <span className="rounded-full bg-white px-1.5 py-0.5 text-xs font-medium text-gray-600">
                  {stageRounds.length}
                </span>
              </button>
              {expanded && (
                <div className="space-y-3 p-3">
                  {stageRounds.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-200 p-4 text-center text-xs text-gray-400">
                      No rounds here
                    </div>
                  ) : (
                    stageRounds.map((round) => (
                      <div key={round.id} className="w-full">
                        <RoundCard round={round} />
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

Note: `RoundCard`'s outer container is `w-60` (matches the spec's "260px fixed width" approximation using Tailwind's `w-60` = 15rem = 240px, which the spec itself also states as "240px" in the card-style note — the two spec numbers, 260px column vs 240px card, are intentionally close-but-not-identical in the original brief; use `w-60` for both, since the mobile accordion rendering (a `<div className="w-full">` wrapper) already makes the fixed card width irrelevant on narrow screens).

- [ ] **Step 5: Reconcile `rounds-filter.tsx`'s status option order with the `RoundStatus` type order**

The survey found `rounds-filter.tsx`'s `STATUS_OPTIONS` list is in a different order than `RoundStatus`'s declared order and is a hand-maintained duplicate. This doesn't block the kanban board (the board's own `STAGE_ORDER` array is authoritative for column order), but leaving the dropdown in a different order than the actual pipeline flow is a visible inconsistency once a kanban board exists next to it. Reorder `STATUS_OPTIONS` in `rounds-filter.tsx` to match pipeline order:

```ts
const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "preparing", label: "Preparing" },
  { value: "letters_generated", label: "Letters generated" },
  { value: "sent", label: "Sent" },
  { value: "awaiting_response", label: "Awaiting response" },
  { value: "complete", label: "Complete" },
];
```

- [ ] **Step 6: Type-check and lint**

Run: `npx tsc --noEmit` — expected clean. Pay particular attention to the `disputes(bureau)` Supabase select — the returned shape from `@supabase/supabase-js` for a nested one-to-many relation is an array; confirm the cast `as unknown as RoundRow[]` (already used in this file for the existing `client:clients(...)` nested field) still covers the new `disputes` field, or adjust the interface if the actual runtime/type shape differs once you run `tsc`.
Run: `npm run lint` — expected clean.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(dashboard)/rounds/page.tsx" "src/app/(dashboard)/rounds/rounds-kanban.tsx" "src/app/(dashboard)/rounds/rounds-filter.tsx"
git commit -m "feat: add kanban pipeline board for dispute rounds with list/pipeline view toggle"
```

---

### Task 7: Landing Page Upgrade

**Files:**
- Modify: `src/app/(marketing)/page.tsx`

**Interfaces:**
- Consumes: `PLANS` from `@/lib/billing/plans` (already imported; `highlight` field already drives the "Most Popular" card).
- Produces: nothing new.

- [ ] **Step 1: Add dot-grid background + blue glow to the hero section**

Read `src/app/(marketing)/page.tsx` and find the hero `<section>` (already `bg-gray-950 text-white` per the survey). Add the two decorative background layers as siblings inside the section, before the actual headline content, each `absolute` and `pointer-events-none` so they don't intercept clicks:

```tsx
<section className="relative overflow-hidden bg-gray-950 px-6 py-24 text-white sm:py-32">
  <div
    className="pointer-events-none absolute inset-0"
    style={{
      backgroundImage: "radial-gradient(circle, #ffffff12 1px, transparent 1px)",
      backgroundSize: "24px 24px",
    }}
  />
  <div className="pointer-events-none absolute left-1/2 -top-20 h-96 w-96 -translate-x-1/2 rounded-full bg-blue-600/20 blur-3xl" />
  <div className="relative mx-auto max-w-4xl text-center">
    {/* existing headline/subhead/CTA content unchanged */}
  </div>
</section>
```

Adjust the exact existing className on the hero `<section>` and its inner content wrapper to match what's actually there (add `relative overflow-hidden` to the section if not already present, wrap existing content in a `relative` div if it isn't already, so it renders above the two new background layers).

- [ ] **Step 2: Add a browser-frame product screenshot mockup below the hero CTAs**

Immediately after the hero's CTA buttons (inside the same `relative mx-auto max-w-4xl` content wrapper, or as a new element directly below the hero section — read the file to decide which reads better with the existing spacing), add a CSS-only browser frame containing a static SVG representation of the kanban board (no real screenshot asset — build it as inline JSX/SVG shapes, since no image asset pipeline is being introduced):

```tsx
<div className="mx-auto mt-16 max-w-4xl rounded-xl border border-gray-700 bg-gray-900 shadow-2xl">
  <div className="flex items-center gap-1.5 border-b border-gray-800 px-4 py-3">
    <span className="h-2.5 w-2.5 rounded-full bg-gray-700" />
    <span className="h-2.5 w-2.5 rounded-full bg-gray-700" />
    <span className="h-2.5 w-2.5 rounded-full bg-gray-700" />
  </div>
  <div className="grid grid-cols-4 gap-3 p-6">
    {["Preparing", "Letters Ready", "Sent", "Awaiting"].map((label) => (
      <div key={label} className="space-y-2">
        <div className="rounded bg-gray-800 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">
          {label}
        </div>
        <div className="h-16 rounded-lg bg-gray-800/60" />
        <div className="h-16 rounded-lg bg-gray-800/60" />
      </div>
    ))}
  </div>
</div>
```

This is a schematic placeholder (four skeleton columns echoing the real kanban board's structure), not a pixel-accurate screenshot — that's consistent with the spec's own instruction to use "a static SVG representation" rather than a real screenshot asset.

- [ ] **Step 3: Upgrade the pricing cards**

Find the pricing section's card-rendering loop over `PLANS`. Currently every card likely shares one className regardless of `plan.highlight`. Split the className so the highlighted (Pro) card gets a `scale-[1.02]`, a gradient header, and a "Most Popular" badge, while the others stay at normal scale with a plain white/gray-200 treatment:

```tsx
<div
  key={plan.id}
  className={cn(
    "relative rounded-xl border bg-white shadow-sm",
    plan.highlight ? "scale-[1.02] border-blue-600" : "border-gray-200"
  )}
>
  {plan.highlight && (
    <span className="absolute right-4 top-0 -translate-y-1/2 rounded-full bg-blue-600 px-3 py-1 text-xs font-bold text-white">
      Most Popular
    </span>
  )}
  <div className={cn("rounded-t-xl px-6 py-5", plan.highlight ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white" : "")}>
    {/* existing plan name / price content, unchanged */}
  </div>
  {/* existing features list content, unchanged */}
</div>
```

Import `cn` from `@/lib/utils/helpers` in this file if not already imported (check first — server components in this codebase frequently already import it). Preserve every existing bit of content inside the card (name, price, feature list, CTA button) — only the wrapping classNames and the new badge/gradient-header are new.

- [ ] **Step 4: Upgrade the comparison table**

Find the comparison table (`COMPARISON` array + `Mark({v})` helper). Update the `<thead>` row to `bg-blue-600 text-white`, alternate body row backgrounds (`bg-white` / `bg-gray-50` via `index % 2`), color the ClientDeck Pro column's checkmarks `text-blue-600` (competitor columns stay `text-gray-400`), and make the first column (feature names) `sticky left-0` with a solid background so it doesn't scroll away on narrow viewports:

```tsx
<thead className="bg-blue-600 text-white">
  {/* existing header cells, unchanged text */}
</thead>
<tbody>
  {COMPARISON.map((row, i) => (
    <tr key={row.feature} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
      <td className="sticky left-0 bg-inherit px-4 py-3 font-medium text-gray-900">{row.feature}</td>
      {/* other cells: reuse existing Mark(v) helper, just ensure the ClientDeck Pro column passes a distinct "text-blue-600" class vs "text-gray-400" for competitors */}
    </tr>
  ))}
</tbody>
```

`bg-inherit` on the sticky cell lets it pick up the alternating row color so the sticky column doesn't visually clash with the scrolling columns. Read the existing `Mark({v})` helper first — if it already hardcodes a single check-mark color for all columns, parameterize it with a `color?: string` prop (default `text-gray-400`) and pass `text-blue-600` only from the ClientDeck Pro column's call site.

- [ ] **Step 5: Type-check and lint**

Run: `npx tsc --noEmit` — expected clean.
Run: `npm run lint` — expected clean.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(marketing)/page.tsx"
git commit -m "feat: upgrade landing page hero, pricing cards, and comparison table"
```

---

### Task 8: Empty States Upgrade

**Files:**
- Modify: `src/app/(dashboard)/clients/page.tsx` (empty state only — do not touch table/card logic already done in Task 4)
- Modify: `src/app/(dashboard)/rounds/rounds-kanban.tsx` (empty column styling — already added in Task 6 as dashed-border "No rounds here" cards; confirm here, don't duplicate)
- Modify: `src/app/(dashboard)/clients/[id]/timeline/page.tsx`
- Modify: `src/app/(dashboard)/reports/page.tsx`

**Interfaces:**
- Consumes: `EmptyState` from `@/components/ui/empty-state` (unchanged props: `{icon, title, description?, action?}`).

- [ ] **Step 1: Confirm the kanban empty-column styling from Task 6 satisfies this task**

Task 6, Step 4 already rendered dashed-border "No rounds here" placeholder cards for empty kanban columns, matching spec A9 ("rounds kanban empty columns: dashed border card, 'No rounds here' gray-400"). No new work needed here — just don't regress it in this task.

- [ ] **Step 2: Set the clients list empty state to use `UserPlus` with a CTA**

Read the existing `<EmptyState .../>` call in `src/app/(dashboard)/clients/page.tsx`. Update its props (or add them if some are missing) to:

```tsx
<EmptyState
  icon={UserPlus}
  title="No clients yet"
  description="Add your first client to start tracking dispute rounds and letters."
  action={
    <Link href="/clients/new" className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
      Add Client
    </Link>
  }
/>
```

Import `UserPlus` from `lucide-react` in this file (it's already imported in `dashboard-shell.tsx` for the nav item, but this is a separate file — add its own import). If a filter is active (search/status), keep or adapt the existing "no results for this filter" copy branch if one already exists — don't remove filtered-empty messaging in favor of the unfiltered "no clients yet" copy; branch on whether any filter param is set, same as the existing rounds page already does for its own empty state.

- [ ] **Step 3: Timeline empty state**

Read `src/app/(dashboard)/clients/[id]/timeline/page.tsx`. If it renders an empty state for "no activity yet", set/confirm its icon is `Clock` (already imported in this file per the survey, used for `ACTOR_META`) with title "No activity yet". If there's no `EmptyState` usage there today (i.e., an empty activity list currently renders nothing or a bare `<p>`), add one using the same `EmptyState` component:

```tsx
<EmptyState icon={Clock} title="No activity yet" description="Actions taken on this client will appear here." />
```

- [ ] **Step 4: Reports empty state**

Read `src/app/(dashboard)/reports/page.tsx`. Where a metrics section would otherwise render zeroed/empty charts (e.g., no clients at all for the agency yet), add an `EmptyState` using `BarChart3` (already imported for the page's own stat cards) with title "Data appears as you work" — only add this if the page doesn't already handle the zero-clients case; if `bureauBreakdown`/`typeBreakdown`/`clientMetrics` already degrade gracefully to zeroed cards with no crash, this is a genuine visual gap to fill (add the guard), not a duplicate.

- [ ] **Step 5: Type-check and lint**

Run: `npx tsc --noEmit` — expected clean.
Run: `npm run lint` — expected clean.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/clients/page.tsx" "src/app/(dashboard)/clients/[id]/timeline/page.tsx" "src/app/(dashboard)/reports/page.tsx"
git commit -m "feat: upgrade empty states across clients list, timeline, and reports"
```

---

### Task 9: Final Verification + Docs

**Files:**
- Modify: `CLAUDE.md` (repo root)

**Interfaces:** none — this task only verifies and documents.

- [ ] **Step 1: Full clean build**

Run, in order: `npx tsc --noEmit`, `npm run lint`, `npm run build`.
Expected: all three clean/succeed. If `npm run build` fails on something introduced by an earlier task in this plan, fix it in this task (do not silently patch and skip re-verifying — re-run all three after any fix).

- [ ] **Step 2: Manual click-through, if a dev server is reasonably available**

Start `npm run dev`, and click through: `/dashboard` (sidebar active states, stat cards, gradient onboarding banner if not yet dismissed, chart), `/clients` (table hover/avatars, status pills, card-view toggle), a client detail page (bureau score card borders, item status icons), `/rounds` (pipeline view default, list-view toggle, overdue filter, a card's primary action link navigating to the round workspace), `/` (marketing landing page hero background, pricing card highlight, comparison table). If no dev server is reasonably available in this environment, explicitly note that in your report rather than claiming the click-through was done.

- [ ] **Step 3: Update `CLAUDE.md`**

Add a new bullet to the "Shipped since" list in `CLAUDE.md`, following the existing `- **Session N**` bullet format exactly (see the existing Session 6 bullet for the format), describing what Part A of Session 7 shipped: sidebar/dashboard/client-list/client-detail visual redesign, the new rounds kanban pipeline board (list/pipeline toggle, click-only, no drag-and-drop yet), landing page hero/pricing/comparison upgrades, and empty-state polish. Keep it to the same length/density as the existing Session 5/6 bullets — don't write a multi-paragraph essay.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: record Session 7 Part A (UI/UX redesign + rounds kanban board) in CLAUDE.md"
```
