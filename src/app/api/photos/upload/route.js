import { NextResponse } from 'next/server';
import { normalizeFilename, insertQueuePhoto } from '@/lib/photoStorage';
import { requireUser } from '@/lib/apiAuth';
import { readImageUpload } from '@/lib/imageUpload';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const { user, response } = requireUser();
  if (response) return response;

  const formData = await request.formData();
  const caption = formData.get('caption')?.toString().slice(0, 300) || '';

  const image = await readImageUpload(formData.get('photo'), { normalizeFilename });
  if (image.error) {
    return NextResponse.json({ error: image.error }, { status: 400 });
  }

  const queueItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    filename: image.filename,
    caption,
    // Credit the signed-in uploader rather than a value supplied by the client.
    submitter: user.name,
    submitted: new Date().toISOString(),
    status: 'pending',
    content: image.buffer,
  };

  insertQueuePhoto(queueItem);

  const { content, ...meta } = queueItem;
  return NextResponse.json(meta);
}
