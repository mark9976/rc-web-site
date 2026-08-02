import { addContactsToGroup } from '@/lib/email/emailStore';
import { handler, ok, fail } from '@/lib/email/routeHelpers';

export const dynamic = 'force-dynamic';

export const POST = handler(async ({ request, context }) => {
  const body = await request.json();
  const ids = Array.isArray(body.contact_ids) ? body.contact_ids.map(Number).filter(Boolean) : [];
  if (ids.length === 0) return fail('Select at least one contact.');

  return ok({ group: addContactsToGroup(Number(context.params.id), ids) });
});
