import { NextResponse } from 'next/server';
import {
  getEventTypes,
  getEventTypeByName,
  insertEventType,
  updateEventType,
  deleteEventType,
  countEventsOfType,
} from '@/lib/photoStorage';
import { requireAdmin } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

const HEX = /^#[0-9a-f]{6}$/i;
const DEFAULT_COLOR = '#2D5A27';

function readFields(body) {
  const name = body.name?.toString().trim().slice(0, 40);
  const color = body.color?.toString().trim();
  if (!name) return { error: 'Give the type a name.' };
  // Colours are written into a style attribute, so only accept a plain hex.
  if (color && !HEX.test(color)) return { error: 'Choose a colour from the palette.' };
  return { name, color: color || DEFAULT_COLOR };
}

// Public: the events page needs the list to render its filter and labels.
export async function GET() {
  return NextResponse.json({ eventTypes: getEventTypes() });
}

export async function POST(request) {
  const { response } = requireAdmin();
  if (response) return response;

  const { name, color, error } = readFields(await request.json());
  if (error) return NextResponse.json({ error }, { status: 400 });

  if (getEventTypeByName(name)) {
    return NextResponse.json({ error: `“${name}” already exists.` }, { status: 409 });
  }

  return NextResponse.json({ eventType: insertEventType({ name, color }) });
}

export async function PUT(request) {
  const { response } = requireAdmin();
  if (response) return response;

  const body = await request.json();
  const { name, color, error } = readFields(body);
  if (error) return NextResponse.json({ error }, { status: 400 });
  if (!body.id) return NextResponse.json({ error: 'Missing type id.' }, { status: 400 });

  const clash = getEventTypeByName(name);
  if (clash && clash.id !== body.id) {
    return NextResponse.json({ error: `“${name}” already exists.` }, { status: 409 });
  }

  const eventType = updateEventType(body.id, { name, color });
  if (!eventType) return NextResponse.json({ error: 'Type not found.' }, { status: 404 });

  return NextResponse.json({ eventType });
}

export async function DELETE(request) {
  const { response } = requireAdmin();
  if (response) return response;

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: 'Missing type id.' }, { status: 400 });

  const existing = getEventTypes().find((type) => type.id === id);
  if (!existing) return NextResponse.json({ error: 'Type not found.' }, { status: 404 });

  // Refuse rather than orphan events onto a category that no longer exists.
  const inUse = countEventsOfType(existing.name);
  if (inUse > 0) {
    return NextResponse.json(
      { error: `${inUse} event${inUse === 1 ? '' : 's'} still use “${existing.name}”. Change them first, or rename this type instead.` },
      { status: 409 }
    );
  }

  deleteEventType(id);
  return NextResponse.json({ success: true });
}
