import { listMailboxes, createMailbox } from '@/lib/email/emailStore';
import { testImapConnection } from '@/lib/email/imapClient';
import { testSmtpConnection } from '@/lib/email/smtpClient';
import { encryptionConfigured } from '@/lib/email/encryption';
import { handler, ok, fail } from '@/lib/email/routeHelpers';
import { oauthConfigured, oauthConfig } from '@/lib/email/microsoftOAuth';

export const dynamic = 'force-dynamic';

const REQUIRED = ['email_address', 'display_name', 'imap_host', 'smtp_host', 'username', 'password'];

// listMailboxes already excludes every secret column, tokens included; it
// returns auth_type / oauth_provider / needs_reauth so the UI can label rows.
export const GET = handler(async () =>
  ok({
    mailboxes: listMailboxes(),
    encryptionConfigured: encryptionConfigured(),
    microsoftOAuth: { configured: oauthConfigured(), redirectUri: oauthConfig().redirectUri || null },
  })
);

export const POST = handler(async ({ request }) => {
  if (!encryptionConfigured()) {
    return fail('EMAIL_ENCRYPTION_KEY is not set on the server, so credentials cannot be stored safely.', 500);
  }

  const body = await request.json();
  const missing = REQUIRED.filter((field) => !body[field]);
  if (missing.length) return fail(`Missing required fields: ${missing.join(', ')}.`);

  const credentials = {
    id: 0,
    imap_host: body.imap_host,
    imap_port: Number(body.imap_port) || 993,
    smtp_host: body.smtp_host,
    smtp_port: Number(body.smtp_port) || 465,
    username: body.username,
    password: body.password,
    email_address: body.email_address,
    display_name: body.display_name,
  };

  // Verify both directions before storing, so a mailbox in the list is always
  // one that actually works.
  const imap = await testImapConnection(credentials);
  if (!imap.ok) return fail(`IMAP connection failed: ${imap.error}`);

  const smtp = await testSmtpConnection(credentials);
  if (!smtp.ok) return fail(`SMTP connection failed: ${smtp.error}`);

  return ok({ mailbox: createMailbox({ ...credentials, is_default: body.is_default }), folders: imap.folders });
});
