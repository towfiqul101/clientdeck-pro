"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { saveGhlFieldKeys, proposeGhlFieldMappings } from "../actions";
import { Wand2, Check, X, ShieldCheck } from "lucide-react";
import type { GhlFieldKeys } from "@/types";
import type { FieldProposal } from "@/lib/ghl/field-detect";

/**
 * Only the 3 bureau scores are mappable. Identity fields (SSN, DOB, signature,
 * ID/address/credit-report uploads) are RTP-owned fixed `cdp__` keys and are
 * deliberately NOT listed here — see CDP_IDENTITY_FIELDS.
 */
const FIELDS: { key: keyof GhlFieldKeys; label: string }[] = [
  { key: "score_eq", label: "Equifax Score" },
  { key: "score_exp", label: "Experian Score" },
  { key: "score_tu", label: "TransUnion Score" },
];

interface Props {
  initial: GhlFieldKeys;
  /** GHL fieldKey/id → human-readable field name, so a key isn't opaque. */
  namesByKey: Record<string, string>;
}

export function GhlFieldMapping({ initial, namesByKey }: Props) {
  const { toast } = useToast();
  const [keys, setKeys] = useState<GhlFieldKeys>(initial ?? {});
  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [proposals, setProposals] = useState<FieldProposal[] | null>(null);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});

  function set(key: keyof GhlFieldKeys, value: string) {
    setKeys((k) => ({ ...k, [key]: value }));
  }

  function nameFor(key: string | undefined): string | null {
    if (!key) return null;
    return namesByKey[key.replace(/^contact\./, "")] ?? namesByKey[key] ?? null;
  }

  async function save() {
    setSaving(true);
    // Persist only the 3 score keys — never re-save legacy identity keys.
    const scoresOnly: GhlFieldKeys = {
      score_eq: keys.score_eq,
      score_exp: keys.score_exp,
      score_tu: keys.score_tu,
    };
    const res = await saveGhlFieldKeys(scoresOnly);
    setSaving(false);
    if (res.success) toast("Field mapping saved.", "success");
    else toast(res.error ?? "Could not save.", "error");
  }

  async function runDetect() {
    setDetecting(true);
    const res = await proposeGhlFieldMappings();
    setDetecting(false);
    if (!res.ok) {
      toast(res.message, "error");
      return;
    }
    setProposals(res.proposals ?? []);
    // Nothing is pre-approved — the user must tick each one.
    setAccepted({});
    toast(res.message, (res.proposals?.length ?? 0) > 0 ? "success" : "error");
  }

  function applyAccepted() {
    const chosen = (proposals ?? []).filter((p) => accepted[p.key]);
    if (chosen.length === 0) {
      toast("Approve at least one suggestion first.", "error");
      return;
    }
    setKeys((k) => {
      const next = { ...k };
      for (const p of chosen) next[p.key] = p.ghlKey;
      return next;
    });
    setProposals(null);
    toast(`Applied ${chosen.length} mapping${chosen.length === 1 ? "" : ""}. Review, then Save.`, "success");
  }

  return (
    <Card>
      <div className="space-y-4 p-6">
        <div>
          <h3 className="text-base font-semibold text-slate-100">
            GHL Field Mapping — Bureau Scores
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Map the GHL fields your intake form writes starting bureau scores into.
            Find keys in GHL → Settings → Custom Fields → click a field → copy
            &quot;Key&quot;.
          </p>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-400">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          <span>
            SSN, date of birth, signature, and document uploads are no longer
            mapped here — RoundTrack Pro now reads them from its own{" "}
            <code className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-xs">
              cdp__
            </code>{" "}
            fields, so they can&apos;t be accidentally pointed at another
            product&apos;s field in a shared GHL location.
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {FIELDS.map((f) => {
            const resolved = nameFor(keys[f.key]);
            return (
              <label
                key={f.key}
                className="flex flex-col gap-1 text-xs font-medium text-slate-400"
              >
                {f.label}
                <input
                  value={keys[f.key] ?? ""}
                  onChange={(e) => set(f.key, e.target.value)}
                  placeholder="field key…"
                  className="rounded-md border border-white/10 px-3 py-2 font-mono text-sm text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {/* Show the human name — an opaque key is exactly how a
                    password field went unnoticed as a "score" mapping. */}
                {keys[f.key] ? (
                  resolved ? (
                    <span className="text-[11px] font-normal text-slate-500">
                      → <span className="text-slate-300">{resolved}</span>
                    </span>
                  ) : (
                    <span className="text-[11px] font-normal text-amber-400">
                      → no field with this key exists in your GHL location
                    </span>
                  )
                ) : null}
              </label>
            );
          })}
        </div>

        {proposals !== null && (
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/[0.06] p-4">
            <h4 className="text-sm font-semibold text-slate-100">
              Suggested mappings — approve each one
            </h4>
            <p className="mt-1 text-xs text-slate-400">
              Nothing is saved until you approve it. Credential fields (passwords,
              logins, PINs), dependent/spouse fields, and non-numeric fields are
              never suggested.
            </p>

            {proposals.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                No field passed the safety checks. Enter the keys manually above.
              </p>
            ) : (
              <>
                <ul className="mt-3 space-y-2">
                  {proposals.map((p) => (
                    <li
                      key={p.key}
                      className="flex flex-wrap items-center gap-3 rounded-md border border-white/10 bg-white/[0.03] p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-200">{p.label}</p>
                        <p className="truncate font-mono text-xs text-slate-500">
                          {p.ghlKey}
                        </p>
                        <p className="text-xs text-slate-400">
                          → <span className="text-slate-200">{p.ghlName}</span>{" "}
                          <span className="text-slate-500">[{p.dataType}]</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setAccepted((a) => ({ ...a, [p.key]: !a[p.key] }))
                        }
                        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium ${
                          accepted[p.key]
                            ? "bg-emerald-500/15 text-emerald-400"
                            : "bg-white/[0.06] text-slate-400 hover:bg-white/10"
                        }`}
                      >
                        {accepted[p.key] ? (
                          <>
                            <Check className="h-3.5 w-3.5" /> Approved
                          </>
                        ) : (
                          <>
                            <X className="h-3.5 w-3.5" /> Approve
                          </>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setProposals(null)}
                  >
                    Discard
                  </Button>
                  <Button type="button" onClick={applyAccepted}>
                    Apply approved
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={runDetect} loading={detecting}>
            <Wand2 className="h-4 w-4" />
            Suggest Fields
          </Button>
          <Button type="button" onClick={save} loading={saving}>
            Save Field Mapping
          </Button>
        </div>
      </div>
    </Card>
  );
}
