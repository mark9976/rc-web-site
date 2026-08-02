import { NextResponse } from 'next/server';
import {
  getConnectGroup,
  getConnectGroupMembers,
  isConnectGroupMember,
  updateConnectGroupName,
  deleteConnectGroup,
} from '@/lib/photoStorage';
import { requireUser } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

/** Resolves the group and checks the caller's access in one step. */
function loadGroup(id, user, { creatorOnly = false } = {}) {
  const group = getConnectGroup(id);
  if (!group) {
    return { response: NextResponse.json({ error: 'Group not found.' }, { status: 404 }) };
  }
  if (creatorOnly) {
    if (group.createdBy !== user.id) {
      return { response: NextResponse.json({ error: 'Only the group creator can do that.' }, { status: 403 }) };
    }
  } else if (!isConnectGroupMember(id, user.id)) {
    // 404 rather than 403: a non-member should not learn the group exists.
    return { response: NextResponse.json({ error: 'Group not found.' }, { status: 404 }) };
  }
  return { group };
}

export async function GET(request, context) {
  const { user, response } = requireUser();
  if (response) return response;

  const { group, response: denied } = loadGroup(context.params.id, user);
  if (denied) return denied;

  return NextResponse.json({
    group: { ...group, isCreator: group.createdBy === user.id },
    members: getConnectGroupMembers(group.id),
  });
}

export async function PUT(request, context) {
  const { user, response } = requireUser();
  if (response) return response;

  const { group, response: denied } = loadGroup(context.params.id, user, { creatorOnly: true });
  if (denied) return denied;

  const body = await request.json();
  const name = body.name?.toString().trim().slice(0, 80);
  if (!name) return NextResponse.json({ error: 'Give the group a name.' }, { status: 400 });

  return NextResponse.json({ group: updateConnectGroupName(group.id, name) });
}

export async function DELETE(request, context) {
  const { user, response } = requireUser();
  if (response) return response;

  const { group, response: denied } = loadGroup(context.params.id, user, { creatorOnly: true });
  if (denied) return denied;

  deleteConnectGroup(group.id);
  return NextResponse.json({ success: true });
}
