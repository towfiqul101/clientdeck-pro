"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { Upload, Loader2 } from "lucide-react";

export function DocumentsPanel() {
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function backfill() {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch("/api/google-drive/backfill", { method: "POST" });
      const json = await res.json();
      if (json.ok) {
        const msg = `Synced ${json.synced} of ${json.total} document(s)${
          json.failed ? `, ${json.failed} failed` : ""
        }.`;
        setResult(msg);
        toast(msg, json.failed ? "error" : "success");
      } else {
        setResult(json.error || "Backfill failed.");
        toast(json.error || "Backfill failed.", "error");
      }
    } catch {
      setResult("Request failed.");
      toast("Request failed.", "error");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card>
      <div className="space-y-3 p-6">
        <div className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-blue-600" />
          <h3 className="text-base font-semibold text-gray-900">
            Backfill Existing Documents
          </h3>
        </div>
        <p className="text-sm text-gray-500">
          Sync all existing client documents to Drive. This may take a few
          minutes for large libraries — you can run it again if it doesn&apos;t
          finish in one pass.
        </p>
        <button
          onClick={backfill}
          disabled={running}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {running ? "Syncing…" : "Start Backfill"}
        </button>
        {result && <p className="text-sm font-medium text-gray-700">{result}</p>}
      </div>
    </Card>
  );
}
