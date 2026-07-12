import { cn } from "@/lib/utils/helpers";
import { ScrollFadeX } from "@/components/ui/scroll-fade";
import { FaqAccordion } from "./faq-accordion";
import { FAQS } from "./faq-data";
import { Reveal } from "./reveal";
import { PricingCards } from "./pricing-cards";
import {
  Sparkles,
  FileText,
  Smartphone,
  RefreshCw,
  BarChart3,
  HardDrive,
  ArrowRight,
  Check,
  Bell,
  TrendingUp,
  ClipboardList,
  Zap,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Static content                                                      */
/* ------------------------------------------------------------------ */

const MARQUEE_ITEMS = [
  "Credit Repair Agencies",
  "Dispute Specialists",
  "GHL Agencies",
  "Credit Consultants",
  "Financial Coaches",
  "Tax & Credit Firms",
  "Mortgage Brokers",
  "Fintech Startups",
];

const FEATURES = [
  {
    icon: ClipboardList,
    title: "Dispute Management",
    body: "Track every client across rounds, items, and bureaus. Nothing falls through the cracks — or a spreadsheet.",
  },
  {
    icon: Sparkles,
    title: "AI Letter Generation",
    body: "Generate FCRA-compliant dispute letters in seconds. You review and edit every one before it goes out.",
  },
  {
    icon: Smartphone,
    title: "Client Portal",
    body: "A branded portal clients open with a text link — scores, progress, and document uploads, no password.",
  },
  {
    icon: RefreshCw,
    title: "Native GHL Sync",
    body: "Pipelines move, fields update, and your workflows fire automatically. No Zapier, no webhook fees.",
  },
  {
    icon: BarChart3,
    title: "Reports & Analytics",
    body: "Deletion rates, bureau success, and round velocity — see what's working across your whole book.",
  },
  {
    icon: HardDrive,
    title: "Google Drive Sync",
    body: "Every letter, ID, and bureau response filed automatically to your own Drive, organized per client.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Client onboarding",
    body: "Your lead pays and completes your GHL onboarding form. RoundTrack Pro creates the profile, files their documents to Drive, and texts them a portal link — automatically.",
  },
  {
    n: "02",
    title: "Credit analysis",
    body: "Upload the credit report PDF and AI extracts every negative item by bureau. Review the list, confirm, and you're ready to dispute in about two minutes.",
  },
  {
    n: "03",
    title: "AI dispute letters",
    body: "Select the accounts and round type. AI writes the right letter for each bureau, citing the correct FCRA sections. You review, finalize, and export print-ready PDFs.",
  },
  {
    n: "04",
    title: "GHL runs the communication",
    body: "Marking a round sent moves the pipeline stage, updates custom fields, and fires your SMS and email workflows — all through free GHL tags, not paid webhooks.",
  },
  {
    n: "05",
    title: "Track results & repeat",
    body: "Log the bureaus' responses. Deletions update the client's scores and portal, notify them of the win, and queue the next round so momentum never stalls.",
  },
];

type Cell = "yes" | "no" | "partial" | string;

const COMPARE_COLS = ["RoundTrack Pro", "CDM", "DisputeFox", "DisputeBee"];
const COMPARE_ROWS: { label: string; cells: Cell[] }[] = [
  { label: "Native GHL Integration", cells: ["yes", "no", "no", "no"] },
  { label: "AI Dispute Letters", cells: ["yes", "partial", "partial", "partial"] },
  { label: "Free GHL Notifications (tags)", cells: ["yes", "no", "no", "no"] },
  { label: "Branded Client Portal", cells: ["yes", "yes", "yes", "partial"] },
  { label: "Auto Pipeline Moves", cells: ["yes", "no", "no", "no"] },
  { label: "Google Drive Sync", cells: ["yes", "no", "no", "no"] },
  { label: "AI Credit Report Parser", cells: ["yes", "no", "partial", "no"] },
  { label: "Starting Price", cells: ["$49", "$97", "$108", "$49"] },
  { label: "GoHighLevel Required", cells: ["Yes", "No", "No", "No"] },
];

const REPLACES = [
  "CDM or DisputeFox for dispute tracking",
  "Spreadsheets for client and round status",
  "Manual GHL contact updates after every action",
  "Separate email / SMS tools for client updates",
  "Google Drive filing you do by hand",
];

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

function Eyebrow({
  children,
  tone = "dark",
}: {
  children: React.ReactNode;
  tone?: "dark" | "light";
}) {
  return (
    <p
      className={cn(
        "mb-3 text-xs font-semibold uppercase tracking-[0.18em]",
        tone === "dark" ? "text-violet-300" : "text-violet-600"
      )}
    >
      {children}
    </p>
  );
}

function CompareMark({ value }: { value: Cell }) {
  if (value === "yes")
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
    );
  if (value === "no")
    return <span className="text-lg text-slate-300">✕</span>;
  if (value === "partial")
    return <span className="text-base" title="Limited / templates only">⚠️</span>;
  return <span className="text-sm font-semibold text-slate-900">{value}</span>;
}

