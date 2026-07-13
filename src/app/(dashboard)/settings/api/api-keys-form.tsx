"use client";

import { useState } from "react";
import { Key, Copy, Check, AlertTriangle } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { formatDate, cn } from "@/lib/utils/helpers";
import { generateAgencyApiKey, revokeAgencyApiKey } from "../actions";
import type { AgencyApiKey } from "@/types";

export function ApiKeysForm({ initialKeys }: { initialKeys: AgencyApiKey[] }) {
  const { toast } = useToast();
  const [keys, setKeys] = useState(initialKeys);
  const [generating, setGenerating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revealKey, setRevealKey] = useState<{ raw: string; copied: boolean } | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    const result = await generateAgencyApiKey();
    setGenerating(false);

    if (!result.success || !result.rawKey || !result.key) {
      toast(result.error ?? "Could not generate key.", "error");
      return;
    }

    setKeys((prev) => [result.key!, ...prev]);
    setRevealKey({ raw: result.rawKey, copied: false });
  }

  async function handleCopy() {
    if (!revealKey) return;
    try {
      await navigator.clipboard.writeText(revealKey.raw);
      setRevealKey({ ...revealKey, copied: true });
    } catch {
      toast("Could not copy — select and copy the key manually.", "error");
    }
  }

  async function handleRevoke(key: AgencyApiKey) {
    if (
      !window.confirm(
        `Revoke key ${key.key_prefix}...? Anything using it will stop working immediately.`
      )
    ) {
      return;
    }

    setRevokingId(key.id);
    const result = await revokeAgencyApiKey(key.id);
    setRevokingId(null);

    if (!result.success) {
      toast(result.error ?? "Could not revoke key.", "error");
      return;
    }

    setKeys((prev) =>
      prev.map((k) => (k.id === key.id ? { ...k, revoked_at: new Date().toISOString() } : k))
    );
    toast("Key revoked.", "success");
  }

  return (
    <>
      <Card>
        <CardHeader
          title="API Keys"
          description="Generate keys to access RoundTrack Pro data programmatically. Data endpoints are coming soon — keys can be created and tested today."
          action={
            <Button onClick={handleGenerate} loading={generating}>
              <Key className="h-4 w-4" />
              Generate Key
            </Button>
          }
        />

        {keys.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <Key className="h-8 w-8 text-slate-600" />
            <p className="mt-3 text-sm text-slate-500">No API keys yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {keys.map((key) => {
              const revoked = Boolean(key.revoked_at);
              return (
                <li key={key.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-800 text-slate-400">
                    <Key className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1 basis-40">
                    <p className="truncate font-mono text-sm text-slate-100">
                      {key.key_prefix}…
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      Created {formatDate(key.created_at)} · Last used{" "}
                      {key.last_used_at ? formatDate(key.last_used_at) : "never"}
                    </p>
                  </div>
                  {revoked ? (
                    <span className="rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-400">
                      Revoked {formatDate(key.revoked_at!)}
                    </span>
                  ) : (
                    <Button
                      variant="danger"
                      size="sm"
                      loading={revokingId === key.id}
                      onClick={() => handleRevoke(key)}
                    >
                      Revoke
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Modal
        open={revealKey !== null}
        onClose={() => setRevealKey(null)}
        title="Your new API key"
        size="md"
      >
        {revealKey && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Copy this key now — you won&apos;t be able to see it again.</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-3">
              <code className="flex-1 overflow-x-auto whitespace-nowrap font-mono text-sm text-slate-100">
                {revealKey.raw}
              </code>
              <button
                onClick={handleCopy}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium",
                  revealKey.copied
                    ? "text-emerald-400"
                    : "bg-white/[0.06] text-slate-300 hover:bg-white/10"
                )}
              >
                {revealKey.copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </>
                )}
              </button>
            </div>
            <Button className="w-full" onClick={() => setRevealKey(null)}>
              Done
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
}
