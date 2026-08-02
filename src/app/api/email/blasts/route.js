import { listBlasts, createBlast, getGroup, getMailbox, listContacts } from '@/lib/email/emailStore';
import { startBlastInBackground } from '@/lib/email/blastEngine';
import { handler, ok, fail } from '@/lib/email/routeHelpers';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => ok({ blasts: listBlasts() }));

export const POST = handler(async ({ request }) => {
  const body = await request.json();

  const mailbox = getMailbox(Number(body.mailbox_id));
  if (!mailbox) return fail('Choose a mailbox to send from.');
  if (!body.subject?.trim()) return fail('Give the blast a subject.');
  if (!body.body_html?.trim()) return fail('The message body is empty.');

  // Resolve recipients up front so the count shown in the confirmation is the
  // count actually queued.
  let recipients = [];
  if (body.recipient_type === 'group') {
    const group = getGroup(Number(body.group_id));
    if (!group) return fail('Group not found.', 404);
    recipients = group.members;
  } else {
    const ids = Array.isArray(body.contact_ids) ? body.contact_ids.map(Number) : [];
    const all = listContacts({ type: 'all' });
    recipients = all.filter((c) => ids.includes(c.id));
  }

  // De-duplicate: a contact in two selected groups should still get one copy.
  const seen = new Set();
  recipients = recipients.filter((r) => {
    const key = r.email.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (recipients.length === 0) return fail('That selection has no recipients.');

  let scheduledFor = null;
  if (body.scheduled_for) {
    const when = new Date(body.scheduled_for);
    if (Number.isNaN(when.getTime())) return fail('The scheduled time is not a valid date.');
    scheduledFor = when.toISOString();
  }

  const blastId = createBlast(
    {
      mailbox_id: mailbox.id,
      subject: body.subject.trim(),
      body_html: body.body_html,
      from_address: mailbox.email_address,
      recipient_type: body.recipient_type === 'group' ? 'group' : 'custom',
      group_id: body.recipient_type === 'group' ? Number(body.group_id) : null,
      scheduled_for: scheduledFor,
    },
    recipients
  );

  // Immediate sends start now; scheduled ones are picked up by the cron job.
  if (!scheduledFor) startBlastInBackground(blastId);

  return ok({ id: blastId, total_recipients: recipients.length, scheduled: Boolean(scheduledFor) });
});
