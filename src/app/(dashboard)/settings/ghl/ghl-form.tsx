"use client";

import { useState } from "react";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { updateGHLSettings, testGHLConnection } from "../actions";
import { cn } from "@/lib/utils/helpers";
import { Eye, EyeOff, Copy, Check, CheckCircle2, XCircle } from "lucide-react";

interface GHLFormProps {
  initial: {
    locationId: string;
    apiKey: string;
  };
  webhookUrl: string;
}

export function GHLForm({ initial, webhookUrl }: GHLFormProps) {
  const { toast } = useToast();
  const [locationId, setLocationId] = useState(initial.locationId);
  const [apiKey, setApiKey] = useState(initial.apiKey);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const result = await updateGHLSettings({ locationId, apiKey });
    setPending(false);
    if (result.success) toast("GHL settings saved.", "success");
    else toast(result.error ?? "Could not save.", "error");
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    const result = await testGHLConnection({ locationId, apiKey });
    setTesting(false);
    setTestResult(result);
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <form onSubmit={handleSave} className="space-y-5 p-6">
        <Field
          label="GHL Location ID"
          htmlFor="locationId"
          hint="Found under Settings → Business Info in your GHL sub-account."
        >
          <Input
            id="locationId"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            placeholder="e.g. ve9EPM428h8vShlRW1KT"
          />
        </Field>

        <Field
          label="GHL API Key"
          htmlFor="apiKey"
          hint="A Private Integration token with contact, opportunity, and notes scopes."
        >
          <div className="relative">
            <Input
              id="apiKey"
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="••••••••••••••••"
              autoComplete="off"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowKey((s) => !s)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-400"
              aria-label={showKey ? "Hide API key" : "Show API key"}
            >
              {showKey ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </Field>

        <Field
          label="Inbound Webhook URL"
          htmlFor="webhook"
          hint="Add this as a webhook target in your GHL workflow to sync contacts into ClientDeck."
        >
          <div className="flex gap-2">
            <Input
              id="webhook"
              value={webhookUrl}
              readOnly
              className="bg-white/[0.03] font-mono text-xs"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={handleCopy}
              className="shrink-0"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-400" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </Field>

        {testResult && (
          <div
            className={cn(
              "flex items-start gap-2 rounded-md border p-3 text-sm",
              testResult.ok
                ? "border-green-500/30 bg-green-500/10 text-green-400"
                : "border-red-500/30 bg-red-500/10 text-red-400"
            )}
          >
            {testResult.ok ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>{testResult.message}</span>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={handleTest}
            loading={testing}
          >
            Test Connection
          </Button>
          <Button type="submit" loading={pending}>
            Save changes
          </Button>
        </div>
      </form>
    </Card>
  );
}
