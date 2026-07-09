"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { updateOnboardingStep } from "./actions";
import { useToast } from "@/components/ui/toast";

export function SnapshotConfirm({
  agencyId,
  initial,
}: {
  agencyId: string;
  initial: boolean;
}) {
  const { toast } = useToast();
  const [checked, setChecked] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    const next = !checked;
    setChecked(next);
    setSaving(true);
    const res = await updateOnboardingStep(agencyId, "snapshot_installed", next);
    setSaving(false);
    if (!res.success) {
      setChecked(!next);
      toast(res.error ?? "Could not save.", "error");
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={saving}
      className="flex items-center gap-3 rounded-md border border-white/10 bg-[#1a1a2e] px-4 py-3 text-left text-sm hover:bg-white/[0.03] disabled:opacity-60"
    >
      <span
        className={`flex h-5 w-5 items-center justify-center rounded border ${
          checked ? "border-blue-600 bg-blue-600 text-white" : "border-white/10"
        }`}
      >
        {checked && <Check className="h-3 w-3" />}
      </span>
      I&apos;ve installed the snapshot in my GoHighLevel account
    </button>
  );
}
