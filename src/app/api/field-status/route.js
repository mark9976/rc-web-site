import { NextResponse } from 'next/server';
import {
  setFieldStatus,
  getManualFieldStatus,
  getEffectiveFieldStatus,
  getUpcomingClosures,
} from '@/lib/photoStorage';
import { requireAdmin } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

const STATUSES = ['open', 'closed', 'maintenance'];

export async function GET() {
  return NextResponse.json({
    // `fieldStatus` is what the field is actually in right now, which may come
    // from a running scheduled closure rather than the manual toggle.
    fieldStatus: getEffectiveFieldStatus(),
    manualStatus: getManualFieldStatus(),
    upcomingClosures: getUpcomingClosures(),
  });
}

export async function POST(request) {
  const { user, response } = requireAdmin();
  if (response) return response;

  const body = await request.json();
  const status = body.status?.toString().toLowerCase();
  const reason = body.reason?.toString().trim().slice(0, 200) || '';

  if (!STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Status must be open, closed, or maintenance.' }, { status: 400 });
  }

  setFieldStatus(status, reason, user.name);
  return NextResponse.json({
    fieldStatus: getEffectiveFieldStatus(),
    manualStatus: getManualFieldStatus(),
    upcomingClosures: getUpcomingClosures(),
  });
}
