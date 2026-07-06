# Rounds Kanban Visual Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the existing `/rounds` pipeline board to look more like a GHL-style kanban (left-border column headers with a subtitle, wider cards with a horizontal bureau-count row and a full-width action button, a richer empty-column state) and make Pipeline the sticky default view via `localStorage` instead of a URL query param.

**Architecture:** All visual changes are contained to `src/app/(dashboard)/rounds/rounds-kanban.tsx` (pure styling/markup, no data-shape changes). The list/pipeline toggle moves from server-side `?view=` URL routing into a new client component (`RoundsViewSwitcher`) that renders both pre-fetched views and toggles visibility with CSS + `localStorage`, so the server page still does one data fetch and no client-side re-fetch is needed on toggle.

**Tech Stack:** Next.js 16 (Server Components for data fetching, one small Client Component for the view toggle), Tailwind CSS, Lucide icons.

## Global Constraints

- No data-shape or query changes — `KanbanRound`, `RoundRow`, and the Supabase query in `page.tsx` are untouched; this plan only changes JSX/classNames and where `view` state lives.
- No new database migrations, no new dependencies (no drag-and-drop library — the spec explicitly says "click-only, no drag-and-drop yet").
- No test framework in this repo — verify with `npx tsc --noEmit`, `npm run lint`, `npm run build`, and a manual click-through at `/rounds`.
- Avoid a hydration mismatch: `localStorage` is only readable client-side, so the view-switcher must initialize to `"pipeline"` on first render and only switch after a `useEffect` reads `localStorage` post-mount — never read `localStorage` during the initial render.

---

### Task 1: Column header restyle — left border, subtitle, count pill

**Files:**
- Modify: `src/app/(dashboard)/rounds/rounds-kanban.tsx`

