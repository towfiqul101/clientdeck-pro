import { SnapshotRequestForm } from "./snapshot-request-form";
import { GitBranch, Workflow, ListChecks, Mail, MessageSquare, FileInput } from "lucide-react";

const INCLUDED = [
  { icon: GitBranch, label: "2 pipelines", detail: "Dispute lifecycle + onboarding" },
  { icon: Workflow, label: "8 workflows", detail: "Win SMS, round reminders, portal delivery" },
  { icon: ListChecks, label: "15+ custom fields", detail: "Scores, round state, portal link" },
  { icon: Mail, label: "12 email templates", detail: "Client updates & milestones" },
  { icon: MessageSquare, label: "15 SMS templates", detail: "Wins, reminders, check-ins" },
  { icon: FileInput, label: "Intake form", detail: "Auto-creates the client in ClientDeck Pro" },
];

export default function SnapshotPage() {
  return (
    <>
      <section className="bg-gray-950 text-white">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <h1 className="text-3xl font-bold sm:text-4xl">
            The GoHighLevel Snapshot for Credit Professionals
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-slate-600">
            Import a complete, ready-to-run credit-repair operating system into
            your GHL location — pre-wired to sync with ClientDeck Pro.
          </p>
        </div>
      </section>

      <section className="bg-[#13131f]">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <h2 className="text-center text-2xl font-semibold text-slate-100">What&apos;s included</h2>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {INCLUDED.map((item) => (
              <div key={item.label} className="rounded-lg border border-white/10 bg-[#13131f] p-5 shadow-sm">
                <item.icon className="h-6 w-6 text-blue-400" />
                <p className="mt-3 font-semibold text-slate-100">{item.label}</p>
                <p className="text-sm text-slate-400">{item.detail}</p>
              </div>
            ))}
          </div>

          {/* Pipeline mockup (SVG placeholder) */}
          <div className="mt-12 overflow-x-auto rounded-lg border border-white/10 bg-[#13131f] p-6">
            <div className="flex min-w-[640px] gap-3">
              {["New Lead", "Analysis", "Round 1 Sent", "Awaiting", "Deletion Won", "Completed"].map(
                (stage, i) => (
                  <div key={stage} className="flex-1">
                    <div className="rounded-t-md bg-blue-600 px-3 py-2 text-center text-xs font-medium text-white">
                      {stage}
                    </div>
                    <div className="space-y-2 rounded-b-md bg-[#13131f] p-2 shadow-sm">
                      {Array.from({ length: 3 - (i % 3) }).map((_, j) => (
                        <div key={j} className="h-8 rounded border border-white/[0.06] bg-[#13131f]" />
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#13131f]">
        <div className="mx-auto max-w-lg px-4 py-16">
          <h2 className="mb-2 text-center text-2xl font-semibold text-slate-100">Request the Snapshot</h2>
          <p className="mb-8 text-center text-sm text-slate-500">
            Sign up for ClientDeck Pro and we&apos;ll send your personal import link.
          </p>
          <SnapshotRequestForm />
        </div>
      </section>
    </>
  );
}
