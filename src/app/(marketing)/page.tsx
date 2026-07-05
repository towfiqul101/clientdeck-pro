import Link from "next/link";
import { getSessionContext } from "@/lib/auth/session";
import { PLANS } from "@/lib/billing/plans";
import { cn } from "@/lib/utils/helpers";
import { FaqAccordion } from "./faq-accordion";
import {
  Sparkles,
  RefreshCw,
  LayoutDashboard,
  Check,
  X,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";

const FEATURES = [
  {
    icon: Sparkles,
    title: "AI Letter Generation",
    body: "Claude AI writes FCRA-compliant dispute letters in seconds. Staff reviews, edits, and sends. No template library to maintain.",
  },
  {
    icon: RefreshCw,
    title: "Native GHL Sync",
    body: "When a deletion is logged, GHL automatically moves the pipeline, sends the win SMS, and updates the client portal. One action. Everything updates.",
  },
  {
    icon: LayoutDashboard,
    title: "Branded Client Portal",
    body: "Your clients get a magic-link portal with their scores, round history, and documents. Looks like your brand. Zero maintenance from your team.",
  },
];

const STEPS = [
  { n: 1, title: "Add the client", body: "Import from GHL or add manually — items entered in minutes." },
  { n: 2, title: "Generate round letters", body: "AI drafts the letters, you review, export the PDF, and mail." },
  { n: 3, title: "Log results", body: "The client gets notified and GHL updates automatically." },
];

type Cell = "yes" | "no" | "partial" | string;
const COMPARISON: { feature: string; cd: Cell; cdm: Cell; fox: Cell; bee: Cell }[] = [
  { feature: "Native GHL Integration", cd: "yes", cdm: "no", fox: "no", bee: "no" },
  { feature: "AI Letter Generation", cd: "yes", cdm: "yes", fox: "partial", bee: "no" },
  { feature: "Branded Client Portal", cd: "yes", cdm: "yes", fox: "yes", bee: "partial" },
  { feature: "Two-way CRM Sync", cd: "yes", cdm: "no", fox: "no", bee: "no" },
  { feature: "Auto Pipeline Updates", cd: "yes", cdm: "no", fox: "no", bee: "no" },
  { feature: "Starting Price", cd: "$49", cdm: "$97", fox: "$108", bee: "$49" },
];

function Mark({ v, color = "text-gray-400" }: { v: Cell; color?: string }) {
  if (v === "yes") return <Check className={cn("mx-auto h-5 w-5", color)} />;
  if (v === "no") return <X className="mx-auto h-5 w-5 text-gray-300" />;
  if (v === "partial") return <AlertTriangle className="mx-auto h-4 w-4 text-amber-500" />;
  return <span className="font-medium text-gray-900">{v}</span>;
}

export default async function LandingPage() {
  const session = await getSessionContext();
  const primaryCta = session
    ? { href: "/dashboard", label: "Go to Dashboard" }
    : { href: "/signup", label: "Start Free Trial" };

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gray-950 text-white">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(circle, #ffffff12 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="pointer-events-none absolute left-1/2 -top-20 h-96 w-96 -translate-x-1/2 rounded-full bg-blue-600/20 blur-3xl" />
        <div className="relative mx-auto max-w-4xl px-4 py-24 text-center">
          <p className="mb-4 text-sm font-medium text-blue-400">
            Trusted by credit professionals using GoHighLevel
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            The Dispute Management Platform Built for GoHighLevel Agencies
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-300">
            AI-powered correspondence, automated client updates, and a branded
            client portal — all synced natively with the GHL you already run on.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={primaryCta.href}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-blue-700"
            >
              {primaryCta.label} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/snapshot"
              className="rounded-md border border-gray-700 px-6 py-3 text-sm font-semibold text-gray-200 transition-colors duration-150 hover:bg-gray-900"
            >
              Watch Demo — 3 min
            </Link>
          </div>

          <div className="mx-auto mt-16 max-w-4xl rounded-xl border border-gray-700 bg-gray-900 text-left shadow-2xl">
            <div className="flex items-center gap-1.5 border-b border-gray-800 px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-gray-700" />
              <span className="h-2.5 w-2.5 rounded-full bg-gray-700" />
              <span className="h-2.5 w-2.5 rounded-full bg-gray-700" />
            </div>
            <div className="grid grid-cols-2 gap-3 p-6 sm:grid-cols-4">
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
        </div>
      </section>

      {/* Problem */}
      <section className="bg-white">
        <div className="mx-auto max-w-3xl px-4 py-20">
          <h2 className="text-center text-2xl font-semibold text-gray-900">
            Running credit repair on GHL + CDM means:
          </h2>
          <ul className="mx-auto mt-8 max-w-xl space-y-3">
            {[
              "Two systems, double the data entry",
              "Manual copy-paste to update clients",
              "Generic portals your clients never check",
              "No visibility into what's actually working",
            ].map((p) => (
              <li key={p} className="flex items-start gap-3 text-gray-700">
                <X className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                {p}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Solution / features */}
      <section id="features" className="bg-gray-50">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <h2 className="text-center text-2xl font-semibold text-gray-900">
            One platform. Everything synced.
          </h2>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                <f.icon className="h-8 w-8 text-blue-600" />
                <h3 className="mt-4 font-semibold text-gray-900">{f.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white">
        <div className="mx-auto max-w-5xl px-4 py-20">
          <h2 className="text-center text-2xl font-semibold text-gray-900">How it works</h2>
          <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="text-center">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 text-lg font-semibold text-white">
                  {s.n}
                </div>
                <h3 className="mt-4 font-semibold text-gray-900">{s.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-gray-50">
        <div className="mx-auto max-w-5xl px-4 py-20">
          <h2 className="text-center text-2xl font-semibold text-gray-900">
            Simple, transparent pricing
          </h2>
          <p className="mt-2 text-center text-sm text-gray-500">
            14 days free, no credit card required.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={cn(
                  "relative flex flex-col rounded-lg border bg-white shadow-sm transition-transform duration-150",
                  plan.highlight ? "scale-[1.02] border-blue-600" : "border-gray-200"
                )}
              >
                {plan.highlight && (
                  <span className="absolute right-4 top-0 -translate-y-1/2 rounded-full bg-blue-600 px-3 py-1 text-xs font-bold text-white">
                    Most Popular
                  </span>
                )}
                <div
                  className={cn(
                    "rounded-t-lg px-6 py-5",
                    plan.highlight ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white" : ""
                  )}
                >
                  <h3 className={cn("font-semibold", plan.highlight ? "text-white" : "text-gray-900")}>
                    {plan.name}
                  </h3>
                  <p className={cn("mt-2 text-3xl font-bold", plan.highlight ? "text-white" : "text-gray-900")}>
                    {plan.priceLabel}
                    <span className={cn("text-sm font-normal", plan.highlight ? "text-blue-100" : "text-gray-500")}>
                      /mo
                    </span>
                  </p>
                  <p className={cn("mt-1 text-sm", plan.highlight ? "text-blue-100" : "text-gray-500")}>
                    {plan.clientsLabel}
                  </p>
                </div>
                <div className="flex flex-1 flex-col px-6 pb-6">
                  <ul className="mt-4 flex-1 space-y-2">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/signup"
                    className={cn(
                      "mt-5 rounded-md px-4 py-2 text-center text-sm font-medium transition-colors duration-150",
                      plan.highlight
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    Start Free Trial
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="bg-white">
        <div className="mx-auto max-w-4xl px-4 py-20">
          <h2 className="text-center text-2xl font-semibold text-gray-900">
            How ClientDeck Pro compares
          </h2>
          <div className="mt-10 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead className="bg-blue-600 text-white">
                <tr>
                  <th className="sticky left-0 bg-blue-600 px-3 py-3 text-left font-medium">Feature</th>
                  <th className="px-3 py-3 text-center font-semibold">ClientDeck Pro</th>
                  <th className="px-3 py-3 text-center font-medium">CDM</th>
                  <th className="px-3 py-3 text-center font-medium">DisputeFox</th>
                  <th className="px-3 py-3 text-center font-medium">DisputeBee</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr
                    key={row.feature}
                    className={cn("border-b border-gray-100", i % 2 === 0 ? "bg-white" : "bg-gray-50")}
                  >
                    <td className="sticky left-0 bg-inherit px-3 py-3 font-medium text-gray-900">
                      {row.feature}
                    </td>
                    <td className="bg-blue-50/50 px-3 py-3 text-center">
                      <Mark v={row.cd} color="text-blue-600" />
                    </td>
                    <td className="px-3 py-3 text-center"><Mark v={row.cdm} /></td>
                    <td className="px-3 py-3 text-center"><Mark v={row.fox} /></td>
                    <td className="px-3 py-3 text-center"><Mark v={row.bee} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-gray-50">
        <div className="mx-auto max-w-3xl px-4 py-20">
          <h2 className="mb-10 text-center text-2xl font-semibold text-gray-900">
            Frequently asked questions
          </h2>
          <FaqAccordion />
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-gray-950 text-white">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <h2 className="text-3xl font-bold">Ready to run credit repair the modern way?</h2>
          <p className="mt-3 text-gray-300">Start your 14-day free trial. No credit card required.</p>
          <Link
            href={primaryCta.href}
            className="mt-8 inline-flex items-center gap-2 rounded-md bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            {primaryCta.label} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  );
}
