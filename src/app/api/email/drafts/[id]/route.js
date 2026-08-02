import { emailDb } from '@/lib/email/setupEmailDb';
import { getMessage } from '@/lib/email/emailStore';
import { htmlToPlainText } from '@/lib/email/smtpClient';
import { handler, ok, fail } from '@/lib/email/routeHelpers';

export const dynamic = 'force-dynamic';

export const PUT = handler(async ({ request, context }) => {
  const id = Number(context.params.id);
  const existing = getMessage(id);
  if (!existing) return fail('Draft not found.', 404);
  if (!existing.is_draft) return fail('That message is not a draft.', 400);

  const body = await request.json();
  const html = body.body_html ?? existing.body_html ?? '';

  emailDb()
    .prepare(
      `UPDATE email_messages SET to_addresses=?, cc_addresses=?, bcc_addresses=?,
       subject=?, body_html=?, body_text=?, snippet=? WHERE id=?`
    )
    .run(
      JSON.stringify(body.to ?? existing.to_addresses),
      JSON.stringify(body.cc ?? existing.cc_addresses),
      JSON.stringify(body.bcc ?? existing.bcc_addresses),
      body.subject ?? existing.subject,
      html,
      htmlToPlainText(html),
      htmlToPlainText(html).slice(0, 200),
      id
    );

  return ok({ message: getMessage(id) });
});
