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
}
