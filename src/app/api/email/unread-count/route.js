import { totalUnreadCount, unreadByMailbox } from '@/lib/email/emailStore';
import { handler, ok } from '@/lib/email/routeHelpers';

export const dynamic = 'force-dynamic';

// Drives the "Admin Email (10)" badge in the main navigation.
export const GET = handler(async () =>
  ok({ unread: totalUnreadCount(), byMailbox: unreadByMailbox() })
);
