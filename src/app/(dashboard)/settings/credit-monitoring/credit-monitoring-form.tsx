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
  };
}

export function CreditMonitoringForm({ initial }: CreditMonitoringFormProps) {
  const { toast } = useToast();
  const [service, setService] = useState(initial.service);
  const [apiKey, setApiKey] = useState(initial.apiKey);
  const [apiSecret, setApiSecret] = useState(initial.apiSecret);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  async function handleSave() {
    setSaving(true);
    const result = await updateCreditMonitoringSettings({ service, apiKey, apiSecret });
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
        description="Connect MyFreeScoreNow, IdentityIQ, or SmartCredit to pull scores directly from within ClientDeck Pro. Bring your own provider account and API keys."
      />
      <div className="space-y-5 p-6">
        <Field label="Provider" htmlFor="service">
          <Select
            id="service"
            options={SERVICE_OPTIONS}
            value={service}
            onChange={(e) => setService(e.target.value as CreditMonitoringService | "none")}
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
