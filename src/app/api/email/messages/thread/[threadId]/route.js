import { getThread } from '@/lib/email/emailStore';
import { handler, ok } from '@/lib/email/routeHelpers';

export const dynamic = 'force-dynamic';

export const GET = handler(async ({ context }) =>
  ok({ messages: getThread(context.params.threadId) })
);
