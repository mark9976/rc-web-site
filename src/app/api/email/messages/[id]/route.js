import { getMessage, updateMessageFlags, deleteMessage } from '@/lib/email/emailStore';
import { deleteOnServer } from '@/lib/email/syncEngine';
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
  if (!result.deleted) return fail('Message not found.', 404);

  // Remove the server copy too: otherwise it stays visible in every other mail
  // client, and the next sync would try to pull it back. The local tombstone
  // already makes the delete stick here, so a server failure is reported rather
  // than treated as fatal.
  const server = await deleteOnServer(result.target);

  return ok({
    deleted: true,
    permanent: result.permanent,
    serverDeleted: server.ok,
    serverError: server.ok ? null : server.reason,
  });
});
