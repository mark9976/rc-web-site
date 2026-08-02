import { NextResponse } from 'next/server';
import { getPushPreferences, updatePushPreferences } from '@/lib/photoStorage';
import { requireUser } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { user, response } = requireUser();
  if (response) return response;

  return NextResponse.json({ preferences: getPushPreferences(user.id) });
}

export async function PUT(request) {
  const { user, response } = requireUser();
  if (response) return response;

  // Every field is optional; only what is sent gets written.
  const body = await request.json();
  return NextResponse.json({ preferences: updatePushPreferences(user.id, body) });
}
