"use client";

import { useState } from "react";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { submitSnapshotRequest } from "./actions";

export function SnapshotRequestForm() {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    const result = await submitSnapshotRequest({
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      ghlLocationId: String(formData.get("ghlLocationId") ?? ""),
      agencyName: String(formData.get("agencyName") ?? ""),
      message: String(formData.get("message") ?? ""),
    });
    setLoading(false);
    if (!result.success) {
      setError(result.error ?? "Something went wrong.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/10 p-8 text-center">
        <CheckCircle2 className="h-8 w-8 text-green-400" />
        <h3 className="font-semibold text-green-300">Request received</h3>
        <p className="text-sm text-green-400">
          We&apos;ll email you the snapshot import link shortly.
        </p>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="space-y-4 rounded-lg border border-white/10 bg-[#13131f] p-6 shadow-sm">
      {error && (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </p>
      )}
      <Field label="Name" htmlFor="name">
        <Input id="name" name="name" required autoComplete="name" />
      </Field>
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </Field>
      <Field label="Agency name" htmlFor="agencyName">
        <Input id="agencyName" name="agencyName" />
      </Field>
      <Field label="GHL Location ID" htmlFor="ghlLocationId" hint="Found in GHL → Settings → Business Info.">
        <Input id="ghlLocationId" name="ghlLocationId" />
      </Field>
      <Field label="Anything else?" htmlFor="message">
        <Textarea id="message" name="message" rows={3} />
      </Field>
      <Button type="submit" loading={loading} className="w-full">
        Request the Snapshot
      </Button>
    </form>
  );
}
