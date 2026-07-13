import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { RTP_IDENTITY_FIELDS } from "@/lib/ghl/setup-config";

interface Props {
  present: string[];
  missing: string[];
  available: boolean;
}

/**
 * Explains the one part of the identity-field migration that CANNOT be
 * automated: creating the fields in the agency's GHL location doesn't populate
 * them. The agency has to point their own onboarding form / workflow at the new
 * `rtp__` fields, inside their own GHL account.
 */
export function IdentityFieldsNotice({ present, missing, available }: Props) {
  if (!available) return null;

  const anyPresent = present.length > 0;

  return (
    <Card>
      <div className="space-y-4 p-6">
        <div className="flex items-start gap-3">
          {anyPresent ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
          ) : (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          )}
          <div>
            <h3 className="text-base font-semibold text-slate-100">
              Identity fields — action needed in your GHL account
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              RoundTrack Pro now reads SSN, date of birth, signature, and document
              uploads from its own fixed fields instead of mapping them onto
              whichever field happened to match by name. That change removes a real
              risk in GHL locations shared with other products — but it means{" "}
              <strong className="text-slate-200">
                your GHL onboarding form and workflow must be updated to write into
                these fields
              </strong>
              . We can create the fields for you; we can&apos;t fill them in — only
              your own GHL form can do that.
            </p>
          </div>
        </div>

        {missing.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
            {missing.length} of {RTP_IDENTITY_FIELDS.length} fields don&apos;t exist
            in your GHL location yet. Run{" "}
            <strong>Create Custom Fields</strong> below to create them.
          </div>
        )}

        <div className="overflow-x-auto rounded-md border border-white/10">
          <table className="w-full table-fixed text-left text-sm">
            <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase text-slate-500">
              <tr>
                <th className="w-[38%] px-3 py-2 font-medium">Field in GHL</th>
                <th className="w-[42%] px-3 py-2 font-medium">Key your form must write to</th>
                <th className="w-[20%] px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {RTP_IDENTITY_FIELDS.map((f) => {
                const exists = present.includes(f.fieldKey);
                return (
                  <tr key={f.fieldKey}>
                    <td className="break-words px-3 py-2 text-slate-200">{f.name}</td>
                    <td className="break-words px-3 py-2 font-mono text-xs text-blue-400">
                      {f.fieldKey}
                    </td>
                    <td className="px-3 py-2">
                      {exists ? (
                        <span className="text-xs font-medium text-emerald-400">Created</span>
                      ) : (
                        <span className="text-xs font-medium text-slate-500">Not created</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-slate-500">
          In GHL: open your onboarding form → for each question above, set its
          mapped custom field to the matching{" "}
          <code className="rounded bg-white/[0.06] px-1 py-0.5 font-mono">rtp__</code>{" "}
          field. Until you do, new clients will onboard without SSN, DOB,
          signature, or documents.
        </p>
      </div>
    </Card>
  );
}
