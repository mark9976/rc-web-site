import { getTemplate } from '@/lib/email/emailStore';
import { applyMergeFields, sampleContext, mergeContextForContact } from '@/lib/email/mergeFields';
import { getContact } from '@/lib/email/emailStore';
import { handler, ok, fail } from '@/lib/email/routeHelpers';

export const dynamic = 'force-dynamic';

export const POST = handler(async ({ request, context }) => {
  const template = getTemplate(Number(context.params.id));
  if (!template) return fail('Template not found.', 404);

  // Preview against a real contact when one is given, otherwise sample data.
  const body = await request.json().catch(() => ({}));
  const contact = body.contact_id ? getContact(Number(body.contact_id)) : null;
  const merge = contact ? mergeContextForContact(contact) : sampleContext();

  return ok({
    subject: applyMergeFields(template.subject, merge),
    body_html: applyMergeFields(template.body_html, merge),
    usedContact: contact?.email ?? null,
  });
});
