"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Loader2, MessageSquareHeart } from "lucide-react";

/**
 * Self-contained button for the completion card: fires the
 * `send-review-sms` GHL tag (via the review-request route) and toasts the
 * outcome. Best-effort — a failed GHL sync just surfaces an error toast.
 */
export function SendReviewRequestButton({ clientId }: { clientId: string }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch("/api/ghl/send-review-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      const data = await res.json();
      if (data.ok) {
        toast(data.message ?? "Review request sent via GHL.", "success");
      } else {
        toast(data.error ?? "Could not send the review request.", "error");
      }
    } catch {
      toast("Could not reach the server. Try again.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="secondary" onClick={handleClick} disabled={loading}>
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <MessageSquareHeart className="h-4 w-4" />
      )}
      Send Review Request via GHL
    </Button>
  );
}
