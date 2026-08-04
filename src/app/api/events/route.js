import { NextResponse } from 'next/server';
import { getEvents, getEventById, upsertEvent, deleteEvent, normalizeFilename } from '@/lib/photoStorage';
import { normalizeDateString } from '@/lib/dateUtils';
import { requireUser } from '@/lib/apiAuth';
import { readImageUpload } from '@/lib/imageUpload';

export const dynamic = 'force-dynamic';

/** Admins may change any event; members only their own. */
function canEdit(user, event) {
  if (!event) return true;
  return user.role === 'admin' || event.ownerId === user.id;
}

/**
 * Only http(s) links are accepted. A `javascript:` URL in an href would run
 * when a visitor clicked the event's link button.
 */
function cleanLink(value) {
  const raw = value?.toString().trim();
  if (!raw) return { link: null };

  // Bare domains are common in pasted text; assume https rather than reject.
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  let url;
  try {
    url = new URL(candidate);
  } catch {
    return { error: 'That link is not a valid web address.' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { error: 'Event links must start with http:// or https://.' };
  }
  return { link: url.toString().slice(0, 500) };
}

export async function GET() {
  return NextResponse.json({ events: getEvents() });
}

/**
 * Accepts multipart (the website's editor, which can carry a poster image) or
 * JSON. The JSON path predates the image support and other clients still use
 * it, so both stay supported.
 */
async function readBody(request) {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('multipart/form-data')) {
    const body = await request.json();
    return { body, file: null };
  }

  const form = await request.formData();
  const body = {};
  for (const [key, value] of form.entries()) {
    if (key !== 'photo') body[key] = value;
  }
  body.removePhoto = body.removePhoto === 'true';
  return { body, file: form.get('photo') };
}

export async function POST(request) {
  const { user, response } = requireUser();
  if (response) return response;

  const { body, file } = await readBody(request);
  const normalizedDate = normalizeDateString(body.date);
  if (!body.id || !body.title || !normalizedDate || !body.startTime || !body.location) {
    return NextResponse.json({ error: 'Missing or invalid required event fields.' }, { status: 400 });
  }

  const { link, error: linkError } = cleanLink(body.link);
  if (linkError) return NextResponse.json({ error: linkError }, { status: 400 });

  const existing = getEventById(body.id);
  if (!canEdit(user, existing)) {
    return NextResponse.json({ error: 'You may only edit your own events.' }, { status: 403 });
  }

  let photo = null;
  let photoFilename = null;
  if (file && typeof file !== 'string' && file.size > 0) {
    const image = await readImageUpload(file, { normalizeFilename });
    if (image.error) return NextResponse.json({ error: image.error }, { status: 400 });
    photo = image.buffer;
    photoFilename = image.filename;
  }

  // Ownership comes from the session, not the request body, so a member cannot
  // post an event attributed to somebody else.
  const event = upsertEvent({
    ...body,
    date: normalizedDate,
    link,
    photo,
    photoFilename,
    ownerId: existing ? existing.ownerId : user.id,
    ownerName: existing ? existing.ownerName : user.name,
  });
  return NextResponse.json({ event });
}

export async function DELETE(request) {
  const { user, response } = requireUser();
  if (response) return response;

  const { id } = await request.json();
  if (!id) {
    return NextResponse.json({ error: 'Missing event id.' }, { status: 400 });
  }

  const existing = getEventById(id);
  if (!existing) {
    return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
  }
  if (!canEdit(user, existing)) {
    return NextResponse.json({ error: 'You may only delete your own events.' }, { status: 403 });
  }

  deleteEvent(id);
  return NextResponse.json({ success: true });
}
