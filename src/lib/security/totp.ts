import crypto from 'crypto';
import { safeEqual } from './crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

export function base32Decode(encoded: string): Buffer {
  const clean = encoded.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(clean[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * Generates a 160-bit Base32-encoded TOTP secret (RFC 6238).
 */
export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

export function buildOtpAuthUri(
  email: string,
  secret: string,
  issuer = 'GlobalCourse AI Admin'
): string {
  const encIssuer = encodeURIComponent(issuer);
  const encEmail = encodeURIComponent(email);
  return `otpauth://totp/${encIssuer}:${encEmail}?secret=${secret}&issuer=${encIssuer}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Computes a 6-digit RFC 4226 / RFC 6238 TOTP code for a given time step.
 */
export function generateTotpCode(secretBase32: string, step: number): string {
  const key = base32Decode(secretBase32);
  const counterBuf = Buffer.alloc(8);
  const high = Math.floor(step / 0x100000000);
  const low = step >>> 0;
  counterBuf.writeUInt32BE(high, 0);
  counterBuf.writeUInt32BE(low, 4);

  const hmac = crypto.createHmac('sha1', key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binary % 1_000_000;
  return String(otp).padStart(6, '0');
}

/**
 * Verifies a 6-digit TOTP code against currentStep +/- 1 with replay protection.
 */
export function verifyTotpCode(
  secretBase32: string,
  code: string,
  lastUsedStep?: number
): { valid: boolean; step?: number } {
  const normalized = String(code || '').replace(/[\s-]+/g, '').trim();
  if (!/^\d{6}$/.test(normalized)) {
    return { valid: false };
  }

  const currentStep = Math.floor(Date.now() / 1000 / 30);
  const steps = [currentStep - 1, currentStep, currentStep + 1];

  for (const step of steps) {
    if (typeof lastUsedStep === 'number' && step <= lastUsedStep) {
      continue;
    }
    const expected = generateTotpCode(secretBase32, step);
    if (safeEqual(expected, normalized)) {
      return { valid: true, step };
    }
  }

  return { valid: false };
}
