import { getClientOr404 } from "@/lib/clients/queries";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NotesEditor } from "./notes-editor";
import { SignatureCard } from "./signature-card";
import {
  formatCurrency,
  formatDate,
  formatPhone,
} from "@/lib/utils/helpers";
import { CREDIT_GOALS, US_STATES } from "@/lib/constants";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-100">
        {value || <span className="text-slate-600">—</span>}
      </span>
    </div>
  );
}

export default async function ClientOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await getClientOr404(id);

  const stateLabel =
    US_STATES.find((s) => s.value === client.state)?.label ?? client.state;
  const goalLabel = client.credit_goal
    ? CREDIT_GOALS.find((g) => g.value === client.credit_goal)?.label
    : null;

  const address = [
    client.address_line1,
    client.address_line2,
    [client.city, stateLabel, client.zip].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Left: details */}
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader title="Personal Information" />
          <div className="divide-y divide-white/[0.06] px-5 py-2">
            <Row
              label="Full name"
              value={`${client.first_name} ${client.last_name}`}
            />
            <Row label="Email" value={client.email} />
            <Row
              label="Phone"
              value={client.phone ? formatPhone(client.phone) : null}
            />
            <Row
              label="Date of birth"
              value={client.dob ? formatDate(client.dob) : null}
            />
            <Row
              label="SSN"
              value={client.ssn_last4 ? `•••-••-${client.ssn_last4}` : null}
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Address" />
          <div className="px-5 py-4 text-sm text-slate-200">
            {address ? (
              <p className="whitespace-pre-line">{address}</p>
            ) : (
              <span className="text-slate-600">No address on file</span>
            )}
          </div>
        </Card>

        <Card>
          <div className="px-5 py-5">
            <NotesEditor clientId={client.id} initialNotes={client.notes ?? ""} />
          </div>
        </Card>
      </div>

      {/* Right: goals + service */}
      <div className="space-y-6">
        <Card>
          <CardHeader title="Credit Goal" />
          <div className="divide-y divide-white/[0.06] px-5 py-2">
            <Row label="Goal" value={goalLabel} />
            <Row label="Target score" value={client.score_goal} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Service" />
          <div className="divide-y divide-white/[0.06] px-5 py-2">
            <Row
              label="Start date"
              value={formatDate(client.service_start_date)}
            />
            <Row
              label="Current round"
              value={
                client.current_round > 0
                  ? `Round ${client.current_round}`
                  : "Not started"
              }
            />
            <Row label="Monthly fee" value={formatCurrency(client.monthly_fee)} />
            <Row
              label="Payment"
              value={<Badge status={client.payment_status} />}
            />
            <Row label="Referral" value={client.referral_source} />
          </div>
        </Card>

        <SignatureCard
          clientId={client.id}
          status={client.signature_status}
          signedAt={client.signed_at}
          signatureType={client.signature_type}
          version={client.service_agreement_version}
          driveFolderId={client.ghl_drive_folder_id}
        />
      </div>
    </div>
  );
}
