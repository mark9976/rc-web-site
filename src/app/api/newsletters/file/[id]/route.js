import { NextResponse } from 'next/server';
import { getNewsletterFile } from '@/lib/photoStorage';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const item = getNewsletterFile(decodeURIComponent(params.id));

  if (!item?.content) {
    return NextResponse.json({ error: 'Newsletter not found.' }, { status: 404 });
  }

  return new NextResponse(item.content, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      // `inline` so it opens in the browser's PDF viewer rather than downloading.
      'Content-Disposition': `inline; filename="${item.filename.replace(/"/g, '')}"`,
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
