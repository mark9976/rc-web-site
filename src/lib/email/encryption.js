import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_ENV = 'EMAIL_ENCRYPTION_KEY';

/**
 * AES-256-GCM at rest for mailbox passwords.
 *
 * GCM rather than CBC so the ciphertext is authenticated — a tampered value
 * fails to decrypt instead of silently producing garbage that we would then
 * hand to an IMAP server.
 */
function getKey() {
  const hex = process.env[KEY_ENV];
  if (!hex) {
    throw new Error(
      `${KEY_ENV} is not set. Generate one with:\n` +
        `  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
    );
  }

  const key = Buffer.from(hex, 'hex');
  if (key.length !== 32) {
    throw new Error(`${KEY_ENV} must be 32 bytes (64 hex characters); got ${key.length} bytes.`);
  }
  return key;
}

/** True when a usable key is configured, for surfacing setup problems in the UI. */
export function encryptionConfigured() {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
}

export function encrypt(plaintext) {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  // iv:tag:ciphertext, all hex, so the whole thing is one TEXT column.
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(payload) {
  if (typeof payload !== 'string' || !payload.includes(':')) {
    throw new Error('Stored password is not in the expected encrypted format.');
  }

  const [ivHex, tagHex, dataHex] = payload.split(':');
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));

  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}
