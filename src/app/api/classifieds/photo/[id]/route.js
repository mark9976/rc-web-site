import { NextResponse } from 'next/server';
import { getClassifiedPhoto } from '@/lib/photoStorage';
import { contentTypeForFilename } from '@/lib/imageUpload';

export const dynamic = 'force-dynamic';

// Listing photos are public: the classifieds page itself is public.
export async function GET(request, { params }) {
  const item = getClassifiedPhoto(decodeURIComponent(params.id));

  if (!item?.photo) {
    return NextResponse.json({ error: 'Photo not found.' }, { status: 404 });
  }

  return new NextResponse(item.photo, {
    status: 200,
    headers: {
      'Content-Type': contentTypeForFilename(item.photoFilename),
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
