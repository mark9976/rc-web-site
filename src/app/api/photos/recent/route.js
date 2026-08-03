import { NextResponse } from 'next/server';
import { getRecentPhotos, deleteRecentPhoto } from '@/lib/photoStorage';
import { requireAdmin } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

// The approved gallery is public.
export async function GET() {
  return NextResponse.json(getRecentPhotos());
}

/**
 * Removes a photo from the public gallery.
 *
 * This is the only way to take down an already-approved photo — rejecting only
 * applies while a photo is still in the review queue.
 */
export async function DELETE(request) {
  const { response } = requireAdmin();
  if (response) return response;

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: 'Missing photo id.' }, { status: 400 });

  const removed = deleteRecentPhoto(id);
  if (!removed) return NextResponse.json({ error: 'Photo not found in the gallery.' }, { status: 404 });

  return NextResponse.json({ success: true, removed });
}
