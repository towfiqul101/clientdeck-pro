/**
 * Allowlist for Web Push subscription endpoints.
 *
 * web-push sends the notification to whatever URL the subscription names —
 * it validates only that `endpoint` is a non-empty string, with no host or
 * scheme restriction. Since portal clients submit their own subscription
 * (POST /api/portal/push/subscribe), an unvalidated endpoint turns that route
 * into a blind SSRF primitive: a subscriber could point it at an internal
 * address and have the server POST to it whenever a notification fires.
 *
 * Only the real browser push services can legitimately appear here.
 */
const ALLOWED_HOSTS = [
  // Chrome / Edge / Chromium (FCM)
  "fcm.googleapis.com",
  "android.googleapis.com",
  // Firefox (Mozilla autopush)
  "updates.push.services.mozilla.com",
  // Safari / iOS + macOS
  "web.push.apple.com",
];

/** Legacy/regional Microsoft WNS hosts are per-region subdomains. */
const ALLOWED_HOST_SUFFIXES = [
  ".notify.windows.com",
  ".push.services.mozilla.com",
  ".googleapis.com",
  ".push.apple.com",
];

/**
 * True when `endpoint` is an https URL on a known push service. Anything else
 * — http, a raw IP, a link-local/metadata address, an attacker-chosen host —
 * is rejected.
 */
export function isAllowedPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }

  if (url.protocol !== "https:") return false;

  const host = url.hostname.toLowerCase();
  if (ALLOWED_HOSTS.includes(host)) return true;
  return ALLOWED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}
