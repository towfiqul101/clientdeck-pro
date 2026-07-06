const FROM = "ClientDeck Pro <noreply@clientdeckpro.com>";

/**
 * Sends a transactional email via Resend's REST API directly (no SDK
 * dependency, matching the pattern already used in
 * src/lib/admin/welcome-email.ts and src/lib/ghl/notifications.ts).
 * Never throws — logs and returns false on failure so callers can treat
 * every send as best-effort.
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[Email DEV] ${params.subject} → ${params.to}`);
    return true;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error(`[Email] Resend error ${res.status}: ${detail.slice(0, 200)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Email] Send failed:", err);
    return false;
  }
}
