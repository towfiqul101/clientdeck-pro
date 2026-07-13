/**
 * Shared-secret auth for the inbound GHL webhooks (/api/ghl/webhook and
 * /api/ghl/onboarding).
 *
 * FAILS CLOSED. The previous implementation was `if (secret) { ...check... }`,
 * so when GHL_WEBHOOK_SECRET was not configured on the server, the check was
 * skipped entirely and every caller was accepted. That is exactly backwards: a
 * missing server-side secret is a misconfiguration, and a misconfiguration must
 * never mean "authenticate nobody, accept everyone".
 *
 * It mattered in practice — production had no GHL_WEBHOOK_SECRET set, so both
 * webhooks accepted unauthenticated POSTs. The only thing gating writes was the
 * `locationId`, which is not a secret (it sits in the GHL dashboard URL), and
 * with it an attacker could create clients, overwrite a client's email/phone,
 * or flip a client to payment-failed / on-hold.
 */
export type GhlWebhookAuth =
  | { ok: true }
  | { ok: false; reason: "not_configured" | "invalid_secret" };

export function verifyGhlWebhookSecret(req: Request): GhlWebhookAuth {
  const secret = process.env.GHL_WEBHOOK_SECRET;

  // Fail closed: no server-side secret => nothing can be authenticated.
  if (!secret) return { ok: false, reason: "not_configured" };

  const provided =
    req.headers.get("x-clientdeck-secret") ||
    req.headers.get("x-wh-secret") ||
    new URL(req.url).searchParams.get("secret");

  if (!provided || !timingSafeEqual(provided, secret)) {
    return { ok: false, reason: "invalid_secret" };
  }

  return { ok: true };
}

/**
 * Constant-time comparison so the response time doesn't leak how many leading
 * characters of the secret were correct. Length is compared first (that much is
 * unavoidable), then every byte is mixed in regardless of early mismatches.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