**Interfaces:** None — `StageConfig`/`STAGE_CONFIG`/`STAGE_ORDER` keep their existing shape and consumers (`RoundsKanban`'s desktop and mobile render blocks); only the `colorBorder` values and the header JSX change.

- [ ] **Step 1: Switch `colorBorder` from top-border to left-border classes**

In `src/app/(dashboard)/rounds/rounds-kanban.tsx`, in `STAGE_CONFIG`, change each `colorBorder` value:

```ts
const STAGE_CONFIG: Record<RoundStatus, StageConfig> = {
  preparing: {
    label: "Preparing",
    colorBorder: "border-l-gray-400",
    headerBg: "bg-gray-50",
    icon: FileText,
    description: "Letters being prepared",
  },
  letters_generated: {
    label: "Letters Ready",
    colorBorder: "border-l-indigo-500",
    headerBg: "bg-indigo-50",
    icon: CheckSquare,
    description: "Ready to send",
  },
  sent: {
    label: "Sent to Bureaus",
    colorBorder: "border-l-blue-500",
    headerBg: "bg-blue-50",
    icon: Send,
    description: "Awaiting bureau response",
  },
  awaiting_response: {
    label: "Awaiting Response",
    colorBorder: "border-l-amber-500",
    headerBg: "bg-amber-50",
    icon: Clock,
    description: "Bureaus have 35 days",
  },
  complete: {
    label: "Complete",
    colorBorder: "border-l-green-500",
    headerBg: "bg-green-50",
    icon: CheckCircle,
    description: "Results logged",
  },
};
```

- [ ] **Step 2: Restyle the desktop column header**

Replace the desktop column header block (inside the `hidden gap-4 overflow-x-auto pb-2 sm:flex` map):

```tsx
<div key={status} className="w-[280px] shrink-0">
  <div className={cn("mb-3 rounded-t-lg border-t-2 px-3 py-2", config.colorBorder, config.headerBg)}>
```
through its closing `</div>` (the header block with the label + count), with:

```tsx
<div key={status} className="w-[280px] shrink-0">
  <div className={cn("mb-3 rounded-lg border-l-4 px-3 py-2.5", config.colorBorder, config.headerBg)}>
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
        <Icon className="h-4 w-4 text-gray-400" />
        {config.label}
      </span>
      <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-gray-600">
        {stageRounds.length}
      </span>
    </div>
    <p className="mt-0.5 text-xs text-gray-500">{config.description}</p>
  </div>
```

(The `w-60` → `w-[280px]` change here matches the card width change in Task 2, Step 1 — the column and its cards should stay the same width.)

- [ ] **Step 3: Restyle the mobile accordion header to match**

Replace the mobile header button:

```tsx
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
```
with:
```tsx
<button
  type="button"
  onClick={() => setExpandedMobileStage(status)}
  className={cn("flex w-full flex-col rounded-t-lg border-l-4 px-3 py-2.5 text-left", config.colorBorder, config.headerBg)}
>
  <div className="flex items-center justify-between gap-2">
    <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
      <Icon className="h-4 w-4 text-gray-400" />
      {config.label}
    </span>
    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-gray-600">
      {stageRounds.length}
    </span>
  </div>
  <p className="mt-0.5 text-xs text-gray-500">{config.description}</p>
</button>
```

- [ ] **Step 4: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/rounds/rounds-kanban.tsx"
git commit -m "style: switch kanban column headers to left-border with subtitle (GHL-style)"
```

---

### Task 2: Round card restyle — wider card, horizontal bureau row, full-width action, richer empty state

**Files:**
- Modify: `src/app/(dashboard)/rounds/rounds-kanban.tsx`

**Interfaces:** None — `KanbanRound`, `RoundCard`, `DeadlinePill`, `primaryAction` keep their existing prop shapes; only internal JSX/classNames change.

- [ ] **Step 1: Widen the card and switch the bureau-count list to a horizontal row**

Replace `RoundCard`'s outer wrapper width:

```tsx
<div className="w-60 shrink-0 rounded-xl border border-gray-200 bg-white shadow-[var(--shadow-card)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)]">
```
with:
```tsx
<div className="w-[280px] shrink-0 rounded-xl border border-gray-200 bg-white shadow-[var(--shadow-card)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)]">
```

Replace the bureau-counts block:

```tsx
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
```
with:
```tsx
{totalItems > 0 && (
  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-gray-100 p-3">
    {(["equifax", "experian", "transunion"] as Bureau[]).map((b) =>
      round.bureauCounts[b] > 0 ? (
        <span key={b} className="flex items-center gap-1.5 text-xs text-gray-600">
          <span className={cn("h-1.5 w-1.5 rounded-full", BUREAU_DOTS[b])} />
          {BUREAU_LABELS[b]} {round.bureauCounts[b]}
        </span>
      ) : null
    )}
  </div>
)}
```

- [ ] **Step 2: Add a clock icon to the deadline pill**

Replace `DeadlinePill`'s import line at the top of the file:

```tsx
import { FileText, CheckSquare, Send, Clock, CheckCircle } from "lucide-react";
```
with (adding `AlertTriangle`, used by the empty-state icon fallback is not needed — `Clock` is already imported and reused here):
```tsx
import { FileText, CheckSquare, Send, Clock, CheckCircle } from "lucide-react";
```
(no import change needed — `Clock` is already imported). Then replace `DeadlinePill`'s body:

```tsx
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
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", tone)}>
      <Clock className="h-3 w-3" />
      {days}d remaining
    </span>
  );
}
```
(Only the non-overdue branch changes — adds the `Clock` icon and `gap-1`; the overdue branch is unchanged.)

- [ ] **Step 3: Replace the split footer with one full-width action button**

Replace the card footer:

```tsx
<div className="flex items-center justify-between gap-2 border-t border-gray-100 p-3">
  <Link href={action.href} className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white transition-colors duration-150 hover:bg-blue-700">
    {action.label}
  </Link>
  <Link href={workspaceHref} className="text-xs font-medium text-gray-500 hover:text-gray-700">
    View →
  </Link>
</div>
```
with:
```tsx
<div className="border-t border-gray-100 p-3">
  <Link
    href={action.href}
    className="flex w-full items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition-colors duration-150 hover:bg-blue-700"
  >
    {action.label} →
  </Link>
</div>
```
(The separate "View →" link is dropped — the client name/avatar header at the top of the card already links to the same workspace.)

- [ ] **Step 4: Richer empty-column state (desktop + mobile)**

There are two identical empty-state blocks (desktop grid and mobile accordion). Replace both occurrences of:

```tsx
<div className="rounded-xl border border-dashed border-gray-200 p-4 text-center text-xs text-gray-400">
  No rounds here
