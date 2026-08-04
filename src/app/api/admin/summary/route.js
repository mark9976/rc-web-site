import { NextResponse } from 'next/server';
import { getDashboardCounts, countNewClubApplications } from '@/lib/photoStorage';
import { requireAdmin } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

/** Counts behind the badges on the admin tile menu. */
export async function GET() {
  const { response } = requireAdmin();
  if (response) return response;

  return NextResponse.json({
    counts: { ...getDashboardCounts(), newClubApplications: countNewClubApplications() },
  });
}
