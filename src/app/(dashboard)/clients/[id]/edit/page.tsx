import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/session";
import { getClientOr404 } from "@/lib/clients/queries";
import { ClientForm, type ClientFormInitial } from "../../client-form";
import { ArrowLeft } from "lucide-react";

const str = (v: string | number | null): string =>
  v === null || v === undefined ? "" : String(v);

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSessionContext();
  if (!session) redirect("/login");

  const { id } = await params;
  const client = await getClientOr404(id);

  const initial: ClientFormInitial = {
    first_name: client.first_name,
    last_name: client.last_name,
    email: str(client.email),
    phone: str(client.phone),
    dob: str(client.dob),
    ssn_last4: str(client.ssn_last4),
    address_line1: str(client.address_line1),
    address_line2: str(client.address_line2),
    city: str(client.city),
    state: str(client.state),
    zip: str(client.zip),
    score_eq_start: str(client.score_eq_start),
    score_exp_start: str(client.score_exp_start),
    score_tu_start: str(client.score_tu_start),
    score_goal: str(client.score_goal),
    credit_goal: str(client.credit_goal),
    monthly_fee: str(client.monthly_fee),
    referral_source: str(client.referral_source),
    notes: str(client.notes),
  };

  const ghlConfigured = Boolean(
    session.agency.ghl_api_key && session.agency.ghl_location_id
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href={`/clients/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to client
        </Link>
        <h2 className="mt-2 text-lg font-semibold text-slate-100">
          Edit {client.first_name} {client.last_name}
        </h2>
      </div>

      <ClientForm
        mode="edit"
        clientId={id}
        initial={initial}
        ghlConfigured={ghlConfigured}
      />
    </div>
  );
}
