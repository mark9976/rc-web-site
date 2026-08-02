import { NextResponse } from 'next/server';
import {
  getConnectGroup,
  isConnectGroupMember,
  getConnectGroupMessages,
  insertConnectGroupMessage,
} from '@/lib/photoStorage';
import { requireUser } from '@/lib/apiAuth';
import { sendPushToGroup } from '@/lib/pushService';

export const dynamic = 'force-dynamic';

const MAX_LIMIT = 100;

export async function GET(request, context) {
  const { user, response } = requireUser();
  if (response) return response;

  const groupId = context.params.id;
  if (!isConnectGroupMember(groupId, user.id)) {
    return NextResponse.json({ error: 'Group not found.' }, { status: 404 });
  }

  const params = new URL(request.url).searchParams;
  const page = Math.max(1, Number(params.get('page')) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(params.get('limit')) || 50));

  return NextResponse.json({ messages: getConnectGroupMessages(groupId, page, limit), page, limit });
}

export async function POST(request, context) {
  const { user, response } = requireUser();
  if (response) return response;

  const groupId = context.params.id;
  const group = getConnectGroup(groupId);
  if (!group || !isConnectGroupMember(groupId, user.id)) {
    return NextResponse.json({ error: 'Group not found.' }, { status: 404 });
  }

  const body = await request.json();
  const text = body.text?.toString().trim().slice(0, 2000);
  if (!text) return NextResponse.json({ error: 'Message text is required.' }, { status: 400 });

  const isBroadcast = Boolean(body.isBroadcast);
  const message = insertConnectGroupMessage(groupId, user.id, user.name, text, isBroadcast);

  // A broadcast pings the rest of the group; an ordinary message is picked up
  // when they next open the thread.
  if (isBroadcast) {
    await sendPushToGroup(groupId, user.id, group.name, `${user.name}: ${text}`, {
      type: 'groupMessage',
      groupId,
      messageId: message.id,
    });
  }

  return NextResponse.json({ message });
}
