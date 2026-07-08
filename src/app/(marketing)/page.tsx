import Link from "next/link";
import { getSessionContext } from "@/lib/auth/session";
import { PLANS } from "@/lib/billing/plans";
import { cn } from "@/lib/utils/helpers";
import { FaqAccordion } from "./faq-accordion";
import { FAQS } from "./faq-data";
import { Reveal } from "./reveal";
import {
  Sparkles,
  Smartphone,
  RefreshCw,
  Check,
  ArrowRight,
  Star,
  FileText,
  Workflow,
  Bell,
  TrendingUp,
  Clock,
} from "lucide-react";

const TRUST_BADGES = [
  "Built for GoHighLevel",
  "No spreadsheets needed",
  "AI-powered letters",
  "Clients love the portal",
  "Setup in 15 minutes",
];

const PAIN_POINTS = [
  {
    emoji: "😤",
    title: "I'm managing disputes in a spreadsheet",
    body: "Tracking rounds, results, and follow-ups across 50+ clients in Excel. One mistake and you miss a bureau deadline.",
  },
  {
    emoji: "📋",
    title: "My clients have no idea what's happening",
    body: "They text you asking for updates. You spend hours manually sending progress emails that no one reads.",
  },
  {
    emoji: "🔄",
    title: "I'm using GHL AND a separate dispute tool",
    body: "Double data entry. Nothing syncs. You're paying for two systems that don't talk to each other.",
  },
];

const SOLUTION_FEATURES = [
  {
    icon: Sparkles,
    title: "AI Writes Your Dispute Letters",
    body: "Pick the accounts to dispute, click generate. AI writes FCRA-compliant letters for every bureau in seconds. You review, edit if you want, and mail. Never write a dispute letter from scratch again.",
  },
  {
    icon: Smartphone,
    title: "Clients See Their Progress — Automatically",
    body: "Every client gets a beautiful portal with their credit scores, deleted accounts, and round history. It updates automatically when you log results. No more “what's the status?” texts.",
  },
  {
    icon: RefreshCw,
    title: "GHL Updates Without You Touching It",
    body: "When you delete an item, GHL moves the pipeline, tags the contact, and fires your SMS workflow. All automatic. Your GHL runs your business. You run the work.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Client Gets Onboarded",
    body: "Your client pays in GHL and fills your onboarding form. ClientDeck Pro automatically creates their profile, saves their documents to Google Drive, and sends them their portal link.",
  },
  {
    n: "02",
    title: "You Add Their Credit Items",
    body: "Upload their credit report PDF — AI extracts every negative item automatically. Review the list and confirm. Done in 2 minutes. No manual typing.",
  },
  {
    n: "03",
    title: "AI Generates the Letters",
    body: "Select which accounts to dispute. AI writes the correct letter for every account and every bureau. Review, finalize, download the PDFs. Mail them certified.",
  },
  {
    n: "04",
    title: "GHL Handles the Rest",
    body: "When you log results, GHL sends a celebration text on deletions, moves the client to the right pipeline stage, and schedules the next round. You just work — GHL communicates.",
  },
];

const TESTIMONIALS = [
  {
    quote: "I was managing 40 clients in a Google Sheet. ClientDeck Pro cut my admin time in half in the first week. The client portal alone is worth it — they stop texting me asking for updates.",
    name: "Credit repair business owner",
  },
  {
    quote: "The AI letters are better than anything I was writing manually. And when GHL sends the deletion win text automatically — clients love it. I look way more professional now.",
    name: "Agency owner",
  },
  {
    quote: "Finally, a credit repair tool that actually works WITH GoHighLevel instead of fighting it.",
    name: "Dispute specialist",
  },
];

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-blue-600">
      {children}
    </p>
  );
}

