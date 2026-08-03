import { resolveMailboxAuth } from '@/lib/email/mailboxAuth';
import { testImapConnection } from '@/lib/email/imapClient';
import { testSmtpConnection } from '@/lib/email/smtpClient';
import { handler, ok, fail } from '@/lib/email/routeHelpers';

export const dynamic = 'force-dynamic';

export const POST = handler(async ({ context }) => {
  const credentials = await resolveMailboxAuth(Number(context.params.id));
  if (!credentials) return fail('Mailbox not found.', 404);

  const [imap, smtp] = await Promise.all([
    testImapConnection(credentials),
    testSmtpConnection(credentials),
  ]);

  return ok({ imap, smtp, ok: imap.ok && smtp.ok });
});
