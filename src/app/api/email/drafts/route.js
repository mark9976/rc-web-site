import { insertMessage, getMailbox, listMessages } from '@/lib/email/emailStore';
import { htmlToPlainText } from '@/lib/email/smtpClient';
import { computeThreadId } from '@/lib/email/threadUtils';
import { handler, ok, fail } from '@/lib/email/routeHelpers';

export const dynamic = 'force-dynamic';

export const GET = handler(async ({ request }) => {
  const mailboxId = Number(new URL(request.url).searchParams.get('mailbox_id'));
  if (!mailboxId) return fail('mailbox_id is required.');
  return ok(listMessages({ mailboxId, folder: 'Drafts' }));
});

export const POST = handler(async ({ request }) => {
  const body = await request.json();
  const mailbox = getMailbox(Number(body.mailbox_id));
  if (!mailbox) return fail('Mailbox not found.', 404);

  const html = body.body_html || '';
  const messageId = `<draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@lhmac.local>`;

  const rowId = insertMessage({
    mailbox_id: mailbox.id,
    message_id: messageId,
    folder: 'Drafts',
    from_address: mailbox.email_address,
    from_name: mailbox.display_name,
    to_addresses: body.to || [],
    cc_addresses: body.cc || [],
    bcc_addresses: body.bcc || [],
    subject: body.subject || '(no subject)',
    body_text: htmlToPlainText(html),
    body_html: html,
    snippet: htmlToPlainText(html).slice(0, 200),
    is_read: true,
    is_draft: true,
    in_reply_to: body.in_reply_to || null,
    references_header: [],
    thread_id: computeThreadId({ messageId, subject: body.subject }),
    sent_at: new Date().toISOString(),
  });

  return ok({ id: rowId });
});
