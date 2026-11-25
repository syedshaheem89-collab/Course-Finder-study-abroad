import crypto from 'crypto';

export type KeyPurpose = 'session' | 'totp' | 'mfa-challenge';

export interface RecoveryCodeHash {
  salt: string;
  hash: string;
  used: boolean;
}

/**
 * Derives a 32-byte purpose-scoped key from AUTH_SESSION_SECRET or SUPABASE_SERVICE_ROLE_KEY.
 * Fails closed if the master secret is missing, too short, or a placeholder.
 */
export function getDerivedKey(purpose: KeyPurpose): Buffer {
  const master = (
    process.env.AUTH_SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ''
  ).trim();

  if (!master || master.length < 24 || master.toLowerCase().includes('placeholder')) {
    throw new Error('Server session/encryption secret is missing or invalid.');
  }

  return crypto
    .createHmac('sha256', master)
    .update(`gc-v1:${purpose}`)
    .digest();
}

export function hasDedicatedSessionSecret(): boolean {
  return Boolean(
    process.env.AUTH_SESSION_SECRET && process.env.AUTH_SESSION_SECRET.trim().length >= 32
  );
}

/**
 * Encrypts a JSON-serializable payload with AES-256-GCM (12-byte IV, 16-byte tag).
 */
export function encryptJson<T>(data: T, purpose: KeyPurpose): string {
  const key = getDerivedKey(purpose);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
  const plaintext = Buffer.from(JSON.stringify(data), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${ciphertext.toString('base64url')}`;
}

/**
 * Decrypts and verifies an AES-256-GCM token. Returns null on tampering or invalid format.
 */
export function decryptJson<T>(token: string, purpose: KeyPurpose): T | null {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [ivB64, tagB64, ctB64] = parts;
    const iv = Buffer.from(ivB64, 'base64url');
    const tag = Buffer.from(tagB64, 'base64url');
    const ciphertext = Buffer.from(ctB64, 'base64url');

    if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) {
      return null;
    }

    const key = getDerivedKey(purpose);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(plaintext.toString('utf8')) as T;
  } catch {
    return null;
  }
}

export function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

/**
 * Constant-time string comparison using fixed-length SHA-256 digests to avoid length oracles.
 */
export function safeEqual(a: string, b: string): boolean {
  const digestA = crypto.createHash('sha256').update(String(a), 'utf8').digest();
  const digestB = crypto.createHash('sha256').update(String(b), 'utf8').digest();
  return crypto.timingSafeEqual(digestA, digestB);
}

export function normalizeRecoveryCode(code: string): string {
  return String(code || '')
    .toUpperCase()
    .replace(/[\s-]+/g, '')
    .trim();
}

export function hashRecoveryCode(code: string, salt: string): string {
  const norm = normalizeRecoveryCode(code);
  return crypto.scryptSync(norm, salt, 32).toString('hex');
}

export function generateRecoveryCodes(count = 8): {
  plain: string[];
  hashes: RecoveryCodeHash[];
} {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const plain: string[] = [];
  const hashes: RecoveryCodeHash[] = [];

  for (let i = 0; i < count; i++) {
    let raw = '';
    while (raw.length < 12) {
      const bytes = crypto.randomBytes(16);
      for (const byte of bytes) {
        // Rejection sampling to avoid modulo bias on a 32-char (256 % 32 == 0) alphabet
        if (byte < 256 - (256 % alphabet.length)) {
          raw += alphabet[byte % alphabet.length];
          if (raw.length === 12) break;
        }
      }
    }
    const formatted = `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashRecoveryCode(formatted, salt);
    plain.push(formatted);
    hashes.push({ salt, hash, used: false });
  }

  return { plain, hashes };
}
