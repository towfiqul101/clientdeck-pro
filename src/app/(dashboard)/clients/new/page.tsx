import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/session";
import { checkClientLimit } from "@/lib/utils/license";
import { ClientForm, type ClientFormInitial } from "../client-form";
import { ArrowLeft, AlertTriangle } from "lucide-react";

export default async function NewClientPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");

  const limit = await checkClientLimit(session.agency.id);
  // No UI ever writes settings.default_monthly_fee — it was dead config, so
  // this is just the plain default rather than a settings read that could
  // never actually resolve to anything else.
  const defaultFee = 149;

  const emptyInitial: ClientFormInitial = {
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    dob: "",
    ssn_last4: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    zip: "",
    score_eq_start: "",
    score_exp_start: "",
    score_tu_start: "",
    score_goal: "",
    credit_goal: "",
    monthly_fee: String(defaultFee),
    referral_source: "",
    notes: "",
  };

  const ghlConfigured = Boolean(
    session.agency.ghl_api_key && session.agency.ghl_location_id
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/clients"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to clients
        </Link>
        <h2 className="mt-2 text-lg font-semibold text-slate-100">New Client</h2>
        <p className="text-sm text-slate-500">
          Using {limit.current} of {limit.max} client slots on your plan.
        </p>
      </div>

      {!limit.allowed ? (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-5">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div>
            <h3 className="text-sm font-semibold text-amber-300">
              Client limit reached
            </h3>
            <p className="mt-1 text-sm text-amber-300">
              Your plan allows up to {limit.max} active clients. Upgrade your
              plan to add more.
            </p>
            <Link
              href="/settings/billing"
              className="mt-3 inline-flex items-center gap-2 rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
            >
              View plans
            </Link>
          </div>
        </div>
      ) : (
        <ClientForm
          mode="create"
          initial={emptyInitial}
          ghlConfigured={ghlConfigured}
        />
      )}
    </div>
  );
}
