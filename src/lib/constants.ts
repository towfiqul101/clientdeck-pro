import type {
  AccountType,
  Bureau,
  ClientStatus,
  CreditGoal,
  DisputeStatus,
  LetterType,
  NegativeType,
  PaymentStatus,
} from "@/types";

export const US_STATES: { value: string; label: string }[] = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"],
  ["CA", "California"], ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"],
  ["DC", "District of Columbia"], ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"],
  ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"],
  ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"],
  ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"],
  ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"],
  ["NV", "Nevada"], ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"],
  ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"],
  ["OK", "Oklahoma"], ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"],
  ["SC", "South Carolina"], ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"],
  ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"],
  ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
].map(([value, label]) => ({ value, label }));

export const CLIENT_STATUSES: { value: ClientStatus; label: string }[] = [
  { value: "onboarding", label: "Onboarding" },
  { value: "analysis", label: "Analysis" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export const PAYMENT_STATUSES: { value: PaymentStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "failed", label: "Failed" },
  { value: "paused", label: "Paused" },
  { value: "cancelled", label: "Cancelled" },
  { value: "pending", label: "Pending" },
];

export const CREDIT_GOALS: { value: CreditGoal; label: string }[] = [
  { value: "buy_home", label: "Buy a Home" },
  { value: "car_loan", label: "Car Loan" },
  { value: "lower_rates", label: "Lower Rates" },
  { value: "get_approved", label: "Get Approved" },
  { value: "improve_general", label: "Improve General" },
  { value: "business_loan", label: "Business Loan" },
  { value: "rental", label: "Rental" },
  { value: "other", label: "Other" },
];

export const BUREAUS: { value: Bureau; label: string }[] = [
  { value: "equifax", label: "Equifax" },
  { value: "experian", label: "Experian" },
  { value: "transunion", label: "TransUnion" },
];

export const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: "credit_card", label: "Credit Card" },
  { value: "auto_loan", label: "Auto Loan" },
  { value: "mortgage", label: "Mortgage" },
  { value: "personal_loan", label: "Personal Loan" },
  { value: "student_loan", label: "Student Loan" },
  { value: "medical", label: "Medical" },
  { value: "collection", label: "Collection" },
  { value: "utility", label: "Utility" },
  { value: "other", label: "Other" },
];

export const NEGATIVE_TYPES: { value: NegativeType; label: string }[] = [
  { value: "late_payment", label: "Late Payment" },
  { value: "collection", label: "Collection" },
  { value: "charge_off", label: "Charge-Off" },
  { value: "repossession", label: "Repossession" },
  { value: "bankruptcy", label: "Bankruptcy" },
  { value: "foreclosure", label: "Foreclosure" },
  { value: "tax_lien", label: "Tax Lien" },
  { value: "judgment", label: "Judgment" },
  { value: "inquiry", label: "Hard Inquiry" },
  { value: "identity_theft", label: "Identity Theft" },
  { value: "personal_info_error", label: "Personal Info Error" },
  { value: "duplicate_account", label: "Duplicate Account" },
  { value: "other", label: "Other" },
];

export const DISPUTE_STATUSES: { value: DisputeStatus; label: string }[] = [
  { value: "not_disputed", label: "Not Disputed" },
  { value: "in_dispute", label: "In Dispute" },
  { value: "deleted", label: "Deleted" },
  { value: "updated", label: "Updated" },
  { value: "verified", label: "Verified" },
  { value: "pending", label: "Pending" },
];

export const LETTER_TYPES: { value: LetterType; label: string }[] = [
  { value: "initial_dispute", label: "Initial Dispute" },
  { value: "method_of_verification", label: "Method of Verification" },
  { value: "escalation", label: "Escalation" },
  { value: "goodwill", label: "Goodwill Letter" },
  { value: "debt_validation", label: "Debt Validation" },
  { value: "cfpb_complaint", label: "CFPB Complaint" },
  { value: "identity_theft", label: "Identity Theft" },
  { value: "custom", label: "Custom" },
];

/** Official consumer-dispute mailing addresses for the three bureaus. */
export const BUREAU_ADDRESSES: Record<Bureau, string> = {
  equifax:
    "Equifax Information Services LLC\nP.O. Box 740256\nAtlanta, GA 30374-0256",
  experian: "Experian\nP.O. Box 4500\nAllen, TX 75013",
  transunion:
    "TransUnion LLC\nConsumer Dispute Center\nP.O. Box 2000\nChester, PA 19016",
};

/**
 * Goodwill and debt-validation letters are addressed to the creditor/collector
 * directly rather than the credit bureau.
 */
export function letterGoesToCreditor(letterType: LetterType): boolean {
  return letterType === "goodwill" || letterType === "debt_validation";
}

/** Whether a letter type should be mailed certified with return receipt. */
export function isCertifiedLetter(letterType: LetterType): boolean {
  // Everything except a warm goodwill request goes certified.
  return letterType !== "goodwill";
}

/** Per-bureau accent classes for the items table. */
export const BUREAU_STYLES: Record<
  Bureau,
  { dot: string; text: string; bg: string; border: string }
> = {
  equifax: {
    dot: "bg-violet-500",
    text: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/50",
  },
  experian: {
    dot: "bg-orange-500",
    text: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/50",
  },
  transunion: {
    dot: "bg-emerald-500",
    text: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/50",
  },
};
