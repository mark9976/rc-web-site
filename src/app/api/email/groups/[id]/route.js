import { getGroup, updateGroup, deleteGroup } from '@/lib/email/emailStore';
import { handler, ok, fail } from '@/lib/email/routeHelpers';

export const dynamic = 'force-dynamic';

export const GET = handler(async ({ context }) => {
  const group = getGroup(Number(context.params.id));
  return group ? ok({ group }) : fail('Group not found.', 404);
});

export const PUT = handler(async ({ request, context }) => {
  const group = updateGroup(Number(context.params.id), await request.json());
  return group ? ok({ group }) : fail('Group not found.', 404);
});

export const DELETE = handler(async ({ context }) => {
  deleteGroup(Number(context.params.id));
  return ok({ success: true });
});
