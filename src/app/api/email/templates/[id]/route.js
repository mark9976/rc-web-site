import { getTemplate, updateTemplate, deleteTemplate } from '@/lib/email/emailStore';
import { usedMergeFields } from '@/lib/email/mergeFields';
import { handler, ok, fail } from '@/lib/email/routeHelpers';

export const dynamic = 'force-dynamic';

export const GET = handler(async ({ context }) => {
  const template = getTemplate(Number(context.params.id));
  return template ? ok({ template }) : fail('Template not found.', 404);
});

export const PUT = handler(async ({ request, context }) => {
  const body = await request.json();
  const template = updateTemplate(Number(context.params.id), {
    ...body,
    merge_fields: usedMergeFields(`${body.subject ?? ''} ${body.body_html ?? ''}`),
  });
  return template ? ok({ template }) : fail('Template not found.', 404);
});

export const DELETE = handler(async ({ context }) => {
  deleteTemplate(Number(context.params.id));
  return ok({ success: true });
});
