import { syncMailbox } from '@/lib/email/syncEngine';
import { handler, ok } from '@/lib/email/routeHelpers';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export const POST = handler(async ({ context }) => {
  const result = await syncMailbox(Number(context.params.mailboxId));
  return ok(result);
});
