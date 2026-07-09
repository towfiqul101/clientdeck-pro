"use client";

import { useEffect, useRef, useState } from "react";
import { Link2, Mail, MessageSquare, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { copyPortalLink, sendPortalLinkViaGHL, sendPortalLinkViaEmailAction } from "./portal-actions";

export function PortalLinkMenu({ clientId }: { clientId: string }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function handleCopy() {
    setBusy("copy");
    setOpen(false);
    const result = await copyPortalLink(clientId);
    setBusy(null);
    if (!result.success) {
      toast(result.error, "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(result.url);
      setCopied(true);
      toast("Fresh portal link copied to clipboard.", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast(result.url, "info");
    }
  }

  async function handleGHL() {
    setBusy("ghl");
    setOpen(false);
    const result = await sendPortalLinkViaGHL(clientId);
    setBusy(null);
    if (!result.success) {
      toast(result.error, "error");
      return;
    }
    toast("Portal link sent via GHL SMS.", "success");
  }

  async function handleEmail() {
    setBusy("email");
    setOpen(false);
    const result = await sendPortalLinkViaEmailAction(clientId);
    setBusy(null);
    if (!result.success) {
      toast(result.error, "error");
      return;
    }
    toast("Portal link sent via email.", "success");
  }

  return (
    <div className="relative" ref={menuRef}>
      <Button variant="secondary" onClick={() => setOpen((o) => !o)} loading={busy !== null}>
        {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Link2 className="h-4 w-4" />}
        Share Portal Link
        <ChevronDown className="h-3.5 w-3.5" />
      </Button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-56 rounded-xl border border-white/10 bg-[#1a1a2e] py-1 shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
          <button
            onClick={handleGHL}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-white/5"
          >
            <MessageSquare className="h-4 w-4" /> Send via GHL SMS
          </button>
          <button
            onClick={handleEmail}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-white/5"
          >
            <Mail className="h-4 w-4" /> Send via Email
          </button>
          <button
            onClick={handleCopy}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-white/5"
          >
            <Link2 className="h-4 w-4" /> Copy Link
          </button>
        </div>
      )}
    </div>
  );
}
