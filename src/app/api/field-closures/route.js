import { NextResponse } from 'next/server';
import {
  getFieldClosures,
  insertFieldClosure,
  deleteFieldClosure,
  purgeExpiredClosures,
} from '@/lib/photoStorage';
import { requireAdmin } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

const STATUSES = ['closed', 'maintenance'];
const MAX_YEARS_AHEAD = 2;

/** Accepts an ISO instant and returns it normalised, or null if unusable. */
function parseInstant(value) {
  if (typeof value !== 'string' || !value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function GET() {
  const { response } = requireAdmin();
  if (response) return response;

  return NextResponse.json({ closures: getFieldClosures() });
}

export async function POST(request) {
  const { user, response } = requireAdmin();
  if (response) return response;

  const body = await request.json();
  const status = body.status?.toString().toLowerCase();
  const reason = body.reason?.toString().trim().slice(0, 200) || '';
  const startsAt = parseInstant(body.startsAt);
  const endsAt = parseInstant(body.endsAt);

  // A scheduled window only makes sense for taking the field out of service.
  if (!STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Scheduled status must be closed or maintenance.' }, { status: 400 });
  }
  if (!startsAt || !endsAt) {
    return NextResponse.json({ error: 'Provide a valid start and end date/time.' }, { status: 400 });
  }
  if (endsAt <= startsAt) {
    return NextResponse.json({ error: 'The end must come after the start.' }, { status: 400 });
  }

  const limit = new Date();
  limit.setFullYear(limit.getFullYear() + MAX_YEARS_AHEAD);
  if (startsAt > limit) {
    return NextResponse.json({ error: `Start must be within ${MAX_YEARS_AHEAD} years.` }, { status: 400 });
  }

  const closure = insertFieldClosure({
    status,
    reason,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    createdBy: user.name,
  });
  return NextResponse.json({ closure });
}

export async function DELETE(request) {
  const { response } = requireAdmin();
  if (response) return response;

  const body = await request.json();

  if (body.action === 'purgeExpired') {
    const result = purgeExpiredClosures();
    return NextResponse.json({ removed: result.changes });
  }

  if (!body.id) return NextResponse.json({ error: 'Missing closure id.' }, { status: 400 });

  deleteFieldClosure(body.id);
  return NextResponse.json({ success: true });
}
