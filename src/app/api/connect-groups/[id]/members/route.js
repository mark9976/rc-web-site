import { NextResponse } from 'next/server';
import {
  getConnectGroup,
  getConnectGroupMembers,
  isConnectGroupMember,
  addConnectGroupMember,
  getUserById,
} from '@/lib/photoStorage';
import { requireUser } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function GET(request, context) {
  const { user, response } = requireUser();
  if (response) return response;

  const groupId = context.params.id;
  if (!isConnectGroupMember(groupId, user.id)) {
    return NextResponse.json({ error: 'Group not found.' }, { status: 404 });
  }

  return NextResponse.json({ members: getConnectGroupMembers(groupId) });
}

export async function POST(request, context) {
  const { user, response } = requireUser();
  if (response) return response;

  const groupId = context.params.id;
  if (!getConnectGroup(groupId) || !isConnectGroupMember(groupId, user.id)) {
    return NextResponse.json({ error: 'Group not found.' }, { status: 404 });
  }

  const body = await request.json();
  const userId = body.userId?.toString();
  if (!userId) return NextResponse.json({ error: 'Missing userId.' }, { status: 400 });

  // Take the name from the roster, not the request, so members cannot be added
  // under a made-up name.
  const member = getUserById(userId);
  if (!member) return NextResponse.json({ error: 'That member does not exist.' }, { status: 404 });

  addConnectGroupMember(groupId, member.id, member.name);
  return NextResponse.json({ members: getConnectGroupMembers(groupId) });
}
