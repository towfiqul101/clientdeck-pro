"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils/helpers";
import { updateClientNotifyList } from "./assign-actions";
import { Bell, Loader2 } from "lucide-react";

interface NotifyExtraStaffProps {
  clientId: string;
  selected: string[];
  members: { id: string; name: string }[];
}

/**
 * Extra staff to notify about this client's events, on top of the default
 * owner/assigned-staff targeting (src/lib/ghl/notifications.ts). Owner and
 * whoever's assigned above are already covered by default — this is for
 * looping in anyone else without subscribing them to every client globally.
 */
export function NotifyExtraStaff({ clientId, selected, members }: NotifyExtraStaffProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [ids, setIds] = useState<string[]>(selected);
  const [isPending, startTransition] = useTransition();

  function toggle(id: string) {
    const previous = ids;
    const next = ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id];
    setIds(next);
    startTransition(async () => {
      const result = await updateClientNotifyList(clientId, next);
      if (result.success) {
        router.refresh();
      } else {
        setIds(previous);
        toast(result.error ?? "Could not update notification list.", "error");
      }
    });
  }

  if (members.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-sm text-slate-400">
      <span className="inline-flex items-center gap-1">
        <Bell className="h-3.5 w-3.5" />
        Also notify:
      </span>
      {members.map((m) => {
        const checked = ids.includes(m.id);
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => toggle(m.id)}
            disabled={isPending}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              checked
                ? "border-violet-500/40 bg-violet-500/10 text-violet-300"
                : "border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.06]"
            )}
          >
            {m.name}
          </button>
        );
      })}
      {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" />}
    </div>
  );
}
