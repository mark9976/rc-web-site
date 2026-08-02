import { listMessages, folderCounts } from '@/lib/email/emailStore';
import { handler, ok, fail } from '@/lib/email/routeHelpers';

export const dynamic = 'force-dynamic';

export const GET = handler(async ({ request }) => {
  const params = new URL(request.url).searchParams;
  const mailboxId = Number(params.get('mailbox_id'));
  if (!mailboxId) return fail('mailbox_id is required.');

  const result = listMessages({
    mailboxId,
    folder: params.get('folder') || 'INBOX',
    page: Number(params.get('page')) || 1,
    limit: Math.min(Number(params.get('limit')) || 50, 200),
    search: params.get('search') || '',
  });

  return ok({ ...result, counts: folderCounts(mailboxId) });
});
