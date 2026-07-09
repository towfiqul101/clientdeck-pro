"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { saveGhlFieldKeys, autoDetectGhlFields } from "../actions";
import { Wand2 } from "lucide-react";
import type { GhlFieldKeys } from "@/types";

const FIELDS: { key: keyof GhlFieldKeys; label: string }[] = [
  { key: "ssn_last4", label: "SSN Last 4" },
  { key: "dob", label: "Date of Birth" },
  { key: "score_eq", label: "Equifax Score" },
  { key: "score_exp", label: "Experian Score" },
  { key: "score_tu", label: "TransUnion Score" },
  { key: "signature_status", label: "Signature Status" },
  { key: "signed_at", label: "Signature Date" },
  { key: "credit_report_eq", label: "Credit Report (EQ)" },
  { key: "credit_report_exp", label: "Credit Report (EXP)" },
  { key: "credit_report_tu", label: "Credit Report (TU)" },
  { key: "id_document", label: "ID Document" },
  { key: "proof_of_address", label: "Proof of Address" },
];

export function GhlFieldMapping({ initial }: { initial: GhlFieldKeys }) {
  const { toast } = useToast();
  const [keys, setKeys] = useState<GhlFieldKeys>(initial ?? {});
  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);

  function set(key: keyof GhlFieldKeys, value: string) {
    setKeys((k) => ({ ...k, [key]: value }));
  }

  async function save() {
    setSaving(true);
    const res = await saveGhlFieldKeys(keys);
    setSaving(false);
    if (res.success) toast("Field mapping saved.", "success");
    else toast(res.error ?? "Could not save.", "error");
  }

  async function autoDetect() {
    setDetecting(true);
    const res = await autoDetectGhlFields();
    setDetecting(false);
    if (res.ok && res.keys) setKeys(res.keys);
    toast(res.message, res.ok ? "success" : "error");
  }

  return (
    <Card>
      <div className="space-y-4 p-6">
        <div>
          <h3 className="text-base font-semibold text-slate-100">GHL Field Mapping</h3>
          <p className="mt-1 text-sm text-slate-500">
            Map your GHL custom-field keys to ClientDeck Pro data. Find keys in GHL
            → Settings → Custom Fields → click a field → copy &quot;Key&quot;. Or
            click Auto-detect to match them by name.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <label key={f.key} className="flex flex-col gap-1 text-xs font-medium text-slate-400">
              {f.label}
              <input
                value={keys[f.key] ?? ""}
                onChange={(e) => set(f.key, e.target.value)}
                placeholder="field key…"
                className="rounded-md border border-white/10 px-3 py-2 font-mono text-sm text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </label>
          ))}
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={autoDetect} loading={detecting}>
            <Wand2 className="h-4 w-4" />
            Auto-detect Fields
          </Button>
          <Button type="button" onClick={save} loading={saving}>
            Save Field Mapping
          </Button>
        </div>
      </div>
    </Card>
  );
}
