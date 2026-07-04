"use client";

import { useState } from "react";
import { Field, Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { updateGeneralSettings, updateAutomationSettings } from "./actions";

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
];

const AUTO_ROUND_DELAY_OPTIONS = [
  { value: "1", label: "1 day" },
  { value: "5", label: "5 days" },
  { value: "7", label: "7 days" },
  { value: "14", label: "14 days" },
];

interface GeneralFormProps {
  initial: {
    name: string;
    phone: string;
    website: string;
    timezone: string;
    autoCreateRounds: boolean;
    autoRoundDelayDays: number;
    googleReviewLink: string;
    referralBonus: string;
    referralLink: string;
  };
}

export function GeneralForm({ initial }: GeneralFormProps) {
  const { toast } = useToast();
  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.phone);
  const [website, setWebsite] = useState(initial.website);
  const [timezone, setTimezone] = useState(initial.timezone);
  const [pending, setPending] = useState(false);

  const [autoCreateRounds, setAutoCreateRounds] = useState(
    initial.autoCreateRounds
  );
  const [autoRoundDelayDays, setAutoRoundDelayDays] = useState(
    String(initial.autoRoundDelayDays)
  );
  const [googleReviewLink, setGoogleReviewLink] = useState(
    initial.googleReviewLink
  );
  const [referralBonus, setReferralBonus] = useState(initial.referralBonus);
  const [referralLink, setReferralLink] = useState(initial.referralLink);
  const [automationPending, setAutomationPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const result = await updateGeneralSettings({
      name,
      phone,
      website,
      timezone,
    });
    setPending(false);
    if (result.success) toast("Settings saved.", "success");
    else toast(result.error ?? "Could not save settings.", "error");
  }

  async function handleAutomationSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAutomationPending(true);
    const result = await updateAutomationSettings({
      autoCreateRounds,
      autoRoundDelayDays: Number(autoRoundDelayDays),
      googleReviewLink,
      referralBonus,
      referralLink,
    });
    setAutomationPending(false);
    if (result.success) toast("Automation settings saved.", "success");
    else toast(result.error ?? "Could not save automation settings.", "error");
  }

  return (
    <div className="space-y-6">
    <Card>
      <form onSubmit={handleSubmit} className="space-y-5 p-6">
        <Field label="Agency name" htmlFor="name">
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </Field>

        <Field label="Phone" htmlFor="phone">
          <Input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(555) 123-4567"
            autoComplete="tel"
          />
        </Field>

        <Field label="Website" htmlFor="website">
          <Input
            id="website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://youragency.com"
            type="url"
          />
        </Field>

        <Field label="Timezone" htmlFor="timezone">
          <select
            id="timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace("_", " ")}
              </option>
            ))}
          </select>
        </Field>

        <div className="flex justify-end">
          <Button type="submit" loading={pending}>
            Save changes
          </Button>
        </div>
      </form>
    </Card>

    <Card>
      <form onSubmit={handleAutomationSubmit} className="space-y-5 p-6">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            Automation Settings
          </h3>
          <p className="mt-0.5 text-sm text-gray-500">
            Automatically prepare the next dispute round once a completed
            round&apos;s response window has passed.
          </p>
        </div>

        <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 text-sm">
          <input
            type="checkbox"
            checked={autoCreateRounds}
            onChange={(e) => setAutoCreateRounds(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span>
            <span className="font-medium text-gray-900">
              Auto-create next round
            </span>
            <span className="block text-gray-500">
              When a client&apos;s round is complete and items are still in
              dispute, automatically prepare the next round for staff review.
            </span>
          </span>
        </label>

        <Field
          label="Delay before auto-creating"
          htmlFor="autoRoundDelayDays"
          hint="Days to wait after a round's responses are received before starting the next one."
        >
          <Select
            id="autoRoundDelayDays"
            value={autoRoundDelayDays}
            onChange={(e) => setAutoRoundDelayDays(e.target.value)}
            options={AUTO_ROUND_DELAY_OPTIONS}
            disabled={!autoCreateRounds}
          />
        </Field>

        <div className="border-t border-gray-100 pt-5">
          <h3 className="text-sm font-semibold text-gray-900">Client Wins</h3>
          <p className="mt-0.5 text-sm text-gray-500">
            Links shared with clients when they hit a milestone (e.g. an item
            deletion or goal completion).
          </p>
        </div>

        <Field label="Google review link" htmlFor="googleReviewLink">
          <Input
            id="googleReviewLink"
            value={googleReviewLink}
            onChange={(e) => setGoogleReviewLink(e.target.value)}
            placeholder="https://g.page/r/your-agency/review"
            type="url"
          />
        </Field>

        <Field label="Referral bonus" htmlFor="referralBonus">
          <Input
            id="referralBonus"
            value={referralBonus}
            onChange={(e) => setReferralBonus(e.target.value)}
            placeholder="$50 credit for every referral"
          />
        </Field>

        <Field label="Referral link" htmlFor="referralLink">
          <Input
            id="referralLink"
            value={referralLink}
            onChange={(e) => setReferralLink(e.target.value)}
            placeholder="https://youragency.com/refer"
            type="url"
          />
        </Field>

        <div className="flex justify-end">
          <Button type="submit" loading={automationPending}>
            Save changes
          </Button>
        </div>
      </form>
    </Card>
    </div>
  );
}
