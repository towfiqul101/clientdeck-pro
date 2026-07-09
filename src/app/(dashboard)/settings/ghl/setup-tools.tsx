"use client";

import { useState } from "react";
import { Wrench, Database, RefreshCw } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils/helpers";

const TOOLS = [
  {
    key: "fields",
    icon: Wrench,
    title: "Create Custom Fields",
    desc: "Creates all 16 CDP custom fields in your GHL location automatically.",
    path: "/api/ghl/setup/create-fields",
  },
  {
    key: "pipeline",
    icon: Database,
    title: "Find & Connect Pipeline",
    desc: 'Auto-detects your "Active Client" GHL pipeline and maps stage ids for automatic stage moves.',
    path: "/api/ghl/setup/find-pipeline",
  },
  {
    key: "sync",
    icon: RefreshCw,
    title: "Sync All Clients to GHL",
    desc: "Pushes all your ClientDeck clients to GHL as contacts with all custom fields.",
    path: "/api/ghl/setup/sync-clients",
  },
];

export function GhlSetupTools() {
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});

  async function run(key: string, path: string) {
    setBusy(key);
    try {
      const res = await fetch(path, { method: "POST" });
      const json = await res.json();
      const msg = json.message || json.error || (json.ok ? "Done." : "Failed.");
      setResults((r) => ({ ...r, [key]: msg }));
      toast(msg, json.ok ? "success" : "error");
    } catch {
      toast("Request failed.", "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader
        title="GHL Setup Tools"
        description="Run these to automatically configure your GHL account. Requires your GHL API key to be saved above."
      />
      <div className="space-y-3 p-6">
        {TOOLS.map((t) => {
          const Icon = t.icon;
          return (
            <div key={t.key} className="rounded-lg border border-white/10 p-4">
              <button
                disabled={busy !== null}
                onClick={() => run(t.key, t.path)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
                  busy !== null
                    ? "cursor-not-allowed bg-white/[0.06] text-slate-500"
                    : "bg-blue-500/10 text-blue-400 hover:bg-blue-500/15"
                )}
              >
                <Icon className="h-4 w-4" />
                {busy === t.key ? "Running…" : t.title}
              </button>
              <p className="mt-2 text-xs text-slate-500">{t.desc}</p>
              {results[t.key] && <p className="mt-1 text-xs font-medium text-slate-300">{results[t.key]}</p>}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
