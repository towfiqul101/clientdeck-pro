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
  const colors: Record<string, string> = {
    // Client status
    onboarding: "bg-blue-100 text-blue-800",
    analysis: "bg-purple-100 text-purple-800",
    active: "bg-green-100 text-green-800",
    on_hold: "bg-yellow-100 text-yellow-800",
    completed: "bg-emerald-100 text-emerald-800",
    cancelled: "bg-gray-100 text-gray-800",
    // Dispute status
    not_disputed: "bg-gray-100 text-gray-600",
    in_dispute: "bg-blue-100 text-blue-800",
    deleted: "bg-green-100 text-green-800",
    updated: "bg-teal-100 text-teal-800",
    verified: "bg-red-100 text-red-800",
    pending: "bg-yellow-100 text-yellow-800",
    // Payment status
    failed: "bg-red-100 text-red-800",
    paused: "bg-orange-100 text-orange-800",
    // Round status
    preparing: "bg-gray-100 text-gray-600",
    letters_generated: "bg-indigo-100 text-indigo-800",
    sent: "bg-blue-100 text-blue-800",
    awaiting_response: "bg-amber-100 text-amber-800",
    complete: "bg-green-100 text-green-800",
    // Results
    no_response: "bg-orange-100 text-orange-800",
    in_progress: "bg-blue-100 text-blue-800",
  };
  return colors[status] || "bg-gray-100 text-gray-600";
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
