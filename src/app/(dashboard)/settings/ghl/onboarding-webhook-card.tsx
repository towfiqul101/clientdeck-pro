"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils/helpers";
import { Copy, Check } from "lucide-react";

export function OnboardingWebhookCard({ webhookUrl }: { webhookUrl: string }) {
  const [copied, setCopied] = useState<string | null>(null);

  const body = `{
  "contactId": "{{contact.id}}",
  "locationId": "{{location.id}}",
  "event": "onboarding_complete",
  "firstName": "{{contact.first_name}}",
  "lastName": "{{contact.last_name}}",
  "email": "{{contact.email}}"
}`;

  function copy(label: string, text: string) {
    navigator.clipboard?.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <Card>
      <div className="space-y-4 p-6">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            Onboarding Webhook Setup
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Wire this in GHL so a completed onboarding form auto-creates the client
            in ClientDeck Pro.
          </p>
        </div>

        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-gray-600">
          <li>GHL → Automations → New Workflow</li>
          <li>
            Trigger: <span className="font-medium">Tag added</span> —{" "}
            <code className="rounded bg-gray-100 px-1">onboarding-complete</code>
          </li>
          <li>
            Action: <span className="font-medium">Webhook (POST)</span> to the URL
            below, with the JSON body below
          </li>
        </ol>

        <CopyRow
          label="URL"
          value={webhookUrl}
          copied={copied === "url"}
          onCopy={() => copy("url", webhookUrl)}
        />

        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">Body (JSON)</span>
            <button
              onClick={() => copy("body", body)}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              {copied === "body" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied === "body" ? "Copied" : "Copy"}
            </button>
          </div>
          <pre className="overflow-x-auto rounded-md border border-gray-200 bg-gray-50 p-3 font-mono text-xs text-gray-700">
            {body}
          </pre>
        </div>
      </div>
    </Card>
  );
}

function CopyRow({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div>
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <div className="mt-1 flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
        <code className="flex-1 truncate font-mono text-xs text-gray-700">{value}</code>
        <button
          onClick={onCopy}
          className={cn("shrink-0 text-gray-400 hover:text-gray-700", copied && "text-green-600")}
          aria-label={`Copy ${label}`}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
