import { NextResponse } from 'next/server';
import { getSiteImageMeta, upsertSiteImage, deleteSiteImage, normalizeFilename } from '@/lib/photoStorage';
import { requireAdmin } from '@/lib/apiAuth';
import { readImageUpload } from '@/lib/imageUpload';
import { SITE_IMAGE_SLOTS } from '@/lib/clubConstants';

export const dynamic = 'force-dynamic';

// Metadata only, so pages can tell whether a slot has been configured without
// pulling the image bytes.
export async function GET() {
  const images = {};
  for (const slot of SITE_IMAGE_SLOTS) {
    images[slot] = getSiteImageMeta(slot) ?? null;
  }
  return NextResponse.json({ images });
}

export async function POST(request) {
  const { user, response } = requireAdmin();
  if (response) return response;

  const form = await request.formData();
  const slot = form.get('slot')?.toString();

  if (!SITE_IMAGE_SLOTS.includes(slot)) {
    return NextResponse.json({ error: 'Unknown image slot.' }, { status: 400 });
  }

  const file = form.get('image');
  const image = await readImageUpload(file, { normalizeFilename });
  if (image.error) {
    return NextResponse.json({ error: image.error }, { status: 400 });
  }

  const meta = upsertSiteImage({
    slot,
    filename: image.filename,
    contentType: file.type,
    byteSize: image.buffer.length,
    updatedBy: user.name,
    content: image.buffer,
  });
  return NextResponse.json({ image: meta });
}

export async function DELETE(request) {
  const { response } = requireAdmin();
  if (response) return response;

  const { slot } = await request.json();
  if (!SITE_IMAGE_SLOTS.includes(slot)) {
    return NextResponse.json({ error: 'Unknown image slot.' }, { status: 400 });
  }

  deleteSiteImage(slot);
  return NextResponse.json({ success: true });
}
