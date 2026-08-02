import { removeContactFromGroup, getGroup } from '@/lib/email/emailStore';
import { handler, ok } from '@/lib/email/routeHelpers';

export const dynamic = 'force-dynamic';

export const DELETE = handler(async ({ context }) => {
  const { id, contactId } = context.params;
  removeContactFromGroup(Number(id), Number(contactId));
  return ok({ group: getGroup(Number(id)) });
});
