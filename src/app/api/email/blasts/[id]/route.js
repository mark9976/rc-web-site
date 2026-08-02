import { getBlast } from '@/lib/email/emailStore';
import { isBlastRunning } from '@/lib/email/blastEngine';
import { handler, ok, fail } from '@/lib/email/routeHelpers';

export const dynamic = 'force-dynamic';

export const GET = handler(async ({ context }) => {
  const id = Number(context.params.id);
  const blast = getBlast(id);
  return blast ? ok({ blast: { ...blast, running: isBlastRunning(id) } }) : fail('Blast not found.', 404);
});
