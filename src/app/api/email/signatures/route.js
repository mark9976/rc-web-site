import { listSignatures, createSignature } from '@/lib/email/emailStore';
import { handler, ok, fail } from '@/lib/email/routeHelpers';

export const dynamic = 'force-dynamic';

export const GET = handler(async ({ request }) => {
  const mailboxId = new URL(request.url).searchParams.get('mailbox_id');
  return ok({ signatures: listSignatures(mailboxId ? Number(mailboxId) : null) });
});

export const POST = handler(async ({ request }) => {
  const body = await request.json();
  if (!body.mailbox_id) return fail('Choose a mailbox.');
  if (!body.name?.trim()) return fail('Give the signature a name.');

  return ok({
    signature: createSignature({
      mailbox_id: Number(body.mailbox_id),
      name: body.name.trim(),
      body_html: body.body_html || '',
      is_default: body.is_default,
    }),
  });
});
