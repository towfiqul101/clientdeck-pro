"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/utils/helpers";
import { CheckCircle2, Clock, ExternalLink, Send } from "lucide-react";
import type { SignatureStatus, SignatureType } from "@/types";

export function SignatureCard({
  clientId,
  status,
  signedAt,
  signatureType,
  version,
  driveFolderId,
}: {
  clientId: string;
  status: SignatureStatus;
  signedAt: string | null;
  signatureType: SignatureType | null;
  version: string;
  driveFolderId: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [sending, setSending] = useState(false);

  if (status === "not_required") {
    return (
      <Card>
        <CardHeader title="Service Agreement" />
        <div className="px-5 py-4 text-sm text-slate-500">Not required for this client.</div>
      </Card>
    );
  }

  async function sendRequest() {
    setSending(true);
    try {
      const res = await fetch("/api/ghl/send-signature-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      const json = await res.json();
      toast(json.message || json.error || "Done.", json.ok ? "success" : "error");
      if (json.ok) router.refresh();
    } catch {
      toast("Request failed.", "error");
    } finally {
      setSending(false);
    }
  }

  const signed = status === "signed";

  return (
    <Card>
      <CardHeader title="Service Agreement" />
      <div className="space-y-3 px-5 py-4 text-sm">
        <div className="flex items-center gap-2">
          {signed ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span className="font-medium text-emerald-400">Signed</span>
            </>
          ) : (
            <>
              <Clock className="h-4 w-4 text-amber-400" />
              <span className="font-medium text-amber-400">Pending signature</span>
            </>
          )}
        </div>

        {signed && (
          <dl className="space-y-1.5 text-slate-400">
            {signedAt && (
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Date</dt>
                <dd className="font-medium text-slate-100">{formatDate(signedAt)}</dd>
              </div>
            )}
            {signatureType && (
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Type</dt>
                <dd className="font-medium capitalize text-slate-100">{signatureType}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Version</dt>
              <dd className="font-medium text-slate-100">{version}</dd>
            </div>
          </dl>
        )}

        {signed && driveFolderId && (
          <a
            href={`https://drive.google.com/drive/folders/${driveFolderId}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-400 hover:text-blue-300"
          >
            View in Drive
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}

        {!signed && (
          <button
            onClick={sendRequest}
            disabled={sending}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-[10px] bg-gradient-to-br from-violet-500 to-violet-700 px-3 py-2 text-sm font-medium text-white shadow-[0_4px_15px_rgba(139,92,246,0.3)] hover:-translate-y-px disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {sending ? "Sending…" : "Send Signature Request via GHL"}
          </button>
        )}
      </div>
    </Card>
  );
}
