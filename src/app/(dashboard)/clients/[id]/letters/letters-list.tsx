"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ScrollFadeX } from "@/components/ui/scroll-fade";
import {
  formatDate,
  getBureauLabel,
  getLetterTypeLabel,
} from "@/lib/utils/helpers";
import type { Bureau, DisputeResult, LetterType } from "@/types";
import { FileText, Eye, Download } from "lucide-react";

export interface LetterRow {
  id: string;
  bureau: Bureau;
  letter_type: LetterType;
  letter_content: string | null;
  letter_pdf_url: string | null;
  result: DisputeResult;
  created_at: string;
  round_number: number | null;
  creditor_name: string | null;
}

export function LettersList({ letters }: { letters: LetterRow[] }) {
  const [viewing, setViewing] = useState<LetterRow | null>(null);

  if (letters.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-[#1a1a2e] shadow-sm">
        <EmptyState
          icon={FileText}
          title="No letters yet"
          description="Letters are generated when you start a dispute round and create them for selected items."
        />
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-white/10 bg-[#1a1a2e] shadow-sm">
        <ScrollFadeX>
          <table className="min-w-full divide-y divide-white/[0.08] text-sm">
            <thead className="bg-white/[0.03] text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Round</th>
                <th className="px-4 py-3">Bureau</th>
                <th className="px-4 py-3">Creditor</th>
                <th className="px-4 py-3">Letter type</th>
                <th className="px-4 py-3">Result</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {letters.map((letter) => (
                <tr key={letter.id} className="hover:bg-white/[0.03]">
                  <td className="px-4 py-3 text-slate-300">
                    {letter.round_number ? `Round ${letter.round_number}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {getBureauLabel(letter.bureau)}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-100">
                    {letter.creditor_name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {getLetterTypeLabel(letter.letter_type)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge status={letter.result} />
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {formatDate(letter.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setViewing(letter)}
                        disabled={!letter.letter_content}
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-slate-400 hover:bg-white/[0.06] disabled:opacity-40"
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </button>
                      {letter.letter_pdf_url && (
                        <a
                          href={letter.letter_pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-blue-400 hover:bg-blue-500/10"
                        >
                          <Download className="h-4 w-4" />
                          PDF
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollFadeX>
      </div>

      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={
          viewing
            ? `${getLetterTypeLabel(viewing.letter_type)} — ${getBureauLabel(
                viewing.bureau
              )}`
            : ""
        }
        description={viewing?.creditor_name ?? undefined}
        size="lg"
        footer={
          <Button variant="secondary" onClick={() => setViewing(null)}>
            Close
          </Button>
        }
      >
        <pre className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap rounded-md bg-white/[0.03] p-4 font-sans text-sm text-slate-200">
          {viewing?.letter_content}
        </pre>
      </Modal>
    </>
  );
}
