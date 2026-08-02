import { NextResponse } from 'next/server';
import {
  getConnectGroup,
  isConnectGroupMember,
  removeConnectGroupMember,
  deleteConnectGroup,
} from '@/lib/photoStorage';
import { requireUser } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function DELETE(request, context) {
  const { user, response } = requireUser();
  if (response) return response;

  const { id: groupId, uid } = context.params;
  const group = getConnectGroup(groupId);
  if (!group || !isConnectGroupMember(groupId, user.id)) {
    return NextResponse.json({ error: 'Group not found.' }, { status: 404 });
  }

  const isSelf = uid === user.id;
  const isCreator = group.createdBy === user.id;
  if (!isSelf && !isCreator) {
    return NextResponse.json({ error: 'Only the group creator can remove other members.' }, { status: 403 });
  }

  // A group without its creator has nobody who can rename or delete it, so the
  // creator leaving takes the group with them. Cascades to members and messages.
  if (uid === group.createdBy) {
    deleteConnectGroup(groupId);
    return NextResponse.json({ success: true, groupDeleted: true });
  }

  removeConnectGroupMember(groupId, uid);
  return NextResponse.json({ success: true, groupDeleted: false });
}
