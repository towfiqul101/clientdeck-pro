"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { X, Copy, Loader2, Wrench, Database, RefreshCw, Mail } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { cn, formatCurrency, formatDate } from "@/lib/utils/helpers";
import { avatarColor, initials, statusDotClass } from "@/lib/admin/avatar";
import type { AgencyPanelData } from "@/lib/admin/agency-panel";
import type { Plan, PlanStatus } from "@/types";
import type { GHLNotificationType } from "@/lib/ghl/notifications";
import {
  saveAgencyStatus,
  extendTrial14,
  saveGhlConfig,
  testConnection,
  saveBranding,
  recordAgencyPayment,
  deleteAgencyAdmin,
} from "@/app/(admin)/admin/agency-panel-actions";

const PLANS: { id: Plan; label: string }[] = [
  { id: "solo", label: "Starter" },
  { id: "pro", label: "Pro" },
  { id: "agency", label: "Agency" },
  { id: "enterprise", label: "Enterprise" },
];
const STATUSES: PlanStatus[] = ["active", "trialing", "past_due", "paused", "cancelled"];
const TABS = ["Status", "GHL Config", "Tools", "Branding", "Payments"] as const;
type Tab = (typeof TABS)[number];

const WIRED_NOTIFICATION_TYPES: readonly GHLNotificationType[] = [
  "round_sent",
  "deletion_win",
  "round_results_in",
  "goal_achieved",
  "payment_failed",
  "portal_link",
  "staff_new_client",
  "staff_round_overdue",
  "staff_next_round_ready",
  "monthly_progress",
];

const field =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const label = "block text-xs font-medium text-gray-600 mb-1";
const primaryBtn =
  "rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50";
const secondaryBtn =
  "rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50";

function webhookUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://clientdeckpro.com";
  return `${base.replace(/\/$/, "")}/api/ghl/webhook`;
}

