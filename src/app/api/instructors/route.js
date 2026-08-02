import { NextResponse } from 'next/server';
import { getInstructors } from '@/lib/photoStorage';

export const dynamic = 'force-dynamic';

// Public: the lesson request form needs to offer a choice of instructor.
// Only name and blurb are returned, never contact details.
export async function GET() {
  return NextResponse.json({ instructors: getInstructors() });
}
