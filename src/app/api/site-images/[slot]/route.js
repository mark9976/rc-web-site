import { NextResponse } from 'next/server';
import { getSiteImageFile } from '@/lib/photoStorage';

export const dynamic = 'force-dynamic';

// Public: these are site decoration, shown to every visitor.
export async function GET(request, { params }) {
  const item = getSiteImageFile(decodeURIComponent(params.slot));

  if (!item?.content) {
    return NextResponse.json({ error: 'Image not set.' }, { status: 404 });
  }

  return new NextResponse(item.content, {
    status: 200,
    headers: {
      'Content-Type': item.contentType || 'image/jpeg',
      // Short cache: an admin swapping the image should see it change quickly.
      'Cache-Control': 'public, max-age=60',
      ETag: `"${item.updatedAt}"`,
    },
  });
}
