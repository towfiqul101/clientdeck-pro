/**
 * Authorizes a cron request. Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`
 * when the CRON_SECRET env var is set; we also accept `?secret=` for manual testing.
 * Fails closed: if CRON_SECRET is not configured, no request is authorized.
 */
export function isAuthorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;

  const url = new URL(req.url);
  return url.searchParams.get("secret") === secret;
}