</div>
```
with:
```tsx
<div className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 bg-gray-50/50 px-4 py-8 text-center text-xs text-gray-400">
  <Icon className="h-5 w-5 text-gray-300" />
  No rounds here
</div>
```
(Both occurrences are inside blocks that already destructure `Icon` from `config.icon` in their enclosing `.map()`, so no new variable needs introducing.)

- [ ] **Step 5: Verify types and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/rounds/rounds-kanban.tsx"
git commit -m "style: widen kanban cards, horizontal bureau row, full-width action button, richer empty state"
```

---

### Task 3: Pipeline view as the sticky default (localStorage, not URL)

**Files:**
- Create: `src/app/(dashboard)/rounds/rounds-view-switcher.tsx`
- Modify: `src/app/(dashboard)/rounds/page.tsx`

**Interfaces:**
- Produces: `<RoundsViewSwitcher listView={ReactNode} pipelineView={ReactNode} />` — renders both, toggles visibility client-side, persists the choice to `localStorage["cdp-rounds-view"]`.
- Removes: `buildViewUrl()`, the `view`/`viewParam` URL-derived variables, and the inline List/Pipeline `<Link>` toggle from `page.tsx` — replaced by the new component.

- [ ] **Step 1: Build the view switcher**

Create `src/app/(dashboard)/rounds/rounds-view-switcher.tsx`:

```tsx
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { List, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils/helpers";

const STORAGE_KEY = "cdp-rounds-view";
type View = "list" | "pipeline";

/**
 * Renders both the list and pipeline views (already server-rendered by the
 * caller) and toggles which is visible client-side, persisting the choice to
 * localStorage. Starts at "pipeline" on every render (server and first
 * client render must match to avoid a hydration mismatch) and only switches
 * after mount, once localStorage is readable.
 */
export function RoundsViewSwitcher({
  listView,
  pipelineView,
}: {
  listView: ReactNode;
  pipelineView: ReactNode;
}) {
  const [view, setView] = useState<View>("pipeline");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "list" || stored === "pipeline") setView(stored);
  }, []);

  function choose(next: View) {
    setView(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <div className="flex items-center gap-1 rounded-md border border-gray-200 p-0.5">
          <button
            type="button"
            onClick={() => choose("list")}
            className={cn(
              "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors duration-150",
              view === "list" ? "bg-gray-100 text-gray-700" : "text-gray-400 hover:text-gray-600"
            )}
          >
            <List className="h-3.5 w-3.5" /> List
          </button>
          <button
            type="button"
            onClick={() => choose("pipeline")}
            className={cn(
              "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors duration-150",
              view === "pipeline" ? "bg-gray-100 text-gray-700" : "text-gray-400 hover:text-gray-600"
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Pipeline
          </button>
        </div>
      </div>
      <div className={view === "list" ? "" : "hidden"}>{listView}</div>
      <div className={view === "pipeline" ? "" : "hidden"}>{pipelineView}</div>
    </div>
  );
}
```

- [ ] **Step 2: Rewire `page.tsx` to use it**

In `src/app/(dashboard)/rounds/page.tsx`:

1. Remove the `buildViewUrl` function entirely, and remove `viewParam`/`view` from the component body:

```ts
const viewParam = typeof sp.view === "string" ? sp.view : "";
const view = viewParam === "list" ? "list" : "pipeline"; // pipeline is default per spec
```
(delete these two lines — `view` is no longer computed server-side).

2. Remove the unused `List`/`LayoutGrid` import (they move into `rounds-view-switcher.tsx`), keeping `Clock`:

```ts
import { Clock, List, LayoutGrid } from "lucide-react";
```
becomes:
```ts
import { Clock } from "lucide-react";
```

3. Add the import for the new component:

```ts
import { RoundsViewSwitcher } from "./rounds-view-switcher";
```

4. Replace the whole returned JSX's header + view-conditional block — currently:

