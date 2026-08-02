import { NextResponse } from 'next/server';
import { getAttachment } from '@/lib/email/emailStore';
import { handler, fail } from '@/lib/email/routeHelpers';

export const dynamic = 'force-dynamic';

export const GET = handler(async ({ context }) => {
  const { id, attachmentId } = context.params;
  const attachment = getAttachment(Number(id), Number(attachmentId));
  if (!attachment?.content) return fail('Attachment not found.', 404);

  return new NextResponse(attachment.content, {
    status: 200,
    headers: {
      'Content-Type': attachment.content_type || 'application/octet-stream',
      // Attachments come from outside; force download rather than letting the
      // browser render them inline in our origin.
      'Content-Disposition': `attachment; filename="${attachment.filename.replace(/"/g, '')}"`,
      'Content-Length': String(attachment.size ?? attachment.content.length),
    },
  });
});
