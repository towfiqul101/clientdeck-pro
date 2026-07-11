"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils/helpers";
import { UploadCloud, Download, Check, X, Loader2 } from "lucide-react";
import { parseImportPreview, confirmImport } from "./actions";
import type { ValidatedClientRow } from "@/lib/clients/import-validation";
import type { ConfirmImportResult } from "./actions";

type Step = "upload" | "preview" | "done";

export function ImportWizard() {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [parsing, setParsing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [rows, setRows] = useState<ValidatedClientRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<ConfirmImportResult | null>(null);

  async function handleFile(file: File) {
    setParsing(true);
    setParseError(null);
    const fd = new FormData();
    fd.set("file", file);
    const res = await parseImportPreview(fd);
    setParsing(false);
    if (!res.success || !res.rows) {
      setParseError(res.error ?? "Could not parse file.");
      return;
    }
    setRows(res.rows);
    setStep("preview");
  }

  async function handleConfirm() {
    setConfirming(true);
    const res = await confirmImport(rows);
    setConfirming(false);
    if (!res.success) {
      toast(res.error ?? "Import failed.", "error");
      return;
    }
    setResult(res);
    setStep("done");
  }

  const validCount = rows.filter((r) => r.valid).length;
  const invalidCount = rows.length - validCount;

  if (step === "done" && result) {
    return (
      <div className="space-y-4">
        <p className="text-sm font-medium text-slate-100">{result.summary}</p>
        {result.details && result.details.length > 0 && (
          <ul className="space-y-1 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300">
            {result.details.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <Link href="/clients">
            <Button size="sm">Back to Clients</Button>
          </Link>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setStep("upload");
              setRows([]);
              setResult(null);
            }}
          >
            Import another file
          </Button>
        </div>
      </div>
    );
  }

  if (step === "preview") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1 text-emerald-400">
            <Check className="h-4 w-4" /> {validCount} valid
          </span>
          {invalidCount > 0 && (
            <span className="flex items-center gap-1 text-red-400">
              <X className="h-4 w-4" /> {invalidCount} will be skipped
            </span>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto rounded-lg border border-white/10">
          <table className="min-w-full divide-y divide-white/[0.06] text-sm">
            <thead className="sticky top-0 bg-white/[0.03] text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Row</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">SSN Last 4</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.rowNumber}
                  className={cn(
                    "border-b border-white/[0.05] last:border-0",
                    !r.valid && "bg-red-500/5"
                  )}
                >
                  <td className="px-3 py-2 text-slate-500">{r.rowNumber}</td>
                  <td className="px-3 py-2 text-slate-200">{r.name || "—"}</td>
                  <td className="px-3 py-2 text-slate-300">{r.email || "—"}</td>
                  <td className="px-3 py-2 text-slate-300">{r.phone || "—"}</td>
                  <td className="px-3 py-2 text-slate-300">{r.ssn_last4 || "—"}</td>
                  <td className="px-3 py-2">
                    {r.valid ? (
                      <span className="text-emerald-400">Ready</span>
                    ) : (
                      <span className="text-red-400">{r.errors.join(", ")}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleConfirm} loading={confirming} disabled={validCount === 0}>
            Import {validCount} client{validCount === 1 ? "" : "s"}
          </Button>
          <Button variant="secondary" onClick={() => setStep("upload")} disabled={confirming}>
            Choose a different file
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <a
        href="/templates/clients-import-template.csv"
        download
        className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-400 hover:text-violet-300"
      >
        <Download className="h-4 w-4" />
        Download CSV template
      </a>

      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={parsing}
        className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-white/10 bg-white/[0.03] px-6 py-10 text-center transition-colors hover:border-gray-400 disabled:opacity-60"
      >
        {parsing ? (
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        ) : (
          <UploadCloud className="h-6 w-6 text-slate-500" />
        )}
        <span className="text-sm font-medium text-slate-300">
          {parsing ? "Parsing…" : "Click to choose a CSV file"}
        </span>
        <span className="text-xs text-slate-500">
          Headers: name, email, phone, ssn_last4 (up to 5MB)
        </span>
      </button>

      {parseError && <p className="text-sm text-red-400">{parseError}</p>}
    </div>
  );
}
