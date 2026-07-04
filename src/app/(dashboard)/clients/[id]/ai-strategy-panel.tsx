"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { Bot, Loader2 } from "lucide-react";

/**
 * Self-contained trigger + panel: renders the "AI Strategy" button and, once
 * clicked, a modal that fetches Claude's dispute-strategy recommendations for
 * this client. Non-streaming — the whole response arrives at once (within the
 * route's 60s maxDuration).
 */
export function AIStrategyPanel({ clientId }: { clientId: string }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [strategy, setStrategy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleOpen() {
    setOpen(true);
    setError(null);
    setStrategy(null);
    setLoading(true);
    try {
      const res = await fetch("/api/ai/strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      const data = await res.json();
      if (data.ok) {
        setStrategy(data.strategy as string);
      } else {
        const message = data.error ?? "Could not generate a strategy.";
        setError(message);
        toast(message, "error");
      }
    } catch {
      const message = "Could not reach the server. Try again.";
      setError(message);
      toast(message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant="secondary" onClick={handleOpen}>
        <Bot className="h-4 w-4" />
        AI Strategy
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="🤖 AI Dispute Advisor"
        size="lg"
      >
        {loading && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Analyzing dispute history and generating recommendations…
          </div>
        )}
        {!loading && error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
        {!loading && !error && strategy && (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-900">
            {strategy}
          </p>
        )}
      </Modal>
    </>
  );
}
