"use client";

import { useState } from "react";
import { Field, Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { updateCreditMonitoringSettings, testCreditMonitoringConnection } from "../actions";
import type { CreditMonitoringService } from "@/types";

const SERVICE_OPTIONS: { value: CreditMonitoringService | "none"; label: string }[] = [
  { value: "none", label: "None" },
  { value: "myfreescorenow", label: "MyFreeScoreNow (GHL native partner)" },
  { value: "identityiq", label: "IdentityIQ (TransUnion reseller)" },
  { value: "smartcredit", label: "SmartCredit (white-label)" },
];

interface CreditMonitoringFormProps {
  initial: {
    service: CreditMonitoringService | "none";
    apiKey: string;
    apiSecret: string;
    autoPullScores: boolean;
  };
}

export function CreditMonitoringForm({ initial }: CreditMonitoringFormProps) {
  const { toast } = useToast();
  const [service, setService] = useState(initial.service);
  const [apiKey, setApiKey] = useState(initial.apiKey);
  const [apiSecret, setApiSecret] = useState(initial.apiSecret);
  const [autoPullOnNewClient, setAutoPullOnNewClient] = useState(initial.autoPullScores);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  function handleServiceChange(next: CreditMonitoringService | "none") {
    setService(next);
    setApiKey("");
    setApiSecret("");
  }

  async function handleSave() {
    setSaving(true);
    const result = await updateCreditMonitoringSettings({
      service,
      apiKey,
      apiSecret,
      autoPullScores: autoPullOnNewClient,
    });
    setSaving(false);
    if (result.success) toast("Credit monitoring settings saved.", "success");
    else toast(result.error ?? "Could not save.", "error");
  }

  async function handleTest() {
    setTesting(true);
    const result = await testCreditMonitoringConnection({ service, apiKey, apiSecret });
    setTesting(false);
    toast(result.message, result.ok ? "success" : "error");
  }

  return (
    <Card>
      <CardHeader
        title="Credit Monitoring Service"
        description="Connect MyFreeScoreNow, IdentityIQ, or SmartCredit to pull scores directly from within RoundTrack Pro. Bring your own provider account and API keys."
      />
      <div className="space-y-5 p-6">
        <Field label="Provider" htmlFor="service">
          <Select
            id="service"
            options={SERVICE_OPTIONS}
            value={service}
            onChange={(e) => handleServiceChange(e.target.value as CreditMonitoringService | "none")}
          />
        </Field>

        {service !== "none" && (
          <>
            <Field label="API Key" htmlFor="apiKey">
              <Input id="apiKey" value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="font-mono text-xs" />
            </Field>
            <Field label="API Secret" htmlFor="apiSecret">
              <Input id="apiSecret" type="password" value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} className="font-mono text-xs" />
            </Field>

            <label className="flex items-start gap-3 rounded-lg border border-white/10 bg-[#1a1a2e] p-4 text-sm">
              <input
                type="checkbox"
                checked={autoPullOnNewClient}
                onChange={(e) => setAutoPullOnNewClient(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-white/10 text-blue-400 focus:ring-blue-500"
              />
              <span>
                <span className="font-medium text-slate-100">
                  Auto-pull scores for new clients
                </span>
                <span className="block text-slate-500">
                  When a brand-new client completes onboarding, automatically
                  pull their scores from this provider instead of waiting for
                  a staff member to trigger it manually.
                </span>
              </span>
            </label>
          </>
        )}

        <div className="flex justify-end gap-2">
          {service !== "none" && (
            <Button type="button" variant="secondary" loading={testing} onClick={handleTest}>
              Test Connection
            </Button>
          )}
          <Button onClick={handleSave} loading={saving}>
            Save
          </Button>
        </div>
      </div>
    </Card>
  );
}
