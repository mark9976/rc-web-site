import { NextResponse } from 'next/server';
import { approveQueueItem, getPhotoUrl } from '@/lib/photoStorage';
import { requireAdmin } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const { response } = requireAdmin();
  if (response) return response;

  const { id } = await request.json();
  if (!id) {
    return NextResponse.json({ error: 'Missing photo id.' }, { status: 400 });
  }

  const approvedPhoto = approveQueueItem(id);
  if (!approvedPhoto) {
    return NextResponse.json({ error: 'Photo not found in queue.' }, { status: 404 });
  }

  return NextResponse.json({
    ...approvedPhoto,
    src: getPhotoUrl(approvedPhoto.id),
  });
}
