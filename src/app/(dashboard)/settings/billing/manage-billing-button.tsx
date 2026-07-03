"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ExternalLink } from "lucide-react";

export function ManageBillingButton() {
  const { toast } = useToast();
  return (
    <Button
      variant="secondary"
      onClick={() =>
        toast(
          "Stripe customer portal isn't wired up yet — coming in the billing milestone.",
          "info"
        )
      }
    >
      <ExternalLink className="h-4 w-4" />
      Manage Billing
    </Button>
  );
}
