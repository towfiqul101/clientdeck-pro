import { createHmac, timingSafeEqual, randomBytes } from "crypto";

/**
 * Minimal RFC 6238 TOTP (SHA-1, 30s step, 6 digits) for the /admin panel's
 * second factor — deliberately dependency-free (Node crypto only). The
 * secret lives in ADMIN_TOTP_SECRET (base32, the format authenticator apps
 * take for manual entry). This is fully separate from Supabase Auth's MFA:
 * the admin session is password+cookie with no Supabase user to hang a
 * factor on.
 *
 * Generate a secret with:
 *   node -e "console.log(require('./src/lib/admin/totp').generateTotpSecret())"
 * (or any base32 secret ≥16 chars from a password manager's TOTP setup).
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[=\s-]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) throw new Error("Invalid base32 character in TOTP secret");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function hotp(key: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];
  return String(bin % 1_000_000).padStart(6, "0");
}

/**
 * Verifies a 6-digit code against a base32 secret, accepting the current
 * 30-second step ±1 (clock skew). Constant-time digit comparison.
 */
export function verifyTotp(secret: string, code: string, window = 1): boolean {
  const trimmed = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(trimmed)) return false;

  let key: Buffer;
  try {
    key = base32Decode(secret);
  } catch {
    return false; // malformed secret can never verify
  }
  if (key.length === 0) return false;

  const step = Math.floor(Date.now() / 1000 / 30);
  const provided = Buffer.from(trimmed);
  let ok = false;
  for (let w = -window; w <= window; w++) {
    const expected = Buffer.from(hotp(key, step + w));
    // No early exit: check every window with a constant-time comparison.
    if (expected.length === provided.length && timingSafeEqual(expected, provided)) {
      ok = true;
    }
  }
  return ok;
}

/** 20 random bytes as base32 — paste into ADMIN_TOTP_SECRET and an authenticator app. */
export function generateTotpSecret(): string {
  const bytes = randomBytes(20);
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}
