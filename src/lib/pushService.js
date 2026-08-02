import {
  getUserDevices,
  getDevicesForUsers,
  getPushPreferences,
  getConnectGroupMemberIds,
  filterUsersByPushPreference,
} from '@/lib/photoStorage';

/**
 * Push notifications — delivery is a stub pending AWS SNS.
 *
 * The recipient selection below is real: devices are looked up and per-member
 * preferences are honoured, so switching to SNS only means replacing the
 * `deliver()` body. Call sites are already wired up.
 */

async function deliver(devices, title, body, data) {
  // TODO: publish to the SNS endpoint for each device.
  for (const device of devices) {
    console.log(
      `[PUSH] -> ${device.platform} ${device.deviceToken.slice(0, 12)}… (user ${device.userId}): ${title} — ${body}`,
      data
    );
  }
  return { sent: devices.length };
}

export async function sendPushToUser(userId, title, body, data = {}, category = null) {
  // A category makes the send opt-out-able; omit it for things the member
  // cannot mute, such as a direct reply to their own request.
  if (category && !getPushPreferences(userId)[category]) {
    return { sent: 0, skipped: 'preference' };
  }

  const devices = getUserDevices(userId);
  if (devices.length === 0) return { sent: 0, skipped: 'no-devices' };

  return deliver(devices, title, body, data);
}

export async function sendPushToUsers(userIds, title, body, data = {}, category = null) {
  const eligible = category ? filterUsersByPushPreference(userIds, category) : userIds;
  const devices = getDevicesForUsers(eligible);
  if (devices.length === 0) return { sent: 0, recipients: 0 };

  await deliver(devices, title, body, data);
  return { sent: devices.length, recipients: eligible.length };
}

/** Everyone in a group except the sender, respecting their preferences. */
export async function sendPushToGroup(groupId, excludeUserId, title, body, data = {}) {
  const recipients = getConnectGroupMemberIds(groupId).filter((id) => id !== excludeUserId);
  return sendPushToUsers(recipients, title, body, data, 'groupMessages');
}