function KanbanMockup() {
  const columns = [
    {
      label: "Preparing",
      cards: [{ initials: "MJ", name: "Marcus J.", meta: "Round 1 · 8 items" }],
    },
    {
      label: "Letters Ready",
      cards: [{ initials: "ST", name: "Sarah T.", meta: "Round 1 · 15 items" }],
    },
    {
      label: "Sent",
      cards: [{ initials: "JW", name: "James W.", meta: "Round 2 · 5 items" }],
    },
    {
      label: "Awaiting",
      cards: [{ initials: "DC", name: "David C.", meta: "Round 3 · 22 days" }],
    },
  ];

  return (
    <div className="relative">
      <div className="rounded-xl border border-gray-700 bg-gray-900 text-left shadow-2xl">
        <div className="flex items-center justify-between gap-1.5 border-b border-gray-800 px-4 py-3">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-gray-700" />
            <span className="h-2.5 w-2.5 rounded-full bg-gray-700" />
            <span className="h-2.5 w-2.5 rounded-full bg-gray-700" />
          </div>
          <span className="rounded bg-green-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-green-400">
            Live
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 sm:p-6">
          {columns.map((col) => (
            <div key={col.label} className="space-y-2">
              <div className="rounded bg-gray-800 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                {col.label}
              </div>
              {col.cards.map((card) => (
                <div
                  key={card.name}
                  className="space-y-1.5 rounded-lg border border-gray-800 bg-gray-800/60 p-2.5"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600/20 text-[10px] font-semibold text-blue-400">
                    {card.initials}
                  </div>
                  <p className="text-xs font-medium text-gray-200">{card.name}</p>
                  <p className="text-[10px] text-gray-500">{card.meta}</p>
                </div>
              ))}
              <div className="h-10 rounded-lg border border-dashed border-gray-800/80" />
            </div>
          ))}
        </div>
      </div>

      <div className="float-card pulse-ring absolute -bottom-6 -right-4 hidden max-w-[240px] rounded-lg border border-gray-700 bg-gray-900 p-3.5 shadow-xl sm:-right-8 sm:block">
        <div className="flex items-start gap-2">
          <Bell className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
          <div>
            <p className="text-xs font-semibold text-white">🎉 Deletion Win!</p>
            <p className="mt-0.5 text-[11px] text-gray-400">
              Marcus J. — Capital One deleted
            </p>
            <p className="mt-1 text-[11px] font-medium text-green-400">
              GHL notified automatically ✓
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function LetterMockup() {
  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900 p-5 shadow-xl">
      <div className="mb-4 flex items-center gap-2 text-gray-500">
        <FileText className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide">
          Round 2 · Experian · 611 Letter
        </span>
      </div>
      <div className="space-y-2">
        <div className="h-2.5 w-3/4 rounded bg-gray-700" />
        <div className="h-2.5 w-full rounded bg-gray-700" />
        <div className="h-2.5 w-5/6 rounded bg-gray-700" />
      </div>
      <div className="my-4 rounded-md border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-[11px] text-blue-300">
        Cites FCRA § 611 — reinvestigation of disputed information
      </div>
      <div className="space-y-2">
        <div className="h-2.5 w-full rounded bg-gray-700" />
        <div className="h-2.5 w-2/3 rounded bg-gray-700" />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <span className="rounded-md border border-gray-700 px-3 py-1.5 text-[11px] font-medium text-gray-300">
          Edit
        </span>
        <span className="rounded-md bg-blue-600 px-3 py-1.5 text-[11px] font-medium text-white">
          Finalize &amp; Export
        </span>
      </div>
    </div>
  );
}

function PortalMockup() {
  const bars = [58, 64, 63, 71, 78, 82];
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-lg">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Your Progress
        </span>
        <TrendingUp className="h-4 w-4 text-green-600" />
      </div>
      <div className="flex items-end gap-2">
        {bars.map((h, i) => (
          <div
            key={i}
            className="w-full rounded-t bg-blue-600/80"
            style={{ height: `${h}px` }}
          />
        ))}
      </div>
      <p className="mt-2 text-center text-[11px] text-gray-400">
        Experian score, last 6 rounds
      </p>
      <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
        {["Round 1 sent", "3 items deleted", "Round 2 in progress"].map((step, i) => (
          <div key={step} className="flex items-center gap-2 text-xs text-gray-600">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                i < 2 ? "bg-green-500" : "bg-blue-500"
              )}
            />
            {step}
          </div>
        ))}
      </div>
    </div>
  );
}

