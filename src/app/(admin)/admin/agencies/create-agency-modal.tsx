"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils/helpers";
import { maxClientsForPlan } from "@/lib/billing/plans";
import { adminCreateAgency } from "./create-agency-actions";
import type { Plan, PlanStatus } from "@/types";

const PLANS: { id: Plan; label: string }[] = [
  { id: "solo", label: "Starter" },
  { id: "pro", label: "Pro" },
  { id: "agency", label: "Agency" },
  { id: "enterprise", label: "Enterprise" },
];
const STATUSES: PlanStatus[] = ["active", "trialing", "past_due", "paused", "cancelled"];

const field =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const label = "block text-xs font-medium text-gray-600 mb-1";

export function CreateAgencyButton({ onCreated }: { onCreated?: (agencyId: string) => void }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const [pending, start] = useTransition();

  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [plan, setPlan] = useState<Plan>("solo");
  const [status, setStatus] = useState<PlanStatus>("trialing");
  const [maxClients, setMaxClients] = useState(String(maxClientsForPlan("solo")));
  const [trialEnd, setTrialEnd] = useState("");
  const [ghlLocationId, setGhlLocationId] = useState("");
  const [ghlApiKey, setGhlApiKey] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showApiKey, setShowApiKey] = useState(false);

  function reset() {
    setName("");
    setOwnerName("");
    setOwnerEmail("");
    setPhone("");
    setPlan("solo");
    setStatus("trialing");
    setMaxClients(String(maxClientsForPlan("solo")));
    setTrialEnd("");
    setGhlLocationId("");
    setGhlApiKey("");
    setAdminNotes("");
    setSendWelcomeEmail(true);
    setFieldErrors({});
    setShowApiKey(false);
  }

  function submit() {
    start(async () => {
      const res = await adminCreateAgency({
        name,
        ownerName,
        ownerEmail,
        phone: phone || undefined,
        plan,
        status,
        maxClients: maxClients.trim() === "" ? undefined : Number(maxClients),
        trialEndDate: trialEnd || undefined,
        ghlLocationId: ghlLocationId || undefined,
        ghlApiKey: ghlApiKey || undefined,
        adminNotes: adminNotes || undefined,
        sendWelcomeEmail,
      });
      if (res.success) {
        toast(`${name} created.`, "success");
        setOpen(false);
        reset();
        onCreated?.(res.agencyId);
      } else {
        setFieldErrors(res.fieldErrors ?? {});
        toast(res.error, "error");
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
      >
        <Plus className="h-4 w-4" />
        Create Agency
      </button>

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          reset();
        }}
        title="Create New Agency"
        description="Admin-created agencies bypass Stripe checkout — set plan and status directly."
        size="lg"
        footer={
          <>
            <button
              onClick={() => {
                setOpen(false);
                reset();
              }}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              disabled={pending}
              onClick={submit}
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {pending ? "Creating…" : "Create Agency"}
            </button>
          </>
        }
      >
        <div className="space-y-5">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Agency Information
            </h4>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={label}>Agency Name *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className={field} />
                {fieldErrors.name && <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>}
              </div>
              <div>
                <label className={label}>Owner Full Name *</label>
                <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} className={field} />
                {fieldErrors.ownerName && <p className="mt-1 text-xs text-red-600">{fieldErrors.ownerName}</p>}
              </div>
              <div>
                <label className={label}>Owner Email *</label>
                <input
                  type="email"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  className={field}
                />
                {fieldErrors.ownerEmail && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.ownerEmail}</p>
                )}
              </div>
              <div className="col-span-2">
                <label className={label}>Phone</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className={field} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Plan *</label>
              <select
                value={plan}
                onChange={(e) => {
                  const next = e.target.value as Plan;
                  setPlan(next);
                  setMaxClients(String(maxClientsForPlan(next)));
                }}
                className={field}
              >
                {PLANS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Status *</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as PlanStatus)} className={cn(field, "capitalize")}>
                {STATUSES.map((s) => (
                  <option key={s} value={s} className="capitalize">
                    {s.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Max Clients</label>
              <input
                type="number"
                min={0}
                value={maxClients}
                onChange={(e) => setMaxClients(e.target.value)}
                className={field}
              />
            </div>
            <div>
              <label className={label}>Trial End Date</label>
              <input type="date" value={trialEnd} onChange={(e) => setTrialEnd(e.target.value)} className={field} />
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              GHL Configuration (optional — can set later)
            </h4>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <label className={label}>GHL Location ID</label>
                <input value={ghlLocationId} onChange={(e) => setGhlLocationId(e.target.value)} className={field} />
              </div>
              <div>
                <label className={label}>GHL API Key (PIT)</label>
                <div className="flex gap-2">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={ghlApiKey}
                    onChange={(e) => setGhlApiKey(e.target.value)}
                    className={field}
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey((s) => !s)}
                    className="shrink-0 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    {showApiKey ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className={label}>Admin Notes</label>
            <textarea
              rows={2}
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              className={cn(field, "resize-none")}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={sendWelcomeEmail}
              onChange={(e) => setSendWelcomeEmail(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Send welcome email to owner
          </label>
        </div>
      </Modal>
    </>
  );
}
