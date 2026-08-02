import { updateSignature, deleteSignature } from '@/lib/email/emailStore';
import { handler, ok, fail } from '@/lib/email/routeHelpers';

export const dynamic = 'force-dynamic';

export const PUT = handler(async ({ request, context }) => {
  const signature = updateSignature(Number(context.params.id), await request.json());
  return signature ? ok({ signature }) : fail('Signature not found.', 404);
});

export const DELETE = handler(async ({ context }) => {
  deleteSignature(Number(context.params.id));
  return ok({ success: true });
});
