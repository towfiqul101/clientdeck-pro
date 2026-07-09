"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { LineChart } from "lucide-react";
import type { Client } from "@/types";

interface PullScoresButtonProps {
  client: Pick<Client, "id" | "first_name" | "last_name" | "ssn_last4" | "dob" | "address_line1" | "city" | "state" | "zip">;
}

export function PullScoresButton({ client }: PullScoresButtonProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [result, setResult] = useState<{ score_eq: number | null; score_exp: number | null; score_tu: number | null } | null>(null);

  const missing: string[] = [];
  if (!client.ssn_last4) missing.push("SSN last 4");
  if (!client.dob) missing.push("Date of birth");
  if (!client.address_line1 || !client.city || !client.state || !client.zip) missing.push("Address");

  async function handlePull() {
    setPulling(true);
    try {
      const res = await fetch("/api/credit-monitoring/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: client.id }),
      });
      const data = await res.json();
      if (data.ok) {
        setResult({ score_eq: data.score_eq, score_exp: data.score_exp, score_tu: data.score_tu });
        router.refresh();
      } else {
        toast(data.error ?? "Could not pull scores.", "error");
      }
    } catch {
      toast("Could not reach the credit monitoring service.", "error");
    } finally {
      setPulling(false);
    }
  }

  function handleClose() {
    setOpen(false);
    setResult(null);
  }

  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <LineChart className="h-4 w-4" /> Pull Scores
      </Button>
      <Modal open={open} onClose={handleClose} title="Pull Credit Scores" size="md">
        {result ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-green-400">✅ Scores Retrieved</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xs text-slate-500">Equifax</p>
                <p className="text-lg font-semibold text-slate-100">{result.score_eq ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Experian</p>
                <p className="text-lg font-semibold text-slate-100">{result.score_exp ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">TransUnion</p>
                <p className="text-lg font-semibold text-slate-100">{result.score_tu ?? "—"}</p>
              </div>
            </div>
            <p className="text-xs text-slate-500">Scores updated in client profile and score history.</p>
            <div className="flex justify-end">
              <Button onClick={handleClose}>Close</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              This will pull current 3-bureau scores for {client.first_name} {client.last_name}.
            </p>
            {missing.length > 0 ? (
              <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-400">
                Missing required fields: {missing.join(", ")}. Complete the client profile before pulling scores.
              </p>
            ) : (
              <p className="rounded-md border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-400">
                All required fields are present.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={handleClose}>Cancel</Button>
              <Button onClick={handlePull} loading={pulling} disabled={missing.length > 0}>
                Pull Scores Now →
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
