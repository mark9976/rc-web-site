import crypto from 'node:crypto';

const SCRYPT_KEYLEN = 64;
const HASH_PREFIX = 'scrypt$';

// Ambiguous characters are left out on purpose: this password gets read out of
// an email and typed by hand, and 0/O, 1/l/I are where that goes wrong.
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';
const TEMP_PASSWORD_ALPHABET = UPPER + LOWER + DIGITS;

function pick(alphabet) {
  // randomInt is rejection-sampled, so no modulo bias.
  return alphabet[crypto.randomInt(alphabet.length)];
}

/**
 * A one-time password for a newly approved member or an admin-issued reset.
 *
 * Guarantees at least one upper, lower and digit so it satisfies the kind of
 * password rule a member's own password manager might impose, then shuffles so
 * those three are not always in the same positions.
 */
export function generateTemporaryPassword(length = 10) {
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS)];
  while (chars.length < length) chars.push(pick(TEMP_PASSWORD_ALPHABET));

  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

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
