import { NextResponse } from 'next/server';
import { getConnectGroups, createConnectGroup } from '@/lib/photoStorage';
import { requireUser } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { user, response } = requireUser();
  if (response) return response;

  return NextResponse.json({ groups: getConnectGroups(user.id) });
}

export async function POST(request) {
  const { user, response } = requireUser();
  if (response) return response;

  const body = await request.json();
  const name = body.name?.toString().trim().slice(0, 80);
  if (!name) {
    return NextResponse.json({ error: 'Give the group a name.' }, { status: 400 });
  }

  return NextResponse.json({ group: createConnectGroup(name, user.id, user.name) });
}
