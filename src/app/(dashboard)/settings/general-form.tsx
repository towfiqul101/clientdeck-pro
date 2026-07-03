"use client";

import { useState } from "react";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { updateGeneralSettings } from "./actions";

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
];

interface GeneralFormProps {
  initial: {
    name: string;
    phone: string;
    website: string;
    timezone: string;
  };
}

export function GeneralForm({ initial }: GeneralFormProps) {
  const { toast } = useToast();
  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.phone);
  const [website, setWebsite] = useState(initial.website);
  const [timezone, setTimezone] = useState(initial.timezone);
  const [pending, setPending] = useState(false);

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

  return (
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
  );
}
