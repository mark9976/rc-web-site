import { NextResponse } from 'next/server';
import { getApplications, reviewApplication } from '@/lib/photoStorage';
import { requireAdmin } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

// Applications carry names, addresses, phone numbers and AMA numbers, so this
// list is admin-only.
export async function GET() {
  const { response } = requireAdmin();
  if (response) return response;

  return NextResponse.json({ applications: getApplications() });
}

export async function POST(request) {
  const { response } = requireAdmin();
  if (response) return response;

  const { id, action } = await request.json();
  if (!id || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const result = reviewApplication(id, action);
  if (!result) {
    return NextResponse.json({ error: 'Application not found or already reviewed.' }, { status: 404 });
  }

  return NextResponse.json({ result });
}
