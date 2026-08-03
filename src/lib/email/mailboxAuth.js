import { getMailboxCredentials } from '@/lib/email/emailStore';
import { getValidAccessToken } from '@/lib/email/microsoftOAuth';

/**
 * Connection-ready credentials for a mailbox, whichever auth it uses.
 *
 * Every IMAP/SMTP caller goes through here rather than calling
 * getMailboxCredentials directly, so an OAuth2 mailbox always gets a token that
 * is current — refreshing it if it is close to expiry. Basic-auth mailboxes are
 * passed straight through unchanged.
 */
export async function resolveMailboxAuth(mailboxId) {
  const credentials = getMailboxCredentials(mailboxId);
  if (!credentials) return null;

  if (credentials.auth_type !== 'oauth2') return credentials;

  const accessToken = await getValidAccessToken({ id: credentials.id });
  return { ...credentials, accessToken };
}