export function AgencySlideover({
  agencyId,
  onClose,
  onChange,
}: {
  agencyId: string | null;
  onClose: () => void;
  onChange?: () => void;
}) {
  const { toast } = useToast();
  // Data is stored alongside the id it belongs to so `loading` can be derived
  // (avoids synchronous setState in an effect on agency change).
  const [data, setData] = useState<{ id: string; payload: AgencyPanelData } | null>(null);
  const [tab, setTab] = useState<Tab>("Status");
  const [pending, start] = useTransition();

  const reload = useCallback(async () => {
    if (!agencyId) return;
    const res = await fetch(`/api/admin/agencies/${agencyId}`, { cache: "no-store" });
    const json = await res.json();
    if (json.ok) setData({ id: agencyId, payload: json.data as AgencyPanelData });
  }, [agencyId]);

  // Fetch when the selected agency changes. All state updates happen inside the
  // async callback, never synchronously in the effect body.
  useEffect(() => {
    if (!agencyId) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/admin/agencies/${agencyId}`, { cache: "no-store" });
      const json = await res.json();
      if (cancelled || !json.ok) return;
      setData({ id: agencyId, payload: json.data as AgencyPanelData });
      setTab("Status");
    })();
    return () => {
      cancelled = true;
    };
  }, [agencyId]);

  // Close on Escape.
  useEffect(() => {
    if (!agencyId) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [agencyId, onClose]);

  function run(fn: () => Promise<{ success: boolean; error?: string }>, ok: string) {
    start(async () => {
      const res = await fn();
      if (res.success) {
        toast(ok, "success");
        await reload();
        onChange?.();
      } else {
        toast(res.error ?? "Something went wrong.", "error");
      }
    });
  }

  const open = agencyId !== null;
  const current = data && data.id === agencyId ? data.payload : null;
  const loading = open && current === null;
  const agency = current?.agency;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-gray-900/50 transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        aria-hidden={!open}
      />
      {/* Drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-[480px] flex-col bg-white shadow-2xl transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
        role="dialog"
        aria-modal="true"
      >
        {loading || !agency ? (
          <div className="flex flex-1 items-center justify-center text-gray-400">
            {open ? <Loader2 className="h-6 w-6 animate-spin" /> : null}
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-gray-200 p-5">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white",
                    avatarColor(agency.name)
                  )}
                >
                  {initials(agency.name)}
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-gray-900">
                    {agency.name}
                  </h2>
                  <span className="mt-0.5 flex items-center gap-1.5 text-xs capitalize text-gray-500">
                    <span className={cn("h-2 w-2 rounded-full", statusDotClass(agency.plan_status))} />
                    {agency.plan_status.replace("_", " ")}
                  </span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 overflow-x-auto border-b border-gray-200 px-3">
              {TABS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                    tab === t
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Body — keyed by agency id so per-tab form state resets when the
                selected agency changes (useState initializers only run on mount). */}
            <div className="flex-1 overflow-y-auto p-5">
              {tab === "Status" && (
                <StatusTab
                  key={agency.id}
                  data={current!}
                  pending={pending}
                  run={run}
                  onExtend={() => run(() => extendTrial14(agency.id), "Trial extended 14 days.")}
                  onDeleted={() => {
                    onClose();
                    onChange?.();
                  }}
                />
              )}
              {tab === "GHL Config" && (
                <GhlTab key={agency.id} data={current!} pending={pending} run={run} toast={toast} />
              )}
              {tab === "Tools" && (
                <ToolsTab
                  key={agency.id}
                  agencyId={agency.id}
                  configured={current!.ghl.configured}
                  driveEnabled={Boolean(current!.agency.google_drive_enabled)}
                  driveEmail={current!.agency.google_drive_email}
                  driveFolderId={current!.agency.google_drive_root_folder_id}
                  creditMonitoringService={current!.agency.credit_monitoring_service}
                  creditMonitoringConfigured={
                    current!.agency.credit_monitoring_service !== "none" &&
                    Boolean(current!.agency.credit_monitoring_api_key)
                  }
                  creditMonitoringPullsThisMonth={current!.creditMonitoring.pullsThisMonth}
                />
              )}
              {tab === "Branding" && <BrandingTab key={agency.id} data={current!} pending={pending} run={run} />}
              {tab === "Payments" && <PaymentsTab key={agency.id} data={current!} pending={pending} run={run} />}
            </div>
          </>
        )}
      </aside>
    </>
  );
}

// ── Status ───────────────────────────────────────────────────────────────────

function StatusTab({
  data,
  pending,
  run,
  onExtend,
  onDeleted,
}: {
  data: AgencyPanelData;
  pending: boolean;
  run: (fn: () => Promise<{ success: boolean; error?: string }>, ok: string) => void;
  onExtend: () => void;
  onDeleted: () => void;
}) {
  const a = data.agency;
  const { toast } = useToast();
  const [plan, setPlan] = useState<Plan>(a.plan);
  const [status, setStatus] = useState<PlanStatus>(a.plan_status);
  const [maxClients, setMaxClients] = useState(String(a.max_clients));
  const [trialEnd, setTrialEnd] = useState(a.trial_ends_at ? a.trial_ends_at.slice(0, 10) : "");
  const [notes, setNotes] = useState(a.settings?.admin_notes ?? "");
  const [confirmName, setConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const res = await deleteAgencyAdmin(a.id, confirmName);
    setDeleting(false);
    if (res.success) {
      toast("Agency deleted.", "success");
      onDeleted();
    } else {
      toast(res.error ?? "Something went wrong.", "error");
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Plan</label>
          <select value={plan} onChange={(e) => setPlan(e.target.value as Plan)} className={field}>
            {PLANS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as PlanStatus)} className={cn(field, "capitalize")}>
            {STATUSES.map((s) => (
              <option key={s} value={s} className="capitalize">
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Max clients override</label>
          <input type="number" min={0} value={maxClients} onChange={(e) => setMaxClients(e.target.value)} className={field} />
        </div>
        <div>
          <label className={label}>Trial end date</label>
          <input type="date" value={trialEnd} onChange={(e) => setTrialEnd(e.target.value)} className={field} />
        </div>
      </div>

      <div>
        <label className={label}>Admin notes</label>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Internal notes about this agency…"
          className={cn(field, "resize-none")}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button disabled={pending} onClick={onExtend} className={secondaryBtn}>
          Extend trial +14 days
        </button>
        <button
          disabled={pending}
          onClick={() =>
            run(
              () =>
                saveAgencyStatus(a.id, {
                  plan,
                  status,
                  maxClients: Number(maxClients),
                  trialEnd,
                  adminNotes: notes,
                }),
              "Changes saved."
            )
          }
          className={primaryBtn}
        >
          Save Changes
        </button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Signup info</h4>
        <dl className="mt-2 space-y-1.5 text-sm">
          <Row k="Agency" v={a.name} />
          <Row k="Owner" v={a.owner_email} />
          <Row k="Signed up" v={formatDate(a.created_at)} />
          <Row k="Clients" v={String(data.clientCount)} />
          <Row k="License key" v={a.license_key} />
        </dl>
      </div>

      <div className="rounded-lg border border-red-200 bg-red-50/50 p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-red-700">
          Danger Zone
        </h4>
        <p className="mt-1 text-sm text-red-600">
          Permanently delete this agency and all of its clients, rounds, letters, and
          documents. Type <span className="font-semibold">{a.name}</span> to confirm.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder="Type agency name…"
            className={cn(field, "max-w-[220px] border-red-300")}
          />
          <button
            disabled={deleting || confirmName.trim() !== a.name}
            onClick={handleDelete}
            className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete Agency"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gray-500">{k}</dt>
      <dd className="truncate font-medium text-gray-900">{v}</dd>
    </div>
  );
}

// ── GHL Config ───────────────────────────────────────────────────────────────

function GhlTab({
  data,
  pending,
  run,
  toast,
}: {
  data: AgencyPanelData;
  pending: boolean;
  run: (fn: () => Promise<{ success: boolean; error?: string }>, ok: string) => void;
  toast: (m: string, v?: "success" | "error") => void;
}) {
  const a = data.agency;
  const [locationId, setLocationId] = useState(a.ghl_location_id ?? "");
  const [apiKey, setApiKey] = useState(a.ghl_api_key ?? "");
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const url = webhookUrl();

  async function test() {
    setTesting(true);
    const res = await testConnection(a.id);
    toast(res.message, res.ok ? "success" : "error");
    setTesting(false);
  }

  return (
    <div className="space-y-4">
      <div>
        <label className={label}>GHL Location ID</label>
        <input value={locationId} onChange={(e) => setLocationId(e.target.value)} className={field} placeholder="e.g. abc123XYZ" />
      </div>
      <div>
        <label className={label}>GHL API Key (PIT)</label>
        <div className="flex gap-2">
          <input
            type={showKey ? "text" : "password"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className={field}
            placeholder="pit-…"
          />
          <button type="button" onClick={() => setShowKey((s) => !s)} className={secondaryBtn}>
            {showKey ? "Hide" : "Show"}
          </button>
        </div>
      </div>
      <div>
        <label className={label}>Webhook URL</label>
        <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
          <code className="flex-1 truncate text-xs text-gray-700">{url}</code>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(url);
              toast("Webhook URL copied.", "success");
            }}
            className="text-gray-400 hover:text-gray-700"
            aria-label="Copy webhook URL"
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className={cn("h-2 w-2 rounded-full", data.ghl.configured ? "bg-green-500" : "bg-gray-300")} />
        <span className="text-gray-600">
          {data.ghl.configured ? "Connected" : "Not configured"}
        </span>
        {data.ghl.lastSyncAt && (
          <span className="text-gray-400">· last sync {formatDate(data.ghl.lastSyncAt)}</span>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Notification Status
        </h4>
        <dl className="mt-2 space-y-1 text-sm">
          {WIRED_NOTIFICATION_TYPES.map((type) => {
            const configured = Boolean(a.settings?.ghl_webhook_triggers?.[type]);
            return (
              <div key={type} className="flex items-center justify-between gap-2">
                <dt className="text-gray-600">{type}</dt>
                <dd className="flex items-center gap-1.5">
                  <span className={cn("h-1.5 w-1.5 rounded-full", configured ? "bg-green-500" : "bg-gray-300")} />
                  <span className={configured ? "text-green-700" : "text-gray-400"}>
                    {configured ? "Configured" : "Not set"}
                  </span>
                </dd>
              </div>
            );
          })}
        </dl>
        <p className="mt-3 text-xs text-gray-500">
          {WIRED_NOTIFICATION_TYPES.filter((t) => a.settings?.ghl_webhook_triggers?.[t]).length} of{" "}
          {WIRED_NOTIFICATION_TYPES.length} configured
        </p>
      </div>

      <div className="flex gap-2">
        <button disabled={testing} onClick={test} className={secondaryBtn}>
          {testing ? "Testing…" : "Test Connection"}
        </button>
        <button
          disabled={pending}
          onClick={() => run(() => saveGhlConfig(a.id, { locationId, apiKey }), "GHL config saved.")}
          className={primaryBtn}
        >
          Save
        </button>
      </div>
    </div>
  );
}

// ── Tools ────────────────────────────────────────────────────────────────────

function ToolsTab({
  agencyId,
  configured,
  driveEnabled,
  driveEmail,
  driveFolderId,
  creditMonitoringService,
  creditMonitoringConfigured,
  creditMonitoringPullsThisMonth,
}: {
  agencyId: string;
  configured: boolean;
  driveEnabled: boolean;
  driveEmail: string | null;
  driveFolderId: string | null;
  creditMonitoringService: string;
  creditMonitoringConfigured: boolean;
  creditMonitoringPullsThisMonth: number;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});

  async function runTool(key: string, path: string) {
    setBusy(key);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agencyId }),
      });
      const json = await res.json();
      const msg = json.message || json.error || (json.ok ? "Done." : "Failed.");
      setResults((r) => ({ ...r, [key]: msg }));
      toast(msg, json.ok ? "success" : "error");
    } catch {
      toast("Request failed.", "error");
      setResults((r) => ({ ...r, [key]: "Request failed." }));
    } finally {
      setBusy(null);
    }
  }

  const tools = [
    {
      key: "fields",
      icon: Wrench,
      title: "Setup GHL Custom Fields",
      desc: "Creates all 16 custom fields in their GHL location.",
      path: "/api/admin/tools/setup-ghl-fields",
    },
    {
      key: "pipelines",
      icon: Database,
      title: "Setup GHL Pipelines",
      desc: "Creates Credit Sales + Active Client pipelines with all stages.",
      path: "/api/admin/tools/setup-ghl-pipelines",
    },
    {
      key: "sync",
      icon: RefreshCw,
      title: "Sync All Clients to GHL",
      desc: "Pushes all ClientDeck clients to GHL as contacts.",
      path: "/api/admin/tools/sync-clients",
    },
    {
      key: "welcome",
      icon: Mail,
      title: "Resend Welcome Email",
      desc: "Sends the onboarding instructions email to the agency owner.",
      path: "/api/admin/tools/resend-welcome",
      alwaysEnabled: true,
    },
  ];

  return (
    <div className="space-y-3">
      {/* Google Drive status (display only) */}
      <div className="rounded-lg border border-gray-200 p-4">
        <h4 className="text-sm font-semibold text-gray-900">Google Drive</h4>
        <div className="mt-2 flex items-center gap-2 text-sm">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              driveEnabled ? "bg-green-500" : "bg-gray-300"
            )}
          />
          <span className="text-gray-600">
            {driveEnabled
              ? `Connected${driveEmail ? ` (${driveEmail})` : ""}`
              : "Not connected"}
          </span>
        </div>
        {driveEnabled && driveFolderId && (
          <a
            href={`https://drive.google.com/drive/folders/${driveFolderId}`}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            View their Drive folder ↗
          </a>
        )}
      </div>

      {/* Credit Monitoring status (display only + test button) */}
      <div className="rounded-lg border border-gray-200 p-4">
        <h4 className="text-sm font-semibold text-gray-900">Credit Monitoring</h4>
        <div className="mt-2 flex items-center gap-2 text-sm">
          <span className={cn("h-2 w-2 rounded-full", creditMonitoringConfigured ? "bg-green-500" : "bg-gray-300")} />
          <span className="text-gray-600">
            {creditMonitoringConfigured ? `Connected (${creditMonitoringService})` : "Not connected"}
          </span>
        </div>
        {creditMonitoringConfigured && (
          <p className="mt-1 text-xs text-gray-500">{creditMonitoringPullsThisMonth} pulls this month</p>
        )}
        {creditMonitoringConfigured && (
          <button
            disabled={busy !== null}
            onClick={() => runTool("credit-monitoring", "/api/admin/tools/test-credit-monitoring")}
            className={cn(
              "mt-2 flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium",
              busy !== null ? "cursor-not-allowed bg-gray-100 text-gray-400" : "bg-blue-50 text-blue-700 hover:bg-blue-100"
            )}
          >
            {busy === "credit-monitoring" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Test API Connection
          </button>
        )}
        {results["credit-monitoring"] && <p className="mt-1 text-xs font-medium text-gray-700">{results["credit-monitoring"]}</p>}
      </div>

      <p className="text-sm text-gray-500">
        These tools configure the agency&apos;s GHL account. Most require the GHL API
        key to be set on the GHL Config tab.
      </p>
      {!configured && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
          GHL is not configured for this agency — connect it first to use the setup tools.
        </div>
      )}
      {tools.map((t) => {
        const Icon = t.icon;
        const disabled = busy !== null || (!t.alwaysEnabled && !configured);
        return (
          <div key={t.key} className="rounded-lg border border-gray-200 p-4">
            <button
              disabled={disabled}
              onClick={() => runTool(t.key, t.path)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
                disabled
                  ? "cursor-not-allowed bg-gray-100 text-gray-400"
                  : "bg-blue-50 text-blue-700 hover:bg-blue-100"
              )}
            >
              {busy === t.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
              {t.title}
            </button>
            <p className="mt-2 text-xs text-gray-500">{t.desc}</p>
            {results[t.key] && <p className="mt-1 text-xs font-medium text-gray-700">{results[t.key]}</p>}
          </div>
        );
      })}
    </div>
  );
}

