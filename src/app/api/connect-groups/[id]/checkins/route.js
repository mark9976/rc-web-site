import { NextResponse } from 'next/server';
import { isConnectGroupMember, getGroupCheckedInMembers } from '@/lib/photoStorage';
import { requireUser } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function GET(request, context) {
  const { user, response } = requireUser();
  if (response) return response;

  const groupId = context.params.id;
  if (!isConnectGroupMember(groupId, user.id)) {
    return NextResponse.json({ error: 'Group not found.' }, { status: 404 });
  }

  const members = getGroupCheckedInMembers(groupId);
  return NextResponse.json({ checkedIn: members, count: members.length });
}
