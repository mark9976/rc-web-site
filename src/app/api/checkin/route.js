import { NextResponse } from 'next/server';
import { checkIn, checkOut, getCheckedInCount, getCheckedInUsers, isUserCheckedIn } from '@/lib/photoStorage';
import { requireUser } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { user, response } = requireUser();
  if (response) return response;

  return NextResponse.json({
    count: getCheckedInCount(),
    isCheckedIn: isUserCheckedIn(user.id),
    members: getCheckedInUsers(),
  });
}

export async function POST() {
  const { user, response } = requireUser();
  if (response) return response;

  // Identity comes from the session, never the request body.
  return NextResponse.json({ checkin: checkIn(user.id, user.name), count: getCheckedInCount() });
}

export async function DELETE() {
  const { user, response } = requireUser();
  if (response) return response;

  const removed = checkOut(user.id);
  return NextResponse.json({ success: true, wasCheckedIn: Boolean(removed), count: getCheckedInCount() });
}