/* ------------------------------------------------------------------ */
/* Pure-CSS mockups                                                    */
/* ------------------------------------------------------------------ */

function WindowChrome({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
      <div className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
      </div>
      {label && (
        <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 live-indicator" />
          {label}
        </span>
      )}
    </div>
  );
}

/** Hero — a full dashboard: stat cards, pipeline row, round cards + activity feed. */
function HeroDashboardMockup() {
  const stats = [
    { label: "Active clients", value: "24", trend: "+3" },
    { label: "Items disputed", value: "47", trend: "+12" },
    { label: "MRR", value: "$3,096", trend: "+8%" },
    { label: "Deletion rate", value: "68%", trend: "+5%" },
  ];
  const pipeline = [
    ["Preparing", "6"],
    ["Letters ready", "4"],
    ["Sent", "9"],
    ["Awaiting", "5"],
  ];
  const activity = [
    ["Capital One deleted", "Marcus J.", "text-emerald-400"],
    ["Round 2 sent", "Sarah T.", "text-blue-400"],
    ["Portal link opened", "James W.", "text-slate-400"],
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-white/8 bg-[#13131f] shadow-2xl">
      <WindowChrome label="Live" />
      <div className="space-y-4 p-4 sm:p-6">
        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-white/8 bg-white/[0.03] p-3"
            >
              <p className="text-[10px] uppercase tracking-wide text-slate-500">
                {s.label}
              </p>
              <div className="mt-1 flex items-end justify-between">
                <span className="text-xl font-bold text-white">{s.value}</span>
                <span className="flex items-center gap-0.5 text-[10px] font-semibold text-emerald-400">
                  <TrendingUp className="h-3 w-3" />
                  {s.trend}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Pipeline row */}
        <div className="grid grid-cols-4 gap-2">
          {pipeline.map(([label, count]) => (
            <div
              key={label}
              className="rounded-lg border border-white/8 bg-white/[0.02] px-2.5 py-2"
            >
              <p className="truncate text-[9px] uppercase tracking-wide text-slate-500">
                {label}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-slate-200">
                {count}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Two round cards */}
          <div className="space-y-3">
            {[
              { name: "Marcus J.", meta: "Round 2 · Experian", pct: 72 },
              { name: "Sarah T.", meta: "Round 1 · All bureaus", pct: 40 },
            ].map((r) => (
              <div
                key={r.name}
                className="rounded-xl border border-white/8 bg-white/[0.03] p-3"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-blue-600 text-[10px] font-semibold text-white">
                    {r.name
                      .split(" ")
                      .map((p) => p[0])
                      .join("")}
                  </span>
                  <div>
                    <p className="text-xs font-medium text-slate-200">
                      {r.name}
                    </p>
                    <p className="text-[10px] text-slate-500">{r.meta}</p>
                  </div>
                </div>
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500"
                    style={{ width: `${r.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Activity feed */}
          <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Recent activity
              </span>
              <span className="flex items-center gap-1 text-[9px] font-medium uppercase text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 live-indicator" />
                Live
              </span>
            </div>
            <div className="space-y-2.5">
              {activity.map(([text, who, color]) => (
                <div key={text} className="flex items-start gap-2">
                  <Bell className={cn("mt-0.5 h-3 w-3 shrink-0", color)} />
                  <div className="leading-tight">
                    <p className={cn("text-[11px] font-medium", color)}>
                      {text}
                    </p>
                    <p className="text-[10px] text-slate-500">{who}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Pain section — scattered tools converging into one connected flow. */
function ConnectedFlowGraphic() {
  const tools = [
    { emoji: "📊", label: "Spreadsheets" },
    { emoji: "📋", label: "CDM / DisputeFox" },
    { emoji: "📱", label: "Manual GHL" },
  ];
  return (
    <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-[1fr_auto_1fr]">
      <div className="space-y-3">
        {tools.map((t) => (
          <div
            key={t.label}
            className="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3"
          >
            <span className="text-xl">{t.emoji}</span>
            <span className="text-sm font-medium text-slate-500">
              {t.label}
            </span>
            <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Disconnected
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-blue-600 text-white shadow-lg">
          <ArrowRight className="h-5 w-5" />
        </div>
      </div>

      <div className="rounded-2xl border border-violet-200 bg-white p-6 shadow-[0_20px_50px_-24px_rgba(139,92,246,0.5)]">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-blue-600 text-white">
            <Zap className="h-4 w-4" />
          </span>
          <span className="font-semibold text-slate-900">RoundTrack Pro</span>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          One connected flow — disputes, portal, and GHL sync in a single
          system.
        </p>
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Everything in sync</span>
            <span className="text-emerald-600">100%</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full w-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Feature section — AI letter generator: item list + rendered letter preview. */
function LetterGeneratorMockup() {
  const items = [
    { name: "Capital One", bureau: "Experian", state: "Finalized" },
    { name: "Midland Funding", bureau: "TransUnion", state: "Generating" },
    { name: "LVNV Funding", bureau: "Equifax", state: "Pending" },
  ];
  const stateStyle: Record<string, string> = {
    Finalized: "bg-emerald-500/15 text-emerald-400",
    Generating: "bg-blue-500/15 text-blue-400",
    Pending: "bg-white/10 text-slate-400",
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-white/8 bg-[#13131f] shadow-2xl">
      <WindowChrome />
      <div className="grid grid-cols-1 gap-0 sm:grid-cols-2">
        {/* Item list */}
        <div className="space-y-2.5 border-b border-white/8 p-4 sm:border-b-0 sm:border-r">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Round 2 · 3 items
          </p>
          {items.map((it) => (
            <div
              key={it.name}
              className="rounded-lg border border-white/8 bg-white/[0.03] p-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-200">
                  {it.name}
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[9px] font-semibold",
                    stateStyle[it.state]
                  )}
                >
                  {it.state}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-slate-500">{it.bureau}</p>
            </div>
          ))}
        </div>

        {/* Letter preview */}
        <div className="p-4">
          <div className="mb-3 flex items-center gap-2 text-slate-500">
            <FileText className="h-3.5 w-3.5" />
            <span className="text-[10px] font-medium uppercase tracking-wide">
              §611 MOV · Experian
            </span>
          </div>
          <div className="space-y-2">
            <div className="h-2 w-3/4 rounded bg-white/10" />
            <div className="h-2 w-full rounded bg-white/10" />
            <div className="h-2 w-5/6 rounded bg-white/10" />
          </div>
          <div className="my-3 rounded-md border border-violet-500/30 bg-violet-500/10 px-2.5 py-1.5 text-[10px] text-violet-300">
            Cites FCRA §611 — method of verification requested
          </div>
          <div className="space-y-2">
            <div className="h-2 w-full rounded bg-white/10" />
            <div className="h-2 w-2/3 rounded bg-white/10" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Per-step compact mockups for "How it works". */
function StepVisual({ n }: { n: string }) {
  if (n === "01")
    return (
      <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
        <p className="text-[10px] uppercase tracking-wide text-slate-500">
          New client
        </p>
        <div className="mt-2 flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-blue-600 text-[11px] font-semibold text-white">
            MJ
          </span>
          <div>
            <p className="text-xs font-medium text-slate-200">Marcus Johnson</p>
            <p className="text-[10px] text-emerald-400">Portal link sent ✓</p>
          </div>
        </div>
      </div>
    );
  if (n === "02")
    return (
      <div className="space-y-1.5 rounded-xl border border-white/8 bg-white/[0.03] p-4">
        <p className="text-[10px] uppercase tracking-wide text-slate-500">
          Extracted items
        </p>
        {["Capital One", "Midland Funding", "LVNV Funding"].map((x) => (
          <div key={x} className="flex items-center gap-2">
            <Check className="h-3 w-3 text-emerald-400" />
            <span className="text-[11px] text-slate-300">{x}</span>
          </div>
        ))}
      </div>
    );
  if (n === "03") return <LetterGeneratorMockup />;
  if (n === "04")
    return (
      <div className="space-y-2 rounded-xl border border-white/8 bg-white/[0.03] p-4">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-3.5 w-3.5 text-blue-400" />
          <span className="text-[10px] uppercase tracking-wide text-slate-500">
            GHL contact · Marcus J.
          </span>
          <span className="ml-auto rounded-full bg-blue-500/15 px-2 py-0.5 text-[9px] font-medium text-blue-400">
            Round 2 Sent
          </span>
        </div>
        {[
          ["cdp__round_number", "2"],
          ["cdp__items_deleted", "5"],
          ["Tag added", "round-2-sent"],
        ].map(([k, v]) => (
          <div
            key={k}
            className="flex items-center justify-between rounded-md bg-white/[0.03] px-2.5 py-1.5"
          >
            <span className="text-[10px] text-slate-500">{k}</span>
            <span className="text-[10px] font-medium text-slate-300">{v}</span>
          </div>
        ))}
      </div>
    );
  // 05
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">
        Log results
      </p>
      <div className="mt-2 space-y-1.5">
        {[
          ["Capital One", "Deleted"],
          ["Midland Funding", "Deleted"],
          ["LVNV Funding", "Verified"],
        ].map(([name, res]) => (
          <div key={name} className="flex items-center justify-between">
            <span className="text-[11px] text-slate-300">{name}</span>
            <span
              className={cn(
                "flex items-center gap-1 text-[10px] font-semibold",
                res === "Deleted" ? "text-emerald-400" : "text-slate-500"
              )}
            >
              {res === "Deleted" && <Check className="h-3 w-3" />}
              {res}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** "Who it's for" — a live client-detail card. */
function ClientDetailMockup() {
  const scores = [
    ["EQ", "612", "+38"],
    ["EX", "605", "+41"],
    ["TU", "628", "+33"],
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-white/8 bg-[#13131f] shadow-2xl">
      <WindowChrome />
      <div className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-blue-600 text-sm font-semibold text-white">
              MJ
            </span>
            <div>
              <p className="text-sm font-semibold text-white">Marcus Johnson</p>
              <p className="text-[11px] text-slate-500">Round 2 · Awaiting</p>
            </div>
          </div>
          <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-semibold text-emerald-400">
            <Check className="h-3 w-3" /> GHL synced
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {scores.map(([b, v, up]) => (
            <div
              key={b}
              className="rounded-xl border border-white/8 bg-white/[0.03] p-2.5 text-center"
            >
              <p className="text-[9px] uppercase tracking-wide text-slate-500">
                {b}
              </p>
              <p className="mt-0.5 text-lg font-bold text-white">{v}</p>
              <p className="text-[10px] font-medium text-emerald-400">{up}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-2 border-t border-white/8 pt-4">
          {[
            ["8 items disputed", "text-slate-300"],
            ["5 deletions confirmed", "text-emerald-400"],
            ["Next round: ready", "text-blue-400"],
          ].map(([text, color]) => (
            <div key={text} className="flex items-center gap-2">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  color === "text-emerald-400"
                    ? "bg-emerald-400"
                    : color === "text-blue-400"
                      ? "bg-blue-400"
                      : "bg-slate-500"
                )}
              />
              <span className={cn("text-xs", color)}>{text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function LandingPage() {
  // The landing page is always in acquisition mode (even for logged-in
  // visitors): generic "Start a Free Trial" CTAs scroll to the pricing section
  // via native anchors (Next <Link> hash hrefs don't reliably scroll), and the
  // plan cards link to the real /signup destination.

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: { "@type": "Answer", text: faq.a },
    })),
  };

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "RoundTrack Pro",
    applicationCategory: "BusinessApplication",
    description:
      "Dispute management software for credit repair agencies built natively for GoHighLevel",
    offers: {
      "@type": "AggregateOffer",
      lowPrice: "49",
      highPrice: "249",
      priceCurrency: "USD",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        billingDuration: "P1M",
      },
    },
    operatingSystem: "Web browser",
    url: "https://roundtrackpro.com",
  };

  return (
    <>
      {/* ============================================================ */}
      {/* 1. HERO                                                       */}
      {/* ============================================================ */}
      <section
        id="hero"
        className="relative overflow-hidden bg-[#0F1730] text-white"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        />
        <div className="pointer-events-none absolute left-1/2 -top-24 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-violet-600/20 blur-3xl" />

        <div className="relative mx-auto max-w-6xl px-6 pb-16 pt-16 text-center sm:pt-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/15 px-4 py-1.5 text-xs font-medium text-violet-300">
            ✦ Built exclusively for GoHighLevel agencies
          </span>

          <h1 className="font-display mx-auto mt-7 max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Run your entire credit repair operation from one connected platform.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-400">
            AI dispute letters, client and round tracking, a branded portal, and
            native GoHighLevel sync — together in one system. Stop juggling CDM,
            spreadsheets, and manual GHL updates.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="#pricing"
              className="cta-gradient inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold text-white"
            >
              Start a Free Trial
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="#how-it-works"
              className="rounded-xl border border-white/15 bg-white/[0.03] px-6 py-3.5 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/[0.06]"
            >
              See how it works ↓
            </a>
          </div>

          <p className="mt-6 text-xs text-slate-500">
            14-day free trial · No credit card required · Built for GHL
          </p>

          {/* Live dashboard mockup */}
          <div className="mx-auto mt-14 max-w-4xl [perspective:1200px]">
            <div className="hero-mockup">
              <HeroDashboardMockup />
            </div>
          </div>
        </div>

        {/* Marquee */}
        <div className="marquee-mask relative border-t border-white/[0.06] py-5">
          <div className="marquee-track">
            {[0, 1].map((copy) => (
              <div
                key={copy}
                className="flex shrink-0 items-center gap-8 px-4"
                aria-hidden={copy === 1}
              >
                {MARQUEE_ITEMS.map((item) => (
                  <span
                    key={item}
                    className="flex items-center gap-8 whitespace-nowrap text-sm font-medium text-slate-500"
                  >
                    {item}
                    <span className="text-violet-500/40">◆</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 2. PAIN                                                       */}
      {/* ============================================================ */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
          <Reveal>
            <div className="mx-auto max-w-3xl text-center">
              <Eyebrow tone="light">The real problem</Eyebrow>
              <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Your credit repair business isn&apos;t disorganized. Your tools
                are.
              </h2>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <div className="mx-auto mt-8 max-w-3xl space-y-5 text-lg leading-relaxed text-slate-600">
              <p>
                It&apos;s Monday morning. A client texts asking where their case
                stands. You open a spreadsheet to check the round, switch to your
                dispute tool to see the letters, then jump into GoHighLevel to
                update the pipeline and fire off a reply.
              </p>
              <p>
                Three tools, none of them talking to each other. Every deletion
                means re-typing the same result in three places — and every gap
                between them is a missed deadline or a client left in the dark.
              </p>
              <p className="font-medium text-slate-900">
                RoundTrack Pro connects all of it. Do the work once; your
                spreadsheet, your dispute tracker, and your GHL stay in sync
                automatically.
              </p>
            </div>
          </Reveal>

          <Reveal delay={160}>
            <div className="mt-14">
              <ConnectedFlowGraphic />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 3. ZERO EXTRA GHL COST                                        */}
      {/* ============================================================ */}
      <section className="bg-[#0F1730] text-white">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
          <Reveal>
            <div className="mx-auto max-w-3xl text-center">
              <Eyebrow>No hidden webhook fees</Eyebrow>
              <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
                Most dispute tools send notifications through costly GHL
                webhooks. RoundTrack Pro doesn&apos;t.
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-slate-400">
                GHL&apos;s premium webhook actions bill about $0.10 per
                execution. Push a notification on every round, deletion, and
                status change across a full book of clients and those cents turn
                into a monthly bill. RoundTrack Pro drives your workflows with
                contact tags and custom fields instead — actions that are free
                inside your existing GHL plan.
              </p>
            </div>
          </Reveal>

          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-3">
            {[
              { clients: "50 clients", label: "Your GHL webhook bill" },
              { clients: "100 clients", label: "Your GHL webhook bill" },
              { clients: "200 clients", label: "Your GHL webhook bill" },
            ].map((c, i) => (
              <Reveal key={c.clients} delay={i * 80}>
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-7 text-center">
                  <p className="text-sm font-medium text-slate-400">
                    {c.clients}
                  </p>
                  <p className="font-display mt-3 text-4xl font-bold text-emerald-400">
                    $0
                    <span className="text-lg font-normal text-slate-500">
                      /mo
                    </span>
                  </p>
                  <p className="mt-2 text-xs text-slate-500">{c.label}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <p className="mx-auto mt-10 max-w-2xl text-center text-sm text-slate-500">
            You still pay GHL&apos;s standard subscription. RoundTrack Pro&apos;s
            GHL integration is always free.
          </p>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 4. FEATURE OVERVIEW                                           */}
      {/* ============================================================ */}
      <section id="features" className="scroll-mt-20 bg-[#f8fafc]">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
          <Reveal>
            <div className="mx-auto max-w-3xl text-center">
              <Eyebrow tone="light">Everything in one place</Eyebrow>
              <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Everything connected in one credit repair operating system.
              </h2>
            </div>
          </Reveal>

          <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 80}>
                <div className="h-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 text-white">
                    <f.icon className="h-5 w-5" />
                  </span>
                  <h3 className="font-display mt-4 font-semibold text-slate-900">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {f.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={120}>
            <div className="mx-auto mt-14 max-w-3xl">
              <LetterGeneratorMockup />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 5. HOW IT WORKS                                               */}
      {/* ============================================================ */}
      <section id="how-it-works" className="scroll-mt-20 bg-[#0F1730] text-white">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
          <Reveal>
            <div className="mx-auto max-w-3xl text-center">
              <Eyebrow>How it works</Eyebrow>
              <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
                From onboarding to deletions — one continuous flow.
              </h2>
            </div>
          </Reveal>

          <div className="mt-16 space-y-16">
            {STEPS.map((step, i) => (
              <Reveal key={step.n} delay={40}>
                <div
                  className={cn(
                    "grid grid-cols-1 items-center gap-8 md:grid-cols-2 md:gap-14",
                    i % 2 === 1 && "md:[&>*:first-child]:order-2"
                  )}
                >
                  <div>
                    <span className="font-display text-5xl font-bold text-white/10">
                      {step.n}
                    </span>
                    <h3 className="font-display mt-2 text-xl font-semibold text-white">
                      {step.title}
                    </h3>
                    <p className="mt-3 text-base leading-relaxed text-slate-400">
                      {step.body}
                    </p>
                  </div>
                  <div>
                    <StepVisual n={step.n} />
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 6. COMPARISON                                                 */}
      {/* ============================================================ */}
      <section id="compare" className="scroll-mt-20 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
          <Reveal>
            <div className="mx-auto max-w-3xl text-center">
              <Eyebrow tone="light">How we compare</Eyebrow>
              <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                The same jobs. Without the double entry.
              </h2>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <ScrollFadeX className="mt-12 rounded-2xl border border-slate-200 shadow-sm">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-5 py-4 text-left font-medium text-slate-500">
                      Capability
                    </th>
                    {COMPARE_COLS.map((col, idx) => (
                      <th
                        key={col}
                        className={cn(
                          "px-5 py-4 text-center font-semibold",
                          idx === 0
                            ? "text-violet-700"
                            : "text-slate-500"
                        )}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARE_ROWS.map((row) => (
                    <tr
                      key={row.label}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="px-5 py-3.5 font-medium text-slate-700">
                        {row.label}
                      </td>
                      {row.cells.map((cell, idx) => (
                        <td
                          key={idx}
                          className={cn(
                            "px-5 py-3.5 text-center",
                            idx === 0 && "bg-violet-50/60"
                          )}
                        >
                          <CompareMark value={cell} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollFadeX>
          </Reveal>

          <p className="mt-6 text-center text-xs text-slate-400">
            CDM, DisputeFox, and DisputeBee pricing verified July 2026. Plans and
            fees can change.
          </p>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 7. WHO IT'S FOR                                               */}
      {/* ============================================================ */}
      <section className="bg-[#0F1730] text-white">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-6 py-16 sm:py-24 md:grid-cols-2 md:gap-16">
          <Reveal>
            <Eyebrow>Who it&apos;s for</Eyebrow>
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Built for GHL-powered credit repair agencies that need more than a
              dispute tracker.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-400">
              Replaces a stack of tools you&apos;re already paying for and
              stitching together by hand:
            </p>
            <ul className="mt-6 space-y-3">
              {REPLACES.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 text-sm text-slate-300"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={120}>
            <ClientDetailMockup />
          </Reveal>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 8. PRICING                                                    */}
      {/* ============================================================ */}
      <section id="pricing" className="scroll-mt-20 bg-[#f8fafc]">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
          <Reveal>
            <div className="mx-auto max-w-3xl text-center">
              <Eyebrow tone="light">Pricing</Eyebrow>
              <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Simple pricing. No surprises.
              </h2>
              <p className="mt-4 text-lg text-slate-600">
                Every plan includes a 14-day free trial. No credit card required
                to start.
              </p>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <div className="mt-12">
              <PricingCards />
            </div>
          </Reveal>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-slate-400">
            {[
              "14-day free trial",
              "Cancel anytime",
              "Setup support included",
              "GHL snapshot included",
              "Built for GoHighLevel",
            ].map((b) => (
              <span key={b} className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-emerald-500" />
                {b}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 9. FAQ                                                        */}
      {/* ============================================================ */}
      <section id="faq" className="scroll-mt-20 bg-[#0F1730]">
        <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
          <Reveal>
            <div className="mx-auto mb-10 max-w-2xl text-center">
              <Eyebrow>FAQ</Eyebrow>
              <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Questions, answered.
              </h2>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <FaqAccordion />
          </Reveal>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 10. FOUNDER NOTE                                              */}
      {/* ============================================================ */}
      <section className="bg-white">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center sm:py-24">
          <Reveal>
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-blue-600 text-xl font-bold text-white shadow-lg">
              TI
            </span>
            <blockquote className="font-display mt-6 text-xl leading-relaxed text-slate-700 sm:text-2xl">
              &ldquo;I kept watching credit repair agencies juggle CDM,
              spreadsheets, and GoHighLevel — spending more time keeping tools in
              sync than serving clients. RoundTrack Pro exists to make running a
              credit repair business feel like doing the work again, not managing
              the software around it.&rdquo;
            </blockquote>
            <p className="mt-6 font-semibold text-slate-900">Towfiqul Islam</p>
            <p className="text-sm text-slate-500">Founder, RoundTrack Pro</p>
            <a
              href="#how-it-works"
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-violet-600 hover:text-violet-700"
            >
              Read about RoundTrack Pro
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </Reveal>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 11. FINAL CTA                                                 */}
      {/* ============================================================ */}
      <section className="bg-[#0F1730] text-white">
        <div className="relative mx-auto max-w-4xl overflow-hidden px-6 py-20 text-center">
          <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-violet-600/20 blur-3xl" />
          <Reveal>
            <h2 className="font-display relative text-3xl font-bold tracking-tight sm:text-4xl">
              Stop running your credit repair business across three different
              tools.
            </h2>
            <p className="relative mx-auto mt-4 max-w-xl text-lg text-slate-400">
              Disputes, client communication, and GHL — connected in one
              platform, with a 14-day free trial to prove it.
            </p>
            <a
              href="#pricing"
              className="cta-gradient relative mt-8 inline-flex items-center gap-2 rounded-xl px-7 py-4 text-sm font-semibold text-white"
            >
              Start Your Free 14-Day Trial
              <ArrowRight className="h-4 w-4" />
            </a>
            <div className="relative mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-500">
              {[
                "No credit card required",
                "Setup in 15 minutes",
                "Cancel anytime",
              ].map((b) => (
                <span key={b} className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  {b}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SEO text block (small, crawler-oriented)                     */}
      {/* ============================================================ */}
      <section className="bg-[#0F1730]">
        <div className="mx-auto max-w-4xl space-y-6 border-t border-white/[0.06] px-6 py-14 text-xs leading-relaxed text-slate-500">
          <div>
            <h2 className="font-semibold text-slate-400">
              What is RoundTrack Pro?
            </h2>
            <p className="mt-1">
              RoundTrack Pro is dispute management software for credit repair
              agencies built natively for GoHighLevel (GHL). It provides
              AI-powered dispute letter generation, an automated client portal,
              round tracking, and full GHL integration including pipeline sync,
              custom field updates, and workflow automation through free contact
              tags.
            </p>
          </div>
          <div>
            <h2 className="font-semibold text-slate-400">
              Who uses RoundTrack Pro?
            </h2>
            <p className="mt-1">
              Credit repair business owners, dispute specialists, and credit
              repair agencies that use GoHighLevel as their CRM. It supports solo
              operators through multi-seat teams depending on plan, from Starter
              to Agency.
            </p>
          </div>
          <div>
            <h2 className="font-semibold text-slate-400">
              How does RoundTrack Pro compare to CDM, DisputeFox, and DisputeBee?
            </h2>
            <p className="mt-1">
              RoundTrack Pro is the only dispute management software with native
              GoHighLevel integration. Unlike CDM, DisputeFox, and DisputeBee —
              which operate as standalone platforms requiring manual data
              transfer — RoundTrack Pro syncs automatically with GHL contacts,
              pipelines, and workflows, without per-execution webhook fees.
            </p>
          </div>
          <p className="border-t border-white/[0.06] pt-6 text-slate-600">
            Practice management software for credit professionals. Not a credit
            repair service. Not legal advice. Not affiliated with HighLevel, Inc.
          </p>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
    </>
  );
}
