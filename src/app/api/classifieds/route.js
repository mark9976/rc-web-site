import { NextResponse } from 'next/server';
import {
  getClassifieds,
  getClassifiedById,
  insertClassified,
  deleteClassified,
  normalizeFilename,
} from '@/lib/photoStorage';
import { requireUser } from '@/lib/apiAuth';
import { readImageUpload } from '@/lib/imageUpload';

export const dynamic = 'force-dynamic';

const TYPES = ['For Sale', 'Wanted'];
const CATEGORIES = ['Airframes', 'Radios', 'Engines', 'Batteries', 'Field Equipment', 'Other'];

export async function GET() {
  return NextResponse.json({ classifieds: getClassifieds() });
}

export async function POST(request) {
  const { user, response } = requireUser();
  if (response) return response;

  // Listings are posted as multipart so an optional product photo can ride along.
  const form = await request.formData();
  const title = form.get('title')?.toString().trim().slice(0, 140);
  const description = form.get('description')?.toString().trim().slice(0, 2000) || '';
  const price = form.get('price')?.toString().trim().slice(0, 40) || null;
  const phone = form.get('phone')?.toString().trim().slice(0, 40);
  const type = form.get('type')?.toString();
  const category = form.get('category')?.toString();
  const file = form.get('photo');

  if (!title) {
    return NextResponse.json({ error: 'A title is required.' }, { status: 400 });
  }
  if (!phone) {
    return NextResponse.json({ error: 'A contact phone number is required.' }, { status: 400 });
  }
  if (!TYPES.includes(type)) {
    return NextResponse.json({ error: 'Choose a valid listing type.' }, { status: 400 });
  }
  if (!CATEGORIES.includes(category)) {
    return NextResponse.json({ error: 'Choose a valid category.' }, { status: 400 });
  }

  let photo = null;
  let photoFilename = null;
  if (file && typeof file !== 'string' && file.size > 0) {
    const image = await readImageUpload(file, { normalizeFilename });
    if (image.error) {
      return NextResponse.json({ error: image.error }, { status: 400 });
    }
    photo = image.buffer;
    photoFilename = image.filename;
  }

  const listing = insertClassified({
    title,
    description,
    price,
    phone,
    type,
    category,
    ownerId: user.id,
    ownerName: user.name,
    photo,
    photoFilename,
  });
  return NextResponse.json({ listing });
}

export async function DELETE(request) {
  const { user, response } = requireUser();
  if (response) return response;

  const { id } = await request.json();
  const listing = id ? getClassifiedById(id) : null;
  if (!listing) {
    return NextResponse.json({ error: 'Listing not found.' }, { status: 404 });
  }
  if (user.role !== 'admin' && listing.ownerId !== user.id) {
    return NextResponse.json({ error: 'You may only remove your own listings.' }, { status: 403 });
  }

  deleteClassified(id);
  return NextResponse.json({ success: true });
}
