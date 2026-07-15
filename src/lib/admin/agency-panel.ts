import type { Agency } from "@/types";

export interface AgencyPanelPayment {
  id: string;
  amount: number;
  payment_method: string;
  reference_number: string | null;
  notes: string | null;
  created_at: string;
}

/** Payload returned by GET /api/admin/agencies/[id] and consumed by the slide-over. */
export interface AgencyPanelData {
  agency: Agency;
  clientCount: number;
  payments: AgencyPanelPayment[];
  ghl: {
    configured: boolean;
    lastSyncAt: string | null;
  };
  creditMonitoring: {
    pullsThisMonth: number;
  };
  /** Same check enforced by checkClientLimit() elsewhere (dashboard
   *  createClient, Agency API POST) — reused here rather than recomputed, so
   *  the admin panel's overage flag can never drift from what's actually
   *  enforced. `current` counts onboarding/analysis/active/on_hold clients
   *  only, same as clientCount's exclusion of completed/cancelled doesn't —
   *  the two numbers can legitimately differ. */
  clientLimit: {
    allowed: boolean;
    current: number;
    max: number;
  };
}
