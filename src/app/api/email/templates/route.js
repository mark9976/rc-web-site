import { listTemplates, createTemplate } from '@/lib/email/emailStore';
import { usedMergeFields } from '@/lib/email/mergeFields';
import { handler, ok, fail } from '@/lib/email/routeHelpers';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => ok({ templates: listTemplates() }));

export const POST = handler(async ({ request }) => {
  const body = await request.json();
  if (!body.name?.trim()) return fail('Give the template a name.');
  if (!body.subject?.trim()) return fail('Give the template a subject.');

  const template = createTemplate({
    name: body.name.trim(),
    subject: body.subject.trim(),
    body_html: body.body_html || '',
    merge_fields: usedMergeFields(`${body.subject} ${body.body_html}`),
  });
  return ok({ template });
});
