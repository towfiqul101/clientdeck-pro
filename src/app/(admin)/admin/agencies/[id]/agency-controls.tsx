"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import type { Agency, Plan, PlanStatus } from "@/types";
import {
  updateAgencyPlan,
  updateMaxClients,
  updateTrialEnd,
  extendTrial,
  resetToTrial,
  deleteAgency,
} from "./actions";

const PLANS: Plan[] = ["solo", "pro", "agency", "enterprise"];
const STATUSES: PlanStatus[] = [
  "trialing",
  "active",
  "past_due",
  "cancelled",
  "paused",
];

const btn =
  "rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50";
const primary = `${btn} bg-blue-600 text-white hover:bg-blue-700`;
const secondary = `${btn} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50`;
const field =
  "rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

export function AgencyControls({ agency }: { agency: Agency }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();

  const [plan, setPlan] = useState<Plan>(agency.plan);
  const [status, setStatus] = useState<PlanStatus>(agency.plan_status);
  const [maxClients, setMaxClientsVal] = useState(String(agency.max_clients));
  const [trialEnd, setTrialEnd] = useState(
    agency.trial_ends_at ? agency.trial_ends_at.slice(0, 10) : ""
  );
  const [confirmName, setConfirmName] = useState("");

  function run(fn: () => Promise<{ success: boolean; error?: string }>, ok: string) {
    start(async () => {
      const res = await fn();
      if (res.success) {
        toast(ok, "success");
        router.refresh();
      } else {
        toast(res.error ?? "Something went wrong.", "error");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Plan & status */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">Plan & status</h3>
        <p className="mt-0.5 text-sm text-gray-500">
          Manual override — use for bank-transfer or comped accounts.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
            Plan
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value as Plan)}
              className={`${field} capitalize`}
            >
              {PLANS.map((p) => (
                <option key={p} value={p} className="capitalize">
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
            Status
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as PlanStatus)}
              className={`${field} capitalize`}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s} className="capitalize">
                  {s.replace("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={pending}
            onClick={() => run(() => updateAgencyPlan(agency.id, plan, status), "Plan updated.")}
            className={primary}
          >
            Update Plan
          </button>
        </div>
      </div>

      {/* Limits & trial */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">Limits & trial</h3>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
            Max clients
            <input
              type="number"
              min={0}
              value={maxClients}
              onChange={(e) => setMaxClientsVal(e.target.value)}
              className={`${field} w-28`}
            />
          </label>
          <button
            disabled={pending}
            onClick={() =>
              run(() => updateMaxClients(agency.id, Number(maxClients)), "Client limit updated.")
            }
            className={secondary}
          >
            Save limit
          </button>

          <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
            Trial ends
            <input
              type="date"
              value={trialEnd}
              onChange={(e) => setTrialEnd(e.target.value)}
              className={field}
            />
          </label>
          <button
            disabled={pending}
            onClick={() =>
              run(() => updateTrialEnd(agency.id, trialEnd), "Trial end updated.")
            }
            className={secondary}
          >
            Save date
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            disabled={pending}
            onClick={() => run(() => extendTrial(agency.id), "Trial extended 14 days.")}
            className={secondary}
          >
            + Extend trial 14 days
          </button>
          <button
            disabled={pending}
            onClick={() => run(() => resetToTrial(agency.id), "Reset to trial.")}
            className={secondary}
          >
            Reset to trial
          </button>
        </div>
      </div>

      {/* Danger zone */}
      <div className="rounded-lg border border-red-200 bg-red-50/50 p-5">
        <h3 className="text-sm font-semibold text-red-700">Danger zone</h3>
        <p className="mt-0.5 text-sm text-red-600">
          Permanently delete this agency and all of its clients, rounds, letters,
          and documents. Type <span className="font-semibold">{agency.name}</span>{" "}
          to confirm.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder="Type agency name…"
            className={`${field} w-64 border-red-300`}
          />
          <button
            disabled={pending || confirmName.trim() !== agency.name}
            onClick={() => run(() => deleteAgency(agency.id, confirmName), "Agency deleted.")}
            className={`${btn} bg-red-600 text-white hover:bg-red-700`}
          >
            Delete Agency
          </button>
        </div>
      </div>
    </div>
  );
}