// ── Branding ─────────────────────────────────────────────────────────────────

function BrandingTab({
  data,
  pending,
  run,
}: {
  data: AgencyPanelData;
  pending: boolean;
  run: (fn: () => Promise<{ success: boolean; error?: string }>, ok: string) => void;
}) {
  const a = data.agency;
  const [logoUrl, setLogoUrl] = useState(a.logo_url ?? "");
  const [brandColor, setBrandColor] = useState(a.brand_color || "#2563EB");
  const [poweredBy, setPoweredBy] = useState(a.settings?.portal_branding_visible ?? true);

  return (
    <div className="space-y-4">
      <div>
        <label className={label}>Logo URL</label>
        <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} className={field} placeholder="https://…/logo.png" />
      </div>
      <div>
        <label className={label}>Brand color</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={/^#([0-9a-fA-F]{6})$/.test(brandColor) ? brandColor : "#2563EB"}
            onChange={(e) => setBrandColor(e.target.value)}
            className="h-9 w-12 cursor-pointer rounded border border-gray-300"
          />
          <input value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className={cn(field, "max-w-[140px]")} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={poweredBy} onChange={(e) => setPoweredBy(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
        Show &quot;Powered by ClientDeck Pro&quot; in portal
      </label>

      <div className="flex gap-2">
        <a
          href={`/portal?preview=${a.id}`}
          target="_blank"
          rel="noreferrer"
          className={secondaryBtn}
        >
          Preview Portal →
        </a>
        <button
          disabled={pending}
          onClick={() =>
            run(
              () => saveBranding(a.id, { logoUrl, brandColor, poweredByVisible: poweredBy }),
              "Branding saved."
            )
          }
          className={primaryBtn}
        >
          Save Branding
        </button>
      </div>
    </div>
  );
}

// ── Payments ─────────────────────────────────────────────────────────────────

const METHODS = ["Bank Transfer", "Card (manual)", "Cash", "Check", "Other"];

function PaymentsTab({
  data,
  pending,
  run,
}: {
  data: AgencyPanelData;
  pending: boolean;
  run: (fn: () => Promise<{ success: boolean; error?: string }>, ok: string) => void;
}) {
  const a = data.agency;
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(METHODS[0]);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Current plan</span>
          <span className="font-medium capitalize text-gray-900">{a.plan}</span>
        </div>
        <div className="mt-1 flex justify-between">
          <span className="text-gray-500">Status</span>
          <span className="font-medium capitalize text-gray-900">{a.plan_status.replace("_", " ")}</span>
        </div>
        <div className="mt-1 flex justify-between">
          <span className="text-gray-500">Max clients</span>
          <span className="font-medium text-gray-900">{a.max_clients}</span>
        </div>
      </div>

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Payment history</h4>
        {data.payments.length === 0 ? (
          <p className="mt-2 text-sm text-gray-400">No manual payments recorded.</p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-100">
            {data.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <div className="min-w-0">
                  <span className="text-gray-500">{formatDate(p.created_at)}</span>{" "}
                  <span className="text-gray-700">{p.payment_method}</span>
                  {p.notes && <span className="text-gray-400"> · {p.notes}</span>}
                </div>
                <span className="shrink-0 font-medium text-gray-900">{formatCurrency(p.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 p-4">
        <h4 className="text-sm font-semibold text-gray-900">Record manual payment</h4>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Amount</label>
            <input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={field} placeholder="129.00" />
          </div>
          <div>
            <label className={label}>Method</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className={field}>
              {METHODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className={label}>Reference (optional)</label>
            <input value={reference} onChange={(e) => setReference(e.target.value)} className={field} />
          </div>
          <div className="col-span-2">
            <label className={label}>Notes (optional)</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className={field} />
          </div>
        </div>
        <button
          disabled={pending}
          onClick={() =>
            run(
              () =>
                recordAgencyPayment(a.id, {
                  amount: Number(amount),
                  method,
                  reference,
                  notes,
                }),
              "Payment recorded — status set to active."
            )
          }
          className={cn(primaryBtn, "mt-3 w-full")}
        >
          Record Payment → Mark Active
        </button>
      </div>
    </div>
  );
}
