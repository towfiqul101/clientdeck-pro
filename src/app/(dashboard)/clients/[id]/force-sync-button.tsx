"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { forceSyncClientToGHL } from "./ghl-sync-actions";

/**
 * Pushes all of this client's current values to their GHL contact's custom
 * fields on demand. Only rendered when the client is linked to a GHL contact.
 */
export function ForceSyncButton({ clientId }: { clientId: string }) {
  const { toast } = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleSync() {
    setBusy(true);
    const result = await forceSyncClientToGHL(clientId);
    setBusy(false);
    if (result.success) {
      toast(`Synced ${result.fieldCount} field(s) to GHL.`, "success");
      router.refresh();
    } else {
      toast(result.error, "error");
    }
  }

  return (
    <Button type="button" variant="secondary" onClick={handleSync} loading={busy}>
      <RefreshCw className="h-4 w-4" />
      Force Sync to GHL
    </Button>
  );
}
