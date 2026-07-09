"use client";

import { useState } from "react";
import { Wrench, Database, RefreshCw, GitBranch, Stethoscope, Check, AlertTriangle, X } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils/helpers";

interface FieldComparison {
  name: string;
  expected_key: string;
  actual_key: string | null;
  ghl_field_id: string | null;
  status: "ok" | "key_mismatch" | "missing";
}

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
  {
    key: "opportunities",
    icon: GitBranch,
    title: "Create Opportunities for All Clients",
    desc: "Adds each client to your Active Client pipeline as an opportunity, placed in the stage that matches their progress. Run after syncing contacts and connecting the pipeline.",
    path: "/api/ghl/setup/create-opportunities",
  },
];

export function GhlSetupTools() {
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugBusy, setDebugBusy] = useState(false);
  const [debug, setDebug] = useState<{ summary: string; comparison: FieldComparison[] } | null>(null);

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

  async function runDebug() {
    setDebugBusy(true);
    try {
      const res = await fetch("/api/ghl/debug/fields");
      const json = await res.json();
      if (json.error) {
        toast(json.error, "error");
        setDebug(null);
      } else {
        setDebug({ summary: json.summary, comparison: json.comparison });
      }
    } catch {
      toast("Request failed.", "error");
    } finally {
      setDebugBusy(false);
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

        {/* Diagnostics — compares CDP's expected field keys against GHL's actual keys. */}
        <div className="rounded-lg border border-white/10 p-4">
          <button
            onClick={() => {
              setDebugOpen((o) => !o);
              if (!debug && !debugOpen) runDebug();
            }}
            className="flex w-full items-center gap-2 rounded-md bg-white/[0.06] px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/10"
          >
            <Stethoscope className="h-4 w-4" />
            Debug Field Keys
          </button>
          <p className="mt-2 text-xs text-slate-500">
            Fields empty in GHL? This checks whether the custom fields in your GHL location have the
            keys ClientDeck Pro writes to (<code className="text-slate-400">cdp__*</code>).
          </p>

          {debugOpen && (
            <div className="mt-3">
              {debugBusy && !debug ? (
                <p className="text-xs text-slate-500">Checking your GHL fields…</p>
              ) : debug ? (
                <>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-medium text-slate-300">{debug.summary}</p>
                    <button
                      onClick={runDebug}
                      disabled={debugBusy}
                      className="text-xs text-blue-400 hover:text-blue-300 disabled:text-slate-600"
                    >
                      {debugBusy ? "Refreshing…" : "Re-check"}
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[32rem] text-left text-xs">
                      <thead className="text-slate-500">
                        <tr>
                          <th className="py-1 pr-3 font-medium">Field</th>
                          <th className="py-1 pr-3 font-medium">Expected key</th>
                          <th className="py-1 pr-3 font-medium">In GHL</th>
                          <th className="py-1 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="text-slate-400">
                        {debug.comparison.map((c) => (
                          <tr key={c.name} className="border-t border-white/5">
                            <td className="py-1.5 pr-3 text-slate-300">{c.name}</td>
                            <td className="py-1.5 pr-3 font-mono text-[11px]">{c.expected_key}</td>
                            <td className="py-1.5 pr-3 font-mono text-[11px]">{c.actual_key ?? "—"}</td>
                            <td className="py-1.5">
                              {c.status === "ok" ? (
                                <span className="inline-flex items-center gap-1 text-emerald-400">
                                  <Check className="h-3 w-3" /> OK
                                </span>
                              ) : c.status === "missing" ? (
                                <span className="inline-flex items-center gap-1 text-red-400">
                                  <X className="h-3 w-3" /> Missing
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-amber-400">
                                  <AlertTriangle className="h-3 w-3" /> Key mismatch
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">
                    Missing or mismatched? Run <span className="text-slate-400">Create Custom Fields</span>{" "}
                    above — GHL derives each key from the field name, so the CDP-named fields resolve to
                    the expected keys automatically.
                  </p>
                </>
              ) : (
                <button onClick={runDebug} className="text-xs text-blue-400 hover:text-blue-300">
                  Run check
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
