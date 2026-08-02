import { NextResponse } from 'next/server';
import { getRecentPhotos } from '@/lib/photoStorage';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(getRecentPhotos());
}
