import { getMessage, insertMessage } from '@/lib/email/emailStore';
import { resolveMailboxAuth } from '@/lib/email/mailboxAuth';
import { sendMailWithRetry, htmlToPlainText } from '@/lib/email/smtpClient';
import { computeThreadId } from '@/lib/email/threadUtils';
import { handler, ok, fail } from '@/lib/email/routeHelpers';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

const splitAddresses = (value) =>
  String(value || '')
    .split(/[,;]/)
    .map((a) => a.trim())
    .filter(Boolean);

export const POST = handler(async ({ request }) => {
  // Multipart so attachments can ride along with the message.
  const form = await request.formData();

  const mailboxId = Number(form.get('mailbox_id'));
  const to = splitAddresses(form.get('to'));
  const cc = splitAddresses(form.get('cc'));
  const bcc = splitAddresses(form.get('bcc'));
  const subject = form.get('subject')?.toString().trim() || '(no subject)';
  const bodyHtml = form.get('body_html')?.toString() || '';
  const inReplyTo = form.get('in_reply_to')?.toString() || null;

  if (!mailboxId) return fail('Choose a mailbox to send from.');
  if (to.length === 0) return fail('Add at least one recipient.');

  const credentials = await resolveMailboxAuth(mailboxId);
  if (!credentials) return fail('Mailbox not found.', 404);

  const attachments = [];
  for (const file of form.getAll('attachments')) {
    if (typeof file === 'string' || !file?.arrayBuffer) continue;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      return fail(`"${file.name}" is larger than the 10 MB attachment limit.`, 413);
    }
    attachments.push({
      filename: file.name,
      content: Buffer.from(await file.arrayBuffer()),
      contentType: file.type || 'application/octet-stream',
    });
  }

  // Thread the reply onto its parent so the conversation stays together.
  let references = [];
  if (inReplyTo) {
    const parent = getMessage(Number(form.get('parent_id')) || 0);
    if (parent) references = [...(parent.references_header || []), parent.message_id].filter(Boolean);
  }

  const result = await sendMailWithRetry(credentials, {
    to, cc, bcc, subject, html: bodyHtml, inReplyTo, references, attachments,
  });

  // nodemailer resolves even when the server refused some recipients, listing
  // them in `rejected`. Without this check a refused message still lands in
  // Sent and looks delivered.
  const accepted = result.accepted ?? [];
  const rejected = result.rejected ?? [];
  if (accepted.length === 0) {
    return fail(
      `The mail server accepted no recipients${rejected.length ? `: ${rejected.join(', ')}` : '.'}`,
      502
    );
  }

  // Record our own copy in Sent; the IMAP sync would eventually pick it up, but
  // the message should appear in the UI immediately.
  const sentAt = new Date().toISOString();
  insertMessage(
    {
      mailbox_id: mailboxId,
      message_id: result.messageId || `<local-${Date.now()}@lhmac.local>`,
      uid: null,
      folder: 'Sent',
      from_address: credentials.email_address,
      from_name: credentials.display_name,
      to_addresses: to,
      cc_addresses: cc,
      bcc_addresses: bcc,
      subject,
      body_text: htmlToPlainText(bodyHtml),
      body_html: bodyHtml,
      snippet: htmlToPlainText(bodyHtml).slice(0, 200),
      is_read: true,
      in_reply_to: inReplyTo,
      references_header: references,
      thread_id: computeThreadId({
        messageId: result.messageId,
        inReplyTo,
        references,
        subject,
      }),
      sent_at: sentAt,
    },
    attachments.map((a) => ({
      filename: a.filename,
      contentType: a.contentType,
      size: a.content.length,
      content: a.content,
    }))
  );

  return ok({
    sent: true,
    messageId: result.messageId,
    accepted,
    rejected,
    // Surfaced so a partial refusal is visible rather than silent.
    warning: rejected.length
      ? `Delivered to ${accepted.length} recipient(s); the server refused: ${rejected.join(', ')}`
      : null,
  });
});
