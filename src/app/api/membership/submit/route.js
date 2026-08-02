import { NextResponse } from 'next/server';
import { insertApplication } from '@/lib/photoStorage';

export const dynamic = 'force-dynamic';

const MAX_LENGTHS = { name: 120, phone: 40, email: 160, address: 240, amaNumber: 20, reason: 1000 };

export async function POST(request) {
  const body = await request.json();
  const fields = {};
  for (const [key, limit] of Object.entries(MAX_LENGTHS)) {
    fields[key] = body[key]?.toString().trim().slice(0, limit) || '';
  }

  if (!fields.name || !fields.phone || !fields.email || !fields.address || !fields.amaNumber) {
    return NextResponse.json({ error: 'All fields except the note are required.' }, { status: 400 });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fields.email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  insertApplication(fields);
  // The stored row is not echoed back: this endpoint is public, and the
  // response would otherwise hand the submitter's details to any caller.
  return NextResponse.json({ success: true });
}
