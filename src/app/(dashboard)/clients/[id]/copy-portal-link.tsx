"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { generateAndSyncPortalLink } from "./portal-actions";
import { Link2, Check } from "lucide-react";

export function CopyPortalLink({ clientId }: { clientId: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    const result = await generateAndSyncPortalLink(clientId);
    setLoading(false);
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
      // Clipboard can fail (permissions) — surface the URL so it's still usable.
      toast(result.url, "info");
    }
  }

  return (
    <Button variant="secondary" onClick={handleClick} loading={loading}>
      {copied ? (
        <Check className="h-4 w-4 text-green-600" />
      ) : (
        <Link2 className="h-4 w-4" />
      )}
      Portal Link
    </Button>
  );
}
