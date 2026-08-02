import crypto from 'node:crypto';

const SCRYPT_KEYLEN = 64;
const HASH_PREFIX = 'scrypt$';

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  return `${HASH_PREFIX}${salt}$${derived}`;
}

export function isHashed(stored) {
  return typeof stored === 'string' && stored.startsWith(HASH_PREFIX);
}

/**
 * Accounts created before hashing was introduced still hold a plaintext password.
 * Those compare directly so existing members can still sign in; the login route
 * upgrades the stored value to a hash on the next successful sign-in.
 */
export function verifyPassword(password, stored) {
  if (!stored) return false;

  if (!isHashed(stored)) {
    const a = Buffer.from(password);
    const b = Buffer.from(stored);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  const [, salt, expected] = stored.split('$');
  if (!salt || !expected) return false;

  const derived = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (derived.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(derived, expectedBuffer);
}
