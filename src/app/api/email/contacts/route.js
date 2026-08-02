import { listContacts, upsertContact } from '@/lib/email/emailStore';
import { handler, ok, fail } from '@/lib/email/routeHelpers';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const GET = handler(async ({ request }) => {
  const params = new URL(request.url).searchParams;
  return ok({
    contacts: listContacts({ type: params.get('type') || 'all', search: params.get('search') || '' }),
  });
});

export const POST = handler(async ({ request }) => {
  const body = await request.json();
  const email = body.email?.toString().trim();
  if (!email || !EMAIL_RE.test(email)) return fail('Enter a valid email address.');

  return ok({ contact: upsertContact({ ...body, email }) });
});
