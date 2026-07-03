"use client";

import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

export function ManageBillingButton() {
  return (
    <Button
      variant="secondary"
      onClick={() => window.location.assign("/api/settings/billing-portal")}
    >
      <ExternalLink className="h-4 w-4" />
      Manage Billing
    </Button>
  );
}
