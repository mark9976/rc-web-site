import { getContact, updateContact, deleteContact } from '@/lib/email/emailStore';
import { handler, ok, fail } from '@/lib/email/routeHelpers';

export const dynamic = 'force-dynamic';

export const GET = handler(async ({ context }) => {
  const contact = getContact(Number(context.params.id));
  return contact ? ok({ contact }) : fail('Contact not found.', 404);
});

export const PUT = handler(async ({ request, context }) => {
  const contact = updateContact(Number(context.params.id), await request.json());
  return contact ? ok({ contact }) : fail('Contact not found.', 404);
});

export const DELETE = handler(async ({ context }) => {
  deleteContact(Number(context.params.id));
  return ok({ success: true });
});
