import { NextResponse } from 'next/server';
import { registerPushDevice, unregisterPushDevice, getUserDevices } from '@/lib/photoStorage';
import { requireUser } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

const PLATFORMS = ['ios', 'android'];

export async function POST(request) {
  const { user, response } = requireUser();
  if (response) return response;

  const body = await request.json();
  const deviceToken = body.deviceToken?.toString().trim();
  const platform = PLATFORMS.includes(body.platform) ? body.platform : 'ios';

  if (!deviceToken) {
    return NextResponse.json({ error: 'A device token is required.' }, { status: 400 });
  }

  return NextResponse.json({ device: registerPushDevice(user.id, deviceToken, platform) });
}

export async function DELETE(request) {
  const { user, response } = requireUser();
  if (response) return response;

  const body = await request.json();
  const deviceToken = body.deviceToken?.toString().trim();
  if (!deviceToken) {
    return NextResponse.json({ error: 'A device token is required.' }, { status: 400 });
  }

  // Scoped to the caller's own devices, so one member cannot deregister
  // another's phone by guessing its token.
  const owned = getUserDevices(user.id).some((device) => device.deviceToken === deviceToken);
  if (!owned) return NextResponse.json({ success: true, removed: false });

  unregisterPushDevice(deviceToken);
  return NextResponse.json({ success: true, removed: true });
}
