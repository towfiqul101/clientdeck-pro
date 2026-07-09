"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { UserPlus } from "lucide-react";
import { inviteTeamMember } from "./actions";
import type { TeamRole } from "@/types";

const field =
  "rounded-md border border-white/10 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

export function TeamInvite({
  current,
  max,
  planName,
  canInvite,
}: {
  current: number;
  max: number;
  planName: string;
  canInvite: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("staff");

  const unlimited = max >= 9999;
  const atLimit = !unlimited && current >= max;
  const usage = unlimited
    ? `${current} team member${current === 1 ? "" : "s"} (${planName} plan — unlimited)`
    : `${current} of ${max} team members used (${planName} plan)`;

  function submit() {
    start(async () => {
      const res = await inviteTeamMember({ name, email, role });
      if (res.success) {
        toast("Team member added.", "success");
        setName("");
        setEmail("");
        setRole("staff");
        setOpen(false);
        router.refresh();
      } else {
        toast(res.error ?? "Could not add member.", "error");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{usage}</p>
        {canInvite && (
          <button
            onClick={() => setOpen((o) => !o)}
            disabled={atLimit}
            title={atLimit ? "Upgrade your plan to add more team members" : undefined}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <UserPlus className="h-4 w-4" />
            Invite member
          </button>
        )}
      </div>

      {atLimit && canInvite && (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
          You&apos;ve reached your plan limit of {max} team members.{" "}
          <a href="/settings/billing" className="font-medium underline">
            Upgrade
          </a>{" "}
          to add more.
        </p>
      )}

      {open && canInvite && !atLimit && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-400">
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} className={field} placeholder="Jane Doe" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-400">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={field}
              placeholder="jane@agency.com"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-400">
            Role
            <select value={role} onChange={(e) => setRole(e.target.value as TeamRole)} className={field}>
              <option value="admin">Admin</option>
              <option value="staff">Staff</option>
              <option value="viewer">Viewer</option>
            </select>
          </label>
          <button
            onClick={submit}
            disabled={pending}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {pending ? "Adding…" : "Add"}
          </button>
        </div>
      )}
    </div>
  );
}
