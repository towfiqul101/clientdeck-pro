"use client";

import { useTransition } from "react";
import { useToast } from "@/components/ui/toast";
import { Send } from "lucide-react";
import { resendInvite } from "./actions";

/** Shown next to a Pending member (invited, never signed in) for owners/admins. */
export function ResendInviteButton({ memberId }: { memberId: string }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();

  function submit() {
    start(async () => {
      const res = await resendInvite(memberId);
      if (res.success) {
        toast("Invite email resent.", "success");
      } else {
        toast(res.error ?? "Could not resend the invite.", "error");
      }
    });
  }

  return (
    <button
      onClick={submit}
      disabled={pending}
      className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Send className="h-3 w-3" />
      {pending ? "Sending…" : "Resend invite"}
    </button>
  );
}
