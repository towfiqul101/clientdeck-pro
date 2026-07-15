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
import {
  CREDIT_GOALS,
  US_STATES,
  CREDIT_SCORE_RANGES,
  RESULTS_TIMELINES,
  EMPLOYMENT_STATUSES,
} from "@/lib/constants";

function yesNo(value: boolean | null): string | null {
  return value === null ? null : value ? "Yes" : "No";
}

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
  const creditScoreRangeLabel = client.credit_score_range
    ? CREDIT_SCORE_RANGES.find((r) => r.value === client.credit_score_range)?.label
    : null;
  const resultsTimelineLabel = client.results_timeline
    ? RESULTS_TIMELINES.find((r) => r.value === client.results_timeline)?.label
    : null;
  const employmentStatusLabel = client.employment_status
    ? EMPLOYMENT_STATUSES.find((s) => s.value === client.employment_status)?.label
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
          <CardHeader title="Onboarding Details" />
          <div className="divide-y divide-white/[0.06] px-5 py-2">
            <Row label="Credit score range" value={creditScoreRangeLabel} />
            <Row
              label="Reviewed credit report recently"
              value={yesNo(client.reviewed_credit_report_recently)}
            />
            <Row
              label="Negative items reported"
              value={yesNo(client.negative_items_reported)}
            />
            <Row
              label="Enrolled in other program"
              value={yesNo(client.enrolled_other_program)}
            />
            <Row label="Primary goal" value={client.primary_goal} />
            <Row label="Results timeline" value={resultsTimelineLabel} />
            <Row label="Employment status" value={employmentStatusLabel} />
            <Row label="Bankruptcy filed" value={yesNo(client.bankruptcy_filed)} />
            {client.bankruptcy_filed && (
              <Row
                label="Bankruptcy date"
                value={client.bankruptcy_date ? formatDate(client.bankruptcy_date) : null}
              />
            )}
          </div>
          {client.intake_concerns && (
            <div className="border-t border-white/[0.06] px-5 py-4 text-sm">
              <p className="mb-1 text-slate-500">Concerns</p>
              <p className="whitespace-pre-line text-slate-200">
                {client.intake_concerns}
              </p>
            </div>
          )}
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
