import { NextResponse } from 'next/server';
import { getClubConfig } from '@/lib/photoStorage';

export const dynamic = 'force-dynamic';

// Public: the app needs this before anyone signs in, to show which club it is
// pointed at. Contains no member details beyond published officer names.
export async function GET() {
  return NextResponse.json(getClubConfig());
}
