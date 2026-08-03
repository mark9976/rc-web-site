import { getMailbox, updateMailbox, deleteMailbox } from '@/lib/email/emailStore';
import { clearTransporter } from '@/lib/email/smtpClient';
import { handler, ok, fail } from '@/lib/email/routeHelpers';

export const dynamic = 'force-dynamic';

export const GET = handler(async ({ context }) => {
  const mailbox = getMailbox(Number(context.params.id));
  return mailbox ? ok({ mailbox }) : fail('Mailbox not found.', 404);
});

export const PUT = handler(async ({ request, context }) => {
  const id = Number(context.params.id);
  const body = await request.json();

  // The manual form cannot edit an OAuth2 mailbox: its host settings are fixed
  // by Microsoft and it has no password, so saving one here would overwrite a
  // working connection with blanks. Reconnect instead.
  const existing = getMailbox(id);
  if (!existing) return fail('Mailbox not found.', 404);
  if (existing.auth_type === 'oauth2') {
    return fail('This mailbox is connected through Microsoft. Use Reconnect to re-authorize it.', 400);
  }

  const mailbox = updateMailbox(id, body);
  if (!mailbox) return fail('Mailbox not found.', 404);

  // Settings may have changed; drop the pooled SMTP connection.
  clearTransporter(id);
  return ok({ mailbox });
});

export const DELETE = handler(async ({ context }) => {
  const id = Number(context.params.id);
  clearTransporter(id);
  deleteMailbox(id);
  return ok({ success: true });
});
