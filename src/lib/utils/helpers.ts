import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

export function getInitials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

export function calculateDeadline(sentDate: string, days: number = 35): Date {
  const date = new Date(sentDate);
  date.setDate(date.getDate() + days);
  return date;
}

export function daysRemaining(deadline: string | Date): number {
  const now = new Date();
  const end = new Date(deadline);
  const diff = end.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function scoreChange(start: number | null, current: number | null): {
  value: number;
  direction: "up" | "down" | "same";
} {
  if (!start || !current) return { value: 0, direction: "same" };
  const diff = current - start;
  return {
    value: Math.abs(diff),
    direction: diff > 0 ? "up" : diff < 0 ? "down" : "same",
  };
}

export function getStatusColor(status: string): string {
  // Dark-theme status pills: translucent tint + colored border + bright text.
  // Badge derives its dot color from the `text-*` token in each string.
  const colors: Record<string, string> = {
    // Client status
    onboarding: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
    analysis: "bg-purple-500/15 text-purple-400 border border-purple-500/30",
    trialing: "bg-purple-500/15 text-purple-400 border border-purple-500/30",
    active: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    on_hold: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
    completed: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    cancelled: "bg-red-500/15 text-red-400 border border-red-500/30",
    // Dispute status
    not_disputed: "bg-white/5 text-slate-400 border border-white/10",
    in_dispute: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
    deleted: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    updated: "bg-teal-500/15 text-teal-400 border border-teal-500/30",
    verified: "bg-red-500/15 text-red-400 border border-red-500/30",
    pending: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
    // Payment status
    failed: "bg-red-500/15 text-red-400 border border-red-500/30",
    paused: "bg-orange-500/15 text-orange-400 border border-orange-500/30",
    // Round status
    preparing: "bg-white/5 text-slate-400 border border-white/10",
    letters_generated: "bg-indigo-500/15 text-indigo-400 border border-indigo-500/30",
    sent: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
    awaiting_response: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
    complete: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    // Results
    no_response: "bg-orange-500/15 text-orange-400 border border-orange-500/30",
    in_progress: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
  };
  return colors[status] || "bg-white/5 text-slate-400 border border-white/10";
}

export function getLetterTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    initial_dispute: "Initial Dispute",
    method_of_verification: "Method of Verification",
    escalation: "Escalation",
    goodwill: "Goodwill Letter",
    debt_validation: "Debt Validation",
    cfpb_complaint: "CFPB Complaint",
    identity_theft: "Identity Theft",
    custom: "Custom",
  };
  return labels[type] || type;
}

export function getNegativeTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    late_payment: "Late Payment",
    collection: "Collection",
    charge_off: "Charge-Off",
    repossession: "Repossession",
    bankruptcy: "Bankruptcy",
    foreclosure: "Foreclosure",
    tax_lien: "Tax Lien",
    judgment: "Judgment",
    inquiry: "Hard Inquiry",
    identity_theft: "Identity Theft",
    personal_info_error: "Personal Info Error",
    duplicate_account: "Duplicate Account",
    other: "Other",
  };
  return labels[type] || type;
}

export function getBureauLabel(bureau: string): string {
  const labels: Record<string, string> = {
    equifax: "Equifax",
    experian: "Experian",
    transunion: "TransUnion",
  };
  return labels[bureau] || bureau;
}

export function suggestLetterType(roundNumber: number, previousResult?: string): string {
  if (roundNumber === 1) return "initial_dispute";
  if (roundNumber === 2) {
    if (previousResult === "verified") return "method_of_verification";
    return "initial_dispute"; // re-dispute with different angle
  }
  if (roundNumber >= 3) return "escalation";
  return "initial_dispute";
}
