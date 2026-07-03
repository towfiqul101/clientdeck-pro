"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { US_STATES, CREDIT_GOALS } from "@/lib/constants";
import {
  createClient as createClientAction,
  updateClient,
  type ClientFormValues,
} from "./actions";
import { AlertCircle } from "lucide-react";
import type { CreditGoal } from "@/types";

export interface ClientFormInitial {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  dob: string;
  ssn_last4: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  zip: string;
  score_eq_start: string;
  score_exp_start: string;
  score_tu_start: string;
  score_goal: string;
  credit_goal: string;
  monthly_fee: string;
  referral_source: string;
  notes: string;
}

interface ClientFormProps {
  mode: "create" | "edit";
  clientId?: string;
  initial: ClientFormInitial;
  ghlConfigured: boolean;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <div className="border-b border-gray-200 px-6 py-4">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">{children}</div>
    </Card>
  );
}

const toNum = (v: string): number | null => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};

export function ClientForm({
  mode,
  clientId,
  initial,
  ghlConfigured,
}: ClientFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [values, setValues] = useState<ClientFormInitial>(initial);
  const [createInGhl, setCreateInGhl] = useState(ghlConfigured);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const set =
    (key: keyof ClientFormInitial) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >
    ) =>
      setValues((v) => ({ ...v, [key]: e.target.value }));

  function buildPayload(): ClientFormValues {
    return {
      first_name: values.first_name,
      last_name: values.last_name,
      email: values.email,
      phone: values.phone,
      dob: values.dob,
      ssn_last4: values.ssn_last4,
      address_line1: values.address_line1,
      address_line2: values.address_line2,
      city: values.city,
      state: values.state,
      zip: values.zip,
      score_eq_start: toNum(values.score_eq_start),
      score_exp_start: toNum(values.score_exp_start),
      score_tu_start: toNum(values.score_tu_start),
      score_goal: toNum(values.score_goal),
      credit_goal: (values.credit_goal || "") as CreditGoal | "",
      monthly_fee: parseFloat(values.monthly_fee) || 0,
      referral_source: values.referral_source,
      notes: values.notes,
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const payload = buildPayload();

    if (mode === "create") {
      const result = await createClientAction(payload, createInGhl);
      if (result.success) {
        toast("Client created.", "success");
        router.push(`/clients/${result.clientId}`);
        return;
      }
      setError(result.error);
      setPending(false);
    } else {
      const result = await updateClient(clientId!, payload);
      if (result.success) {
        toast("Client updated.", "success");
        router.push(`/clients/${clientId}`);
        router.refresh();
        return;
      }
      setError(result.error ?? "Could not update client.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Section title="Personal Information">
        <Field label="First name *" htmlFor="first_name">
          <Input
            id="first_name"
            value={values.first_name}
            onChange={set("first_name")}
            required
          />
        </Field>
        <Field label="Last name *" htmlFor="last_name">
          <Input
            id="last_name"
            value={values.last_name}
            onChange={set("last_name")}
            required
          />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            value={values.email}
            onChange={set("email")}
          />
        </Field>
        <Field label="Phone" htmlFor="phone">
          <Input
            id="phone"
            value={values.phone}
            onChange={set("phone")}
            placeholder="(555) 123-4567"
          />
        </Field>
        <Field label="Date of birth" htmlFor="dob">
          <Input id="dob" type="date" value={values.dob} onChange={set("dob")} />
        </Field>
        <Field
          label="SSN last 4"
          htmlFor="ssn_last4"
          hint="We only ever store the last 4 digits."
        >
          <Input
            id="ssn_last4"
            inputMode="numeric"
            maxLength={4}
            value={values.ssn_last4}
            onChange={(e) =>
              setValues((v) => ({
                ...v,
                ssn_last4: e.target.value.replace(/\D/g, "").slice(0, 4),
              }))
            }
            placeholder="1234"
          />
        </Field>
      </Section>

      <Section title="Address">
        <Field label="Address line 1" htmlFor="address_line1">
          <Input
            id="address_line1"
            value={values.address_line1}
            onChange={set("address_line1")}
          />
        </Field>
        <Field label="Address line 2" htmlFor="address_line2">
          <Input
            id="address_line2"
            value={values.address_line2}
            onChange={set("address_line2")}
          />
        </Field>
        <Field label="City" htmlFor="city">
          <Input id="city" value={values.city} onChange={set("city")} />
        </Field>
        <Field label="State" htmlFor="state">
          <Select
            id="state"
            value={values.state}
            onChange={set("state")}
            options={US_STATES}
            placeholder="Select a state"
          />
        </Field>
        <Field label="ZIP code" htmlFor="zip">
          <Input id="zip" value={values.zip} onChange={set("zip")} />
        </Field>
      </Section>

      <Section title="Credit Profile">
        <Field label="Equifax start" htmlFor="score_eq_start">
          <Input
            id="score_eq_start"
            type="number"
            min={300}
            max={850}
            value={values.score_eq_start}
            onChange={set("score_eq_start")}
          />
        </Field>
        <Field label="Experian start" htmlFor="score_exp_start">
          <Input
            id="score_exp_start"
            type="number"
            min={300}
            max={850}
            value={values.score_exp_start}
            onChange={set("score_exp_start")}
          />
        </Field>
        <Field label="TransUnion start" htmlFor="score_tu_start">
          <Input
            id="score_tu_start"
            type="number"
            min={300}
            max={850}
            value={values.score_tu_start}
            onChange={set("score_tu_start")}
          />
        </Field>
        <Field label="Score goal" htmlFor="score_goal">
          <Input
            id="score_goal"
            type="number"
            min={300}
            max={850}
            value={values.score_goal}
            onChange={set("score_goal")}
          />
        </Field>
        <Field label="Credit goal" htmlFor="credit_goal">
          <Select
            id="credit_goal"
            value={values.credit_goal}
            onChange={set("credit_goal")}
            options={CREDIT_GOALS}
            placeholder="Select a goal"
          />
        </Field>
      </Section>

      <Section title="Service">
        <Field label="Monthly fee" htmlFor="monthly_fee">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
              $
            </span>
            <Input
              id="monthly_fee"
              type="number"
              min={0}
              step="0.01"
              value={values.monthly_fee}
              onChange={set("monthly_fee")}
              className="pl-7"
            />
          </div>
        </Field>
        <Field label="Referral source" htmlFor="referral_source">
          <Input
            id="referral_source"
            value={values.referral_source}
            onChange={set("referral_source")}
            placeholder="e.g. Google, referral, ad"
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notes" htmlFor="notes">
            <Textarea
              id="notes"
              value={values.notes}
              onChange={set("notes")}
              rows={4}
            />
          </Field>
        </div>
      </Section>

      {mode === "create" && (
        <label
          className={`flex items-start gap-3 rounded-lg border p-4 text-sm ${
            ghlConfigured
              ? "border-gray-200 bg-white"
              : "border-gray-200 bg-gray-50"
          }`}
        >
          <input
            type="checkbox"
            checked={createInGhl}
            disabled={!ghlConfigured}
            onChange={(e) => setCreateInGhl(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span>
            <span className="font-medium text-gray-900">
              Also create this contact in GoHighLevel
            </span>
            <span className="block text-gray-500">
              {ghlConfigured
                ? "Syncs the contact to your connected GHL sub-account."
                : "Connect GHL in Settings to enable this."}
            </span>
          </span>
        </label>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.back()}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          {mode === "create" ? "Create client" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
