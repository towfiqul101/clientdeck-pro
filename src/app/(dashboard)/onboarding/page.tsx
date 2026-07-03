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

const SNAPSHOT_URL = "https://clientdeckpro.com/snapshot"; // Week 7: final URL

const CUSTOM_FIELDS = [
  "dispute_round_current",
  "items_deleted_total",
  "total_negative_items",
  "next_dispute_date",
  "credit_score_eq_current",
  "credit_score_exp_current",
  "credit_score_tu_current",
  "clientdeck_portal_link",
  "clientdeck_client_id",
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
        <h1 className="text-xl font-semibold text-gray-900">Setup Guide</h1>
        <p className="text-sm text-gray-500">
          {state.completedCount} of {state.total} steps complete. Follow these to
          get the full ClientDeck Pro + GoHighLevel experience.
        </p>
      </div>

      {/* Step 1: Connect GHL */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Plug className="h-4 w-4 text-blue-600" /> 1. Connect GoHighLevel
            </span>
          }
          action={
            ghlConnected ? (
              <span className="flex items-center gap-1 text-sm font-medium text-green-600">
                <CheckCircle2 className="h-4 w-4" /> Connected
              </span>
            ) : (
              <span className="flex items-center gap-1 text-sm text-gray-400">
                <Circle className="h-4 w-4" /> Not connected
              </span>
            )
          }
        />
        <div className="space-y-3 p-6 text-sm text-gray-600">
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
              <Package className="h-4 w-4 text-blue-600" /> 2. Install the GHL
              Snapshot
            </span>
          }
        />
        <div className="space-y-3 p-6 text-sm text-gray-600">
          <p>
            The snapshot installs the pipelines, workflows, and custom fields
            ClientDeck Pro syncs into. In GoHighLevel go to{" "}
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
              <ListChecks className="h-4 w-4 text-blue-600" /> 3. Verify Custom
              Fields
            </span>
          }
        />
        <div className="space-y-3 p-6 text-sm text-gray-600">
          <p>
            The snapshot auto-creates these {CUSTOM_FIELDS.length} custom fields.
            Confirm they exist under{" "}
            <strong>GHL → Settings → Custom Fields</strong>:
          </p>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {CUSTOM_FIELDS.map((f) => (
              <code
                key={f}
                className="rounded bg-gray-100 px-2 py-1 font-mono text-xs text-gray-700"
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
              <Rocket className="h-4 w-4 text-blue-600" /> 4. Test the Full Flow
            </span>
          }
        />
        <div className="space-y-2 p-6 text-sm">
          <Link
            href="/clients/new"
            className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 hover:bg-gray-50"
          >
            Add a test client <ArrowRight className="h-4 w-4 text-gray-400" />
          </Link>
          <Link
            href="/clients"
            className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 hover:bg-gray-50"
          >
            Generate a portal link & open the branded portal
            <ArrowRight className="h-4 w-4 text-gray-400" />
          </Link>
        </div>
      </Card>
    </div>
  );
}
