/**
 * Helpers for keeping stored secrets (GHL API keys, credit-monitoring
 * credentials) out of client-visible payloads. Server Components send the
 * masked form to pre-fill inputs; save actions treat a masked value as
 * "keep the existing secret".
 */

/** Masks a stored secret for display: bullets + last 4 characters. */
export function maskSecret(value: string | null | undefined): string {
  if (!value) return "";
  return `••••••••${value.slice(-4)}`;
}

/** True when the value is a masked placeholder we sent to the browser, not a newly typed secret. */
export function isMaskedSecret(value: string | null | undefined): boolean {
  return Boolean(value && value.includes("••••"));
}
