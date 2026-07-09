"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils/helpers";
import { BUREAUS } from "@/lib/constants";
import { getNegativeTypeLabel, getBureauLabel, formatCurrency } from "@/lib/utils/helpers";
import { addItems, type NewItemInput } from "./actions";
import { uploadDocument } from "../documents/actions";
import type { Bureau } from "@/types";
import type { ParsedItem } from "@/lib/claude/parse-credit-report";
import { Bot, UploadCloud, Loader2, AlertTriangle, Check, FileText } from "lucide-react";

type Phase = "upload" | "analyzing" | "review";

const MAX_BYTES = 10 * 1024 * 1024;

function toDraft(item: ParsedItem, bureau: Bureau): NewItemInput {
  return {
    bureau,
    creditor_name: item.creditor_name,
    account_number_last4: item.account_number_last4 ?? "",
    account_type: item.account_type ?? "",
    negative_type: item.negative_type,
    balance: item.balance != null ? String(item.balance) : "",
    date_opened: item.date_opened ?? "",
    date_of_first_delinquency: item.date_of_first_delinquency ?? "",
  };
}

function validateFile(file: File): string | null {
  if (file.type !== "application/pdf") return "File must be a PDF.";
  if (file.size > MAX_BYTES) return "PDF exceeds 10MB.";
  return null;
}

interface CreditReportParserProps {
  clientId: string;
  open: boolean;
  onClose: () => void;
}

export function CreditReportParser({
  clientId,
  open,
  onClose,
}: CreditReportParserProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [phase, setPhase] = useState<Phase>("upload");
  const [bureau, setBureau] = useState<Bureau>("equifax");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setPhase("upload");
    setFile(null);
    setItems([]);
    setChecked(new Set());
    setDragOver(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleClose() {
    // Don't allow dismissing mid-flight — avoids orphaning a request/insert.
    if (phase === "analyzing" || saving) return;
    onClose();
    reset();
  }

  function pickFile(f: File | null | undefined) {
    if (!f) return;
    const error = validateFile(f);
    if (error) {
      toast(error, "error");
      return;
    }
    setFile(f);
  }

  async function analyze() {
    if (!file) {
      toast("Attach a PDF first.", "error");
      return;
    }
    setPhase("analyzing");
    try {
      const fd = new FormData();
      fd.set("bureau", bureau);
      fd.set("file", file);
      const res = await fetch("/api/ai/parse-credit-report", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!data.ok) {
        toast(data.error ?? "Analysis failed.", "error");
        setPhase("upload");
        return;
      }
      if (data.note) toast(data.note, "info");
      const parsed = (data.items ?? []) as ParsedItem[];
      setItems(parsed);
      setChecked(new Set(parsed.map((_, i) => i)));
      setPhase("review");
    } catch {
      toast("Analysis failed. Try again or add items manually.", "error");
      setPhase("upload");
    }
  }

  function toggleOne(idx: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function toggleAll() {
    setChecked((prev) =>
      prev.size === items.length ? new Set() : new Set(items.map((_, i) => i))
    );
  }

  async function confirm() {
    const drafts = items
      .filter((_, i) => checked.has(i))
      .map((it) => toDraft(it, bureau));
    if (drafts.length === 0) {
      toast("Select at least one item.", "error");
      return;
    }
    setSaving(true);
    const result = await addItems(clientId, drafts);
    if (!result.success) {
      setSaving(false);
      toast(result.error ?? "Could not add items.", "error");
      return;
    }

    // Best-effort: back up the original PDF as a credit_report document.
    // Never blocks or fails the confirm flow.
    if (file) {
      try {
        const fd = new FormData();
        fd.set("clientId", clientId);
        fd.set("category", "credit_report");
        fd.set("file", file);
        await uploadDocument(fd);
      } catch {
        // swallow — item insert already succeeded, this is a nice-to-have
      }
    }

    setSaving(false);
    toast(
      `${drafts.length} item${drafts.length === 1 ? "" : "s"} added from ${getBureauLabel(bureau)}.`,
      "success"
    );
    onClose();
    reset();
    router.refresh();
  }

  const allChecked = items.length > 0 && checked.size === items.length;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="AI Credit Report Parser"
      description="Upload a bureau PDF and let AI extract the negative items for you."
      size="lg"
      footer={
        phase === "upload" ? (
          <>
            <Button variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={analyze} disabled={!file}>
              <Bot className="h-4 w-4" />
              Analyze
            </Button>
          </>
        ) : phase === "review" ? (
          <>
            <Button variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              loading={saving}
              disabled={checked.size === 0}
              onClick={confirm}
            >
              Add {checked.size} item{checked.size === 1 ? "" : "s"}
            </Button>
          </>
        ) : undefined
      }
    >
      {phase === "upload" && (
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-slate-300">
              Credit bureau
            </span>
            <Select
              value={bureau}
              onChange={(e) => setBureau(e.target.value as Bureau)}
              options={BUREAUS}
            />
          </label>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              pickFile(e.dataTransfer.files?.[0]);
            }}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors",
              dragOver
                ? "border-blue-500 bg-blue-500/10"
                : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
            {file ? (
              <>
                <FileText className="h-8 w-8 text-blue-400" />
                <p className="text-sm font-medium text-slate-100">{file.name}</p>
                <p className="text-xs text-slate-500">
                  {(file.size / (1024 * 1024)).toFixed(1)} MB — click to replace
                </p>
              </>
            ) : (
              <>
                <UploadCloud className="h-8 w-8 text-slate-500" />
                <p className="text-sm font-medium text-slate-300">
                  Click to upload or drag a PDF here
                </p>
                <p className="text-xs text-slate-500">PDF only, up to 10MB</p>
              </>
            )}
          </div>
        </div>
      )}

      {phase === "analyzing" && (
        <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
          <p className="text-sm font-medium text-slate-100">
            Analyzing the credit report…
          </p>
          <p className="text-xs text-slate-500">This takes 10–20 seconds.</p>
        </div>
      )}

      {phase === "review" && (
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <p>
              Review each item — AI may miss or misread items. Always verify
              against the original report.
            </p>
          </div>

          {items.length === 0 ? (
            <p className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-6 text-center text-sm text-slate-500">
              No negative items detected in this report.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">
                  {items.length} item{items.length === 1 ? "" : "s"} found ·{" "}
                  {getBureauLabel(bureau)}
                </p>
                <button
                  onClick={toggleAll}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-400 hover:text-blue-400"
                >
                  <Check className="h-3.5 w-3.5" />
                  {allChecked ? "Uncheck All" : "Check All"}
                </button>
              </div>

              <div className="max-h-96 divide-y divide-white/[0.06] overflow-y-auto rounded-lg border border-white/10">
                {items.map((item, idx) => (
                  <label
                    key={idx}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 px-4 py-3 text-sm hover:bg-white/[0.03]",
                      checked.has(idx) && "bg-blue-50/50"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked.has(idx)}
                      onChange={() => toggleOne(idx)}
                      className="mt-0.5 h-4 w-4 rounded border-white/10 text-blue-400 focus:ring-blue-500"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-100">
                        {item.creditor_name}
                        {item.account_number_last4 && (
                          <span className="ml-1.5 font-normal text-slate-500">
                            ••••{item.account_number_last4}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500">
                        {getNegativeTypeLabel(item.negative_type)}
                        {item.date_of_first_delinquency &&
                          ` · DOFD ${item.date_of_first_delinquency}`}
                      </p>
                    </div>
                    <p className="shrink-0 font-medium text-slate-300">
                      {item.balance != null ? formatCurrency(item.balance) : "—"}
                    </p>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
