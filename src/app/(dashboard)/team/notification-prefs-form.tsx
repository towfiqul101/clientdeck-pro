"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/helpers";
import {
  STAFF_FACING_NOTIFICATION_TYPES,
  STAFF_NOTIFICATION_LABELS,
} from "@/lib/team/notification-prefs";
import { updateNotificationPrefs } from "./actions";

export function NotificationPrefsForm({ initial }: { initial: string[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [selected, setSelected] = useState<string[]>(initial);
  const [saving, setSaving] = useState(false);

  function toggle(type: string) {
    setSelected((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  async function save() {
    setSaving(true);
    const res = await updateNotificationPrefs(selected);
    setSaving(false);
    if (res.success) {
      toast("Notification preferences saved.", "success");
      router.refresh();
    } else {
      toast(res.error ?? "Could not save preferences.", "error");
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {STAFF_FACING_NOTIFICATION_TYPES.map((type) => {
          const checked = selected.includes(type);
          return (
            <button
              key={type}
              type="button"
              onClick={() => toggle(type)}
              className={cn(
                "flex w-full items-center justify-between rounded-lg border px-3.5 py-2.5 text-left text-sm transition-colors",
                checked
                  ? "border-violet-500/40 bg-violet-500/10 text-slate-100"
                  : "border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.06]"
              )}
            >
              {STAFF_NOTIFICATION_LABELS[type]}
              <span
                className={cn(
                  "flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors",
                  checked ? "justify-end border-violet-500 bg-violet-600" : "justify-start border-white/15 bg-white/[0.06]"
                )}
              >
                <span className="mx-0.5 h-3.5 w-3.5 rounded-full bg-white" />
              </span>
            </button>
          );
        })}
      </div>
      <Button size="sm" onClick={save} loading={saving}>
        Save preferences
      </Button>
    </div>
  );
}
