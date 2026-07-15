/**
 * Safely coerces an arbitrary provider-response value into a bureau score.
 * Same guard as toInt() in the onboarding webhook (Number.isFinite), applied
 * here because `Number(x) || null` lets Infinity/-Infinity through as a
 * "valid" score — a malformed or adversarial provider response could send a
 * numeric-looking string like "Infinity", which Number() happily converts
 * and `|| null` doesn't catch (Infinity is truthy). That value would then
 * likely throw an unhandled Postgres error deep in a later insert into an
 * INTEGER column, rather than being normalized to null up front.
 */
export function parseScore(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
