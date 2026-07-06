"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import type { LetterTemplate } from "@/types";

export function TemplateViewModal({
  template,
  onClose,
  onDuplicate,
}: {
  template: LetterTemplate | null;
  onClose: () => void;
  onDuplicate: (t: LetterTemplate) => void;
}) {
  const [copiedVar, setCopiedVar] = useState<string | null>(null);

  const variables = template
    ? Array.from(new Set(template.prompt_template.match(/\{\{\w+\}\}/g) ?? []))
    : [];

  function copyVar(v: string) {
    navigator.clipboard?.writeText(v);
    setCopiedVar(v);
    setTimeout(() => setCopiedVar(null), 1500);
  }

  return (
    <Modal
      open={template !== null}
      onClose={onClose}
      title={template?.name ?? ""}
      description={template?.description ?? undefined}
      size="xl"
      footer={
        template ? (
          <button
            onClick={() => {
              onDuplicate(template);
              onClose();
            }}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Duplicate as Custom Template
          </button>
        ) : undefined
      }
    >
      {template && (
        <div className="space-y-4">
          {variables.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-gray-500">Variables (click to copy):</p>
              <div className="flex flex-wrap gap-1.5">
                {variables.map((v) => (
                  <button
                    key={v}
                    onClick={() => copyVar(v)}
                    className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-1 font-mono text-xs text-gray-700 hover:bg-gray-200"
                  >
                    {copiedVar === v ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}
          <textarea
            readOnly
            value={template.prompt_template}
            rows={16}
            className="w-full resize-none rounded-md border border-gray-200 bg-gray-50 p-3 font-mono text-xs text-gray-700"
          />
        </div>
      )}
    </Modal>
  );
}