function GhlFieldsMockup() {
  const fields = [
    ["dispute_round_current", "2"],
    ["items_deleted_total", "5"],
    ["credit_score_eq_current", "612"],
    ["clientdeck_portal_link", "clientdeck.io/p/9f2a"],
  ];
  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900 p-5 shadow-xl">
      <div className="mb-4 flex items-center gap-2">
        <Workflow className="h-4 w-4 text-blue-400" />
        <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
          GHL Contact · Marcus J.
        </span>
        <span className="ml-auto rounded-full bg-blue-600/20 px-2 py-0.5 text-[10px] font-medium text-blue-400">
          Round 2 Sent
        </span>
      </div>
      <div className="space-y-2">
        {fields.map(([k, v]) => (
          <div
            key={k}
            className="flex items-center justify-between rounded-md bg-gray-800/60 px-2.5 py-2"
          >
            <span className="text-[11px] text-gray-500">{k}</span>
            <span className="text-[11px] font-medium text-gray-200">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function LandingPage() {
  const session = await getSessionContext();
  const primaryCta = session
    ? { href: "/dashboard", label: "Go to Dashboard" }
    : { href: "/signup", label: "Start Free Trial" };

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
    name: "ClientDeck Pro",
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
    url: "https://clientdeckpro.com",
  };

  return (
    <>
      {/* Hero */}
      <section id="hero" className="relative overflow-hidden bg-gray-950 text-white">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(circle, #ffffff12 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="pointer-events-none absolute left-1/2 -top-20 h-96 w-96 -translate-x-1/2 rounded-full bg-blue-600/20 blur-3xl" />
        <div className="relative mx-auto max-w-4xl px-4 pb-28 pt-10 text-center sm:pt-14">
          <span className="inline-flex items-center gap-2 rounded-full border border-gray-700 bg-gray-900/80 px-4 py-1.5 text-xs font-medium text-gray-300">
            🚀 Now with AI dispute letter generation — try it free for 14 days
          </span>

          <h1 className="mt-8 text-4xl font-bold tracking-tight sm:text-5xl">
            Your Credit Repair Business
            <br />
            Deserves Better Than Spreadsheets.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-400">
            ClientDeck Pro runs your entire credit repair operation inside GoHighLevel —
            AI-generated dispute letters, automatic client updates, and a beautiful portal
            your clients will actually check. No spreadsheets. No copy-paste. No chaos.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={primaryCta.href}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-blue-700"
            >
              {session ? primaryCta.label : "Start Free Trial — 14 Days"}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="#how-it-works"
              className="rounded-md border border-gray-700 px-6 py-3 text-sm font-semibold text-gray-200 transition-colors duration-150 hover:bg-gray-900"
            >
              See How It Works ↓
            </Link>
          </div>

          <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-gray-400">
            {TRUST_BADGES.map((badge) => (
              <li key={badge} className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-blue-500" />
                {badge}
              </li>
            ))}
          </ul>

          <div className="mx-auto mt-16 max-w-4xl">
            <KanbanMockup />
          </div>
        </div>
      </section>

      {/* Pain points */}
      <section className="bg-white">
        <div className="mx-auto max-w-5xl px-4 py-20">
          <Reveal>
            <h2 className="text-center text-2xl font-semibold text-gray-900 sm:text-3xl">
              Sound familiar?
            </h2>
          </Reveal>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {PAIN_POINTS.map((p, i) => (
              <Reveal key={p.title} delay={i * 80}>
                <div className="h-full rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                  <span className="text-2xl">{p.emoji}</span>
                  <h3 className="mt-3 font-semibold text-gray-900">{p.title}</h3>
                  <p className="mt-2 text-sm text-gray-600">{p.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <p className="mt-10 text-center text-sm font-medium text-blue-600">
            There&apos;s a better way. →
          </p>
        </div>
      </section>

      {/* Solution */}
      <section id="features" className="scroll-mt-20 bg-gray-950 text-white">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <Reveal>
            <h2 className="text-center text-2xl font-semibold sm:text-3xl">
              One Platform. Everything Handled.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-gray-400">
              ClientDeck Pro lives inside your GoHighLevel. When you work in ClientDeck,
              GHL updates automatically. Your clients get notified. Your team stays organized.
            </p>
          </Reveal>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {SOLUTION_FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 80}>
                <div className="h-full rounded-lg border border-gray-800 bg-gray-900 p-6">
                  <f.icon className="h-8 w-8 text-blue-400" />
                  <h3 className="mt-4 font-semibold text-white">{f.title}</h3>
                  <p className="mt-2 text-sm text-gray-400">{f.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-20 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <Reveal>
            <h2 className="text-center text-2xl font-semibold text-gray-900 sm:text-3xl">
              Up and Running in 15 Minutes
            </h2>
          </Reveal>
          <div className="mt-14 grid grid-cols-1 gap-10 md:grid-cols-4 md:gap-6">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 80}>
                <div className="relative">
                  <span className="text-4xl font-bold text-blue-100">{s.n}</span>
                  <h3 className="mt-2 font-semibold text-gray-900">{s.title}</h3>
                  <p className="mt-2 text-sm text-gray-600">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Feature deep dive 1 — AI letters */}
      <section className="bg-gray-950 text-white">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 py-20 md:grid-cols-2 md:gap-16">
          <Reveal>
            <Kicker>AI Letter Generation</Kicker>
            <h2 className="text-2xl font-semibold sm:text-3xl">
              Stop Writing Dispute Letters By Hand
            </h2>
            <p className="mt-4 text-gray-400">
              Our AI knows the difference between a Round 1 initial dispute, a Round 2
              Method of Verification request, and a Round 3 escalation. It writes the
              right letter for every situation — citing the exact FCRA sections that
              work for that account type.
            </p>
            <ul className="mt-5 space-y-2.5">
              {[
                "609, 611, and 623 letters",
                "Collections, charge-offs, late payments, inquiries",
                "Goodwill letters to original creditors",
                "Identity theft affidavits",
                "You review before anything is sent — always",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-gray-300">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={120}>
            <LetterMockup />
          </Reveal>
        </div>
      </section>

      {/* Feature deep dive 2 — Portal */}
      <section className="bg-gray-50">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 py-20 md:grid-cols-2 md:gap-16">
          <Reveal delay={120} className="order-2 md:order-1">
            <PortalMockup />
          </Reveal>
          <Reveal className="order-1 md:order-2">
            <Kicker>Client Portal</Kicker>
            <h2 className="text-2xl font-semibold text-gray-900 sm:text-3xl">
              Give Clients a Portal They&apos;ll Actually Use
            </h2>
            <p className="mt-4 text-gray-600">
              Clients get a magic link via text — one tap, they&apos;re in their portal.
              No app download. No password. They see their score going up, their deleted
              accounts, and exactly what&apos;s happening with their case.
            </p>
            <ul className="mt-5 space-y-2.5">
              {[
                "Credit score tracker (all 3 bureaus)",
                "Round-by-round progress timeline",
                "Document upload (ID, reports, anything)",
                "Looks like your brand, not ours",
                "Auto-updates when you log results — zero extra work",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-gray-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* Feature deep dive 3 — GHL */}
      <section className="bg-gray-950 text-white">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 py-20 md:grid-cols-2 md:gap-16">
          <Reveal>
            <Kicker>GoHighLevel Integration</Kicker>
            <h2 className="text-2xl font-semibold sm:text-3xl">
              The Only Dispute Software Built for GHL
            </h2>
            <p className="mt-4 text-gray-400">
              Every other dispute tool is an island. You work in one app, then copy-paste
              into GHL, then manually text the client. With ClientDeck Pro, one action
              in the app triggers everything in GHL automatically.
            </p>
            <ul className="mt-5 space-y-2.5">
              {[
                "Pipeline stages move automatically",
                "Custom fields update with scores and deletions",
                "Your GHL workflows fire (SMS, email, tasks)",
                "No Zapier. No webhooks to maintain. No extra fees.",
                "Uses your existing GHL — doesn't replace it",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-gray-300">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={120}>
            <GhlFieldsMockup />
          </Reveal>
        </div>
      </section>

      {/* Social proof */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <Reveal>
            <h2 className="text-center text-2xl font-semibold text-gray-900 sm:text-3xl">
              Credit Repair Professionals Love ClientDeck Pro
            </h2>
          </Reveal>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} delay={i * 80}>
                <div className="flex h-full flex-col rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                  <div className="flex gap-0.5 text-amber-400">
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <Star key={idx} className="h-4 w-4 fill-current" />
                    ))}
                  </div>
                  <p className="mt-3 flex-1 text-sm text-gray-700">&ldquo;{t.quote}&rdquo;</p>
                  <p className="mt-4 text-xs font-medium text-gray-500">— {t.name}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-gray-400">
            Example quotes shown while we collect our first agency reviews — replace with
            real testimonials as they come in.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 border-t border-gray-100 pt-8 text-sm text-gray-500">
            <span>Built for GHL agencies</span>
            <span className="text-gray-300">·</span>
            <span>AI-powered letters</span>
            <span className="text-gray-300">·</span>
            <span>Auto client updates</span>
            <span className="text-gray-300">·</span>
            <span>14-day free trial</span>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-20 bg-gray-950 text-white">
        <div className="mx-auto max-w-5xl px-4 py-20">
          <Reveal>
            <h2 className="text-center text-2xl font-semibold sm:text-3xl">
              Simple Pricing. No Surprises.
            </h2>
            <p className="mt-2 text-center text-sm text-gray-400">
              14-day free trial on all plans. No credit card required to start.
            </p>
          </Reveal>
          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
            {PLANS.map((plan, i) => (
              <Reveal key={plan.id} delay={i * 80}>
                <div
                  className={cn(
                    "relative flex h-full flex-col rounded-lg border bg-gray-900 transition-transform duration-150",
                    plan.highlight ? "border-blue-500 md:scale-[1.03]" : "border-gray-800"
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
                      plan.highlight && "bg-gradient-to-r from-blue-600 to-blue-700"
                    )}
                  >
                    <h3 className="font-semibold text-white">{plan.name}</h3>
                    <p className="mt-2 text-3xl font-bold text-white">
                      {plan.priceLabel}
                      <span className="text-sm font-normal text-gray-400">/mo</span>
                    </p>
                    <p className="mt-1 text-sm text-gray-400">{plan.clientsLabel}</p>
                  </div>
                  <div className="flex flex-1 flex-col px-6 pb-6">
                    <ul className="mt-4 flex-1 space-y-2">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
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
                          : "border border-gray-700 text-gray-200 hover:bg-gray-800"
                      )}
                    >
                      Start Free Trial
                    </Link>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <p className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-center text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> 14-day free trial</span>
            <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> Cancel anytime</span>
            <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> Setup support included</span>
            <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> All future updates</span>
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 bg-gray-50">
        <div className="mx-auto max-w-3xl px-4 py-20">
          <Reveal>
            <h2 className="mb-10 text-center text-2xl font-semibold text-gray-900 sm:text-3xl">
              Common Questions
            </h2>
          </Reveal>
          <FaqAccordion />
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-gray-950 text-white">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <Reveal>
            <h2 className="text-2xl font-bold sm:text-3xl">
              Ready to Stop Running Your Credit Repair Business on Spreadsheets?
            </h2>
            <p className="mt-3 text-gray-400">
              Join credit repair professionals who&apos;ve automated their disputes,
              client communication, and GHL workflow — all from one platform.
            </p>
            <Link
              href={primaryCta.href}
              className="mt-8 inline-flex items-center gap-2 rounded-md bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              {session ? primaryCta.label : "Start Your Free 14-Day Trial"}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <p className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> No credit card required</span>
              <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Setup support included</span>
              <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> Cancel anytime</span>
              <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> Your GHL data stays yours</span>
            </p>
          </Reveal>
        </div>
      </section>

      {/* SEO text block — small, for search engines */}
      <section className="bg-white">
        <div className="mx-auto max-w-4xl space-y-6 px-4 py-16 text-xs leading-relaxed text-gray-400">
          <div>
            <h2 className="font-semibold text-gray-500">What is ClientDeck Pro?</h2>
            <p className="mt-1">
              ClientDeck Pro is dispute management software for credit repair agencies
              built natively for GoHighLevel (GHL). It provides AI-powered dispute
              letter generation, an automated client portal, round tracking, and full
              GHL integration including pipeline sync, custom field updates, and
              workflow automation.
            </p>
          </div>
          <div>
            <h2 className="font-semibold text-gray-500">Who uses ClientDeck Pro?</h2>
            <p className="mt-1">
              Credit repair business owners, dispute specialists, and credit repair
              agencies who use GoHighLevel as their CRM. Supports solo operators and
              teams up to unlimited members depending on plan.
            </p>
          </div>
          <div>
            <h2 className="font-semibold text-gray-500">
              How does ClientDeck Pro compare to CDM, DisputeFox, and DisputeBee?
            </h2>
            <p className="mt-1">
              ClientDeck Pro is the only dispute management software with native
              GoHighLevel integration. Unlike CDM, DisputeFox, and DisputeBee, which
              operate as standalone platforms requiring manual data transfer,
              ClientDeck Pro syncs automatically with GHL contacts, pipelines, and
              workflows.
            </p>
          </div>
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
