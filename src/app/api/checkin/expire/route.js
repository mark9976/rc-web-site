import { NextResponse } from 'next/server';
import { expireAllCheckins } from '@/lib/photoStorage';

export const dynamic = 'force-dynamic';

/**
 * Sweeps expired check-ins. Also runs on the in-process scheduler every 15
 * minutes; this endpoint exists for an external cron or a manual nudge.
 *
 * Fails closed: with no CRON_SECRET configured the endpoint is disabled rather
 * than left open, since it mutates data and takes no user session.
 */
export async function POST(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured; this endpoint is disabled.' },
      { status: 503 }
    );
  }

  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  return NextResponse.json({ expired: expireAllCheckins() });
}