```tsx
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Rounds</h2>
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-sm font-medium text-gray-600">
            {rounds.length}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-md border border-gray-200 p-0.5">
            <Link
              href={buildViewUrl("list", statusFilter)}
              className={cn(
                "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors duration-150",
                view === "list"
                  ? "bg-gray-100 text-gray-700"
                  : "text-gray-400 hover:text-gray-600"
              )}
            >
              <List className="h-3.5 w-3.5" /> List
            </Link>
            <Link
              href={buildViewUrl("pipeline", statusFilter)}
              className={cn(
                "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors duration-150",
                view === "pipeline"
                  ? "bg-gray-100 text-gray-700"
                  : "text-gray-400 hover:text-gray-600"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Pipeline
            </Link>
          </div>
          <RoundsFilter />
        </div>
      </div>

      {view === "pipeline" ? (
        rounds.length === 0 ? (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <EmptyState
              icon={Clock}
              title="No rounds found"
              description={
                statusFilter
                  ? "No rounds match this status filter."
                  : "Rounds appear here once you start disputing items for a client."
              }
            />
          </div>
        ) : (
          <RoundsKanban rounds={kanbanRounds} />
        )
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          {rounds.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="No rounds found"
              description={
                statusFilter
                  ? "No rounds match this status filter."
                  : "Rounds appear here once you start disputing items for a client."
              }
            />
          ) : (
            <div className="overflow-x-auto">
              {/* ...table... */}
            </div>
          )}
        </div>
      )}
    </div>
  );
```

with (the two `EmptyState`/table/kanban bodies are unchanged — only pulled out into `listView`/`pipelineView` variables and the header's toggle is removed since `RoundsViewSwitcher` now owns it):

```tsx
  const emptyState = (
    <EmptyState
      icon={Clock}
      title="No rounds found"
      description={
        statusFilter
          ? "No rounds match this status filter."
          : "Rounds appear here once you start disputing items for a client."
      }
    />
  );

  const pipelineView =
    rounds.length === 0 ? (
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {emptyState}
      </div>
    ) : (
      <RoundsKanban rounds={kanbanRounds} />
    );

  const listView = (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      {rounds.length === 0 ? (
        emptyState
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            {/* ...unchanged thead/tbody from the existing table... */}
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Rounds</h2>
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-sm font-medium text-gray-600">
            {rounds.length}
          </span>
        </div>
        <RoundsFilter />
      </div>

      <RoundsViewSwitcher listView={listView} pipelineView={pipelineView} />
    </div>
  );
```

Keep the existing `<table>`'s full `thead`/`tbody` markup exactly as it is today (client name/round/status/sent/deadline/items columns) — only its wrapping location moves from an inline `{view === "list" ? ... : ...}` ternary into the `listView` variable.

- [ ] **Step 3: Verify types, lint, and build**

Run: `npx tsc --noEmit`
Expected: no errors (confirms `buildViewUrl`, `view`, `viewParam`, and the removed `List`/`LayoutGrid` imports have no other consumers left in this file).

Run: `npm run lint`
Expected: no new errors.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual check**

Run `npm run dev`, visit `/rounds` → Pipeline view shows by default. Click "List" → table view shows. Reload the page → still shows List (persisted). Clear `localStorage` (or open in a private window) → Pipeline shows again by default.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/rounds/rounds-view-switcher.tsx" "src/app/(dashboard)/rounds/page.tsx"
git commit -m "feat: persist rounds list/pipeline view choice to localStorage instead of a URL param"
```

---

## Self-Review Notes

- **Spec coverage:** column header left-border/subtitle/pill → Task 1; wider cards, horizontal bureau row, full-width action, richer empty state → Task 2; "Pipeline view as default (saved to localStorage)" → Task 3.
- **Reconciled spec/code mismatch:** the spec's mockup used generic ASCII widths; this plan standardizes on `w-[280px]` (an arbitrary Tailwind value) for both columns and cards since neither `w-60` (240px) nor `w-72` (288px) matches the spec's stated 280px exactly.
- **No drag-and-drop:** confirmed out of scope per the spec's own note ("click-only — no drag-and-drop yet") — Task 3 only changes *which* view is shown by default, not how rounds move between stages (that stays a click-through to the round workspace, unchanged).
- **Type consistency:** `RoundsViewSwitcher`'s `listView`/`pipelineView` props are typed as `ReactNode`, matching what `page.tsx` passes (JSX expressions built from the exact same `EmptyState`/`RoundsKanban`/`<table>` markup that existed before, just relocated).
