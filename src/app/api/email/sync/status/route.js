import { listMailboxes, folderCounts } from '@/lib/email/emailStore';
import { handler, ok } from '@/lib/email/routeHelpers';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  const mailboxes = listMailboxes().map((mailbox) => ({
    id: mailbox.id,
    email_address: mailbox.email_address,
    display_name: mailbox.display_name,
    last_sync_at: mailbox.last_sync_at,
    last_sync_error: mailbox.last_sync_error,
    counts: folderCounts(mailbox.id),
  }));
  return ok({ mailboxes });
});
