// Generates a base32 TOTP secret for ADMIN_TOTP_SECRET (admin 2FA).
// Usage: node scripts/generate-admin-totp-secret.mjs
// Put the printed secret in the ADMIN_TOTP_SECRET env var (Vercel + .env.local)
// AND add it to your authenticator app via "manual entry" (time-based, 6 digits),
// or scan a QR you make from the printed otpauth:// URI.
import { randomBytes } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const bytes = randomBytes(20);
let bits = 0;
let value = 0;
let secret = "";
for (const byte of bytes) {
  value = (value << 8) | byte;
  bits += 8;
  while (bits >= 5) {
    secret += ALPHABET[(value >>> (bits - 5)) & 31];
    bits -= 5;
  }
}
if (bits > 0) secret += ALPHABET[(value << (5 - bits)) & 31];

console.log("ADMIN_TOTP_SECRET=" + secret);
console.log(
  "otpauth://totp/RoundTrack%20Pro%20Admin?secret=" + secret + "&issuer=RoundTrack%20Pro"
);
