"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { Plan } from "@/types";
import { createCheckoutSession } from "./checkout-actions";

export function UpgradeButton({
  planId,
  planName,
}: {
  planId: Plan;
  planName: string;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    const result = await createCheckoutSession(planId);
    if (!result.success) {
      setLoading(false);
      toast(result.error, "error");
      return;
    }
    window.location.assign(result.url);
  }

  return (
    <Button
      variant="secondary"
      className="mt-4 w-full"
      loading={loading}
      onClick={handleClick}
    >
      Switch to {planName}
    </Button>
  );
}
