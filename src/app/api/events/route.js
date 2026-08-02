import { NextResponse } from 'next/server';
import { getEvents, getEventById, upsertEvent, deleteEvent } from '@/lib/photoStorage';
import { normalizeDateString } from '@/lib/dateUtils';
import { requireUser } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

/** Admins may change any event; members only their own. */
function canEdit(user, event) {
  if (!event) return true;
  return user.role === 'admin' || event.ownerId === user.id;
}

export async function GET() {
  return NextResponse.json({ events: getEvents() });
}

export async function POST(request) {
  const { user, response } = requireUser();
  if (response) return response;

  const body = await request.json();
  const normalizedDate = normalizeDateString(body.date);
  if (!body.id || !body.title || !normalizedDate || !body.startTime || !body.location) {
    return NextResponse.json({ error: 'Missing or invalid required event fields.' }, { status: 400 });
  }

  const existing = getEventById(body.id);
  if (!canEdit(user, existing)) {
    return NextResponse.json({ error: 'You may only edit your own events.' }, { status: 403 });
  }

  // Ownership comes from the session, not the request body, so a member cannot
  // post an event attributed to somebody else.
  const event = upsertEvent({
    ...body,
    date: normalizedDate,
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
