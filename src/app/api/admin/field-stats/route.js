import { NextResponse } from 'next/server';
import { getFieldActivityStats } from '@/lib/photoStorage';
import { requireAdmin } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

const MAX_RANGE_DAYS = 365;

export async function GET(request) {
  const { response } = requireAdmin();
  if (response) return response;

  // Accepts "30d" or "30".
  const raw = new URL(request.url).searchParams.get('range') ?? '30d';
  const parsed = Number.parseInt(raw, 10);
  const rangeDays = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, MAX_RANGE_DAYS) : 30;

  return NextResponse.json(getFieldActivityStats(rangeDays));
}
