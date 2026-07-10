import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionContext } from "@/lib/auth/session";
import { Card, CardHeader } from "@/components/ui/card";
import { computeOnboarding } from "@/lib/onboarding/steps";
import { SnapshotConfirm } from "./snapshot-confirm";
import {
  Plug,
  Package,
  ListChecks,
  Rocket,
  CheckCircle2,
  Circle,
  ArrowRight,
} from "lucide-react";

const SNAPSHOT_URL = "https://roundtrackpro.com/snapshot"; // Week 7: final URL

const CUSTOM_FIELDS = [
  "cdp__round_number",
  "cdp__items_deleted",
  "cdp__total_items",
  "cdp__next_dispute_date",
  "cdp__eq_score",
  "cdp__exp_score",
  "cdp__tu_score",
  "cdp__portal_link",
  "cdp__client_id",
];

export default async function OnboardingPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");

  const { agency } = session;
  const state = computeOnboarding(agency.settings);
  const ghlConnected = state.steps.ghl_connected;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Setup Guide</h1>
        <p className="text-sm text-slate-500">
          {state.completedCount} of {state.total} steps complete. Follow these to
          get the full RoundTrack Pro + GoHighLevel experience.
        </p>
      </div>

      {/* Step 1: Connect GHL */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Plug className="h-4 w-4 text-blue-400" /> 1. Connect GoHighLevel
            </span>
          }
          action={
            ghlConnected ? (
              <span className="flex items-center gap-1 text-sm font-medium text-green-400">
                <CheckCircle2 className="h-4 w-4" /> Connected
              </span>
            ) : (
              <span className="flex items-center gap-1 text-sm text-slate-500">
                <Circle className="h-4 w-4" /> Not connected
              </span>
            )
          }
        />
        <div className="space-y-3 p-6 text-sm text-slate-400">
          <p>
            In GoHighLevel, go to{" "}
            <strong>Settings → Private Integrations</strong> and create a key
            with contact, opportunity, and custom-field scopes. Copy the key and
            your Location ID.
          </p>
          <Link
            href="/settings/ghl"
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Open GHL Settings & Test Connection
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Card>

      {/* Step 2: Install snapshot */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Package className="h-4 w-4 text-blue-400" /> 2. Install the GHL
              Snapshot
            </span>
          }
        />
        <div className="space-y-3 p-6 text-sm text-slate-400">
          <p>
            The snapshot installs the pipelines, workflows, and custom fields
            RoundTrack Pro syncs into. In GoHighLevel go to{" "}
            <strong>Settings → Snapshots → Import → paste this URL</strong>:
          </p>
          <code className="block rounded-md bg-gray-900 px-3 py-2 font-mono text-xs text-gray-100">
            {SNAPSHOT_URL}
          </code>
          <SnapshotConfirm
            agencyId={agency.id}
            initial={state.steps.snapshot_installed}
          />
        </div>
      </Card>

      {/* Step 3: Verify custom fields */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-blue-400" /> 3. Verify Custom
              Fields
            </span>
          }
        />
        <div className="space-y-3 p-6 text-sm text-slate-400">
          <p>
            The snapshot auto-creates these {CUSTOM_FIELDS.length} custom fields.
            Confirm they exist under{" "}
            <strong>GHL → Settings → Custom Fields</strong>:
          </p>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {CUSTOM_FIELDS.map((f) => (
              <code
                key={f}
                className="rounded bg-white/[0.06] px-2 py-1 font-mono text-xs text-slate-300"
              >
                {f}
              </code>
            ))}
          </div>
        </div>
      </Card>

      {/* Step 4: Test the flow */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Rocket className="h-4 w-4 text-blue-400" /> 4. Test the Full Flow
            </span>
          }
        />
        <div className="space-y-2 p-6 text-sm">
          <Link
            href="/clients/new"
            className="flex items-center justify-between rounded-md border border-white/10 px-3 py-2 hover:bg-white/[0.03]"
          >
            Add a test client <ArrowRight className="h-4 w-4 text-slate-500" />
          </Link>
          <Link
            href="/clients"
            className="flex items-center justify-between rounded-md border border-white/10 px-3 py-2 hover:bg-white/[0.03]"
          >
            Generate a portal link & open the branded portal
            <ArrowRight className="h-4 w-4 text-slate-500" />
          </Link>
        </div>
      </Card>
    </div>
  );
}
