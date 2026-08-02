import { listGroups, createGroup } from '@/lib/email/emailStore';
import { handler, ok, fail } from '@/lib/email/routeHelpers';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => ok({ groups: listGroups() }));

export const POST = handler(async ({ request }) => {
  const body = await request.json();
  const name = body.name?.toString().trim();
  if (!name) return fail('Give the group a name.');
  try {
    return ok({ group: createGroup({ name, description: body.description }) });
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) return fail('A group with that name already exists.', 409);
    throw error;
  }
});
