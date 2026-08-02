import { syncMembersToContacts } from '@/lib/email/emailStore';
import { handler, ok } from '@/lib/email/routeHelpers';

export const dynamic = 'force-dynamic';

// Pulls the club roster (users table) in as internal contacts.
export const POST = handler(async () => ok(syncMembersToContacts()));
