import { getMessage, updateMessageFlags, deleteMessage } from '@/lib/email/emailStore';
import { handler, ok, fail } from '@/lib/email/routeHelpers';

export const dynamic = 'force-dynamic';

export const GET = handler(async ({ context }) => {
  const message = getMessage(Number(context.params.id));
  return message ? ok({ message }) : fail('Message not found.', 404);
});

export const PUT = handler(async ({ request, context }) => {
  const body = await request.json();
  const message = updateMessageFlags(Number(context.params.id), {
    is_read: body.is_read,
    is_starred: body.is_starred,
  });
  return message ? ok({ message }) : fail('Message not found.', 404);
});

export const DELETE = handler(async ({ context }) => {
  const result = deleteMessage(Number(context.params.id));
  return result.deleted ? ok(result) : fail('Message not found.', 404);
});
