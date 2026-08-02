import { NextResponse } from 'next/server';
import { getApprovedPhotoContent, getQueuedPhotoContent } from '@/lib/photoStorage';
import { getCurrentUser } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

const CONTENT_TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

export async function GET(request, { params }) {
  const id = decodeURIComponent(params.filename);

  // Approved photos are public. Anything still in the review queue is visible
  // only to an admin, so unreviewed submissions are not publicly reachable.
  let item = getApprovedPhotoContent(id);
  if (!item) {
    const user = getCurrentUser();
    if (user?.role !== 'admin') {
      return NextResponse.json({ error: 'File not found.' }, { status: 404 });
    }
    item = getQueuedPhotoContent(id);
  }

  if (!item) {
    return NextResponse.json({ error: 'File not found.' }, { status: 404 });
  }

  const extension = item.filename.toLowerCase().split('.').pop();
  return new NextResponse(item.content, {
    status: 200,
    headers: {
      'Content-Type': CONTENT_TYPES[extension] || 'application/octet-stream',
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
