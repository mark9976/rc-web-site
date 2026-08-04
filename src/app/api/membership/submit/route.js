import { NextResponse } from 'next/server';
import { insertApplication, isUsernameAvailable } from '@/lib/photoStorage';

export const dynamic = 'force-dynamic';

const MAX_LENGTHS = { name: 120, phone: 40, email: 160, address: 240, amaNumber: 20, reason: 1000 };

// Matches the rule the admin member editor already enforces, so a username
// chosen here cannot be one an admin would later be unable to re-save.
const USERNAME_PATTERN = /^[a-z0-9._-]{3,40}$/i;

export async function POST(request) {
  const body = await request.json();
  const fields = {};
  for (const [key, limit] of Object.entries(MAX_LENGTHS)) {
    fields[key] = body[key]?.toString().trim().slice(0, limit) || '';
  }
  // Stored lower-case so "Jane" and "jane" cannot both be taken.
  const username = body.username?.toString().trim().toLowerCase().slice(0, 40) || '';

  if (!fields.name || !username || !fields.phone || !fields.email || !fields.address || !fields.amaNumber) {
    return NextResponse.json({ error: 'All fields except the note are required.' }, { status: 400 });
  }
  if (!USERNAME_PATTERN.test(username)) {
    return NextResponse.json(
      { error: 'Username must be 3–40 characters, using letters, numbers, dots, dashes or underscores.' },
      { status: 400 }
    );
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fields.email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }
  if (!isUsernameAvailable(username)) {
    return NextResponse.json(
      { error: `“${username}” is already taken. Please choose another.` },
      { status: 409 }
    );
  }

  insertApplication({ ...fields, username });
  // The stored row is not echoed back: this endpoint is public, and the
  // response would otherwise hand the submitter's details to any caller.
  return NextResponse.json({ success: true });
}
