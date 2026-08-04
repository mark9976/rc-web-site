import { NextResponse } from 'next/server';
import { getSetting, setSetting } from '@/lib/photoStorage';
import { listMailboxes } from '@/lib/email/emailStore';
import {
  MEMBER_EMAIL_MAILBOX_SETTING,
  getMemberEmailMailbox,
  sendMemberWelcomeEmail,
} from '@/lib/email/memberWelcome';
import { requireAdmin } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

function appOrigin(request) {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const proto = (request.headers.get('x-forwarded-proto') || '').split(',')[0].trim();
  if (host) return `${proto || 'https'}://${host}`;
  return new URL(request.url).origin;
}

/** Which mailbox new-member emails use, plus the mailboxes available. */
export async function GET() {
  const { response } = requireAdmin();
  if (response) return response;

  const active = getMemberEmailMailbox();
  return NextResponse.json({
    selectedId: getSetting(MEMBER_EMAIL_MAILBOX_SETTING),
    // Which one is genuinely in use, after falling back to the default.
    activeMailbox: active
      ? {
          id: active.id,
          email_address: active.email_address,
          display_name: active.display_name,
          needs_reauth: Boolean(active.needs_reauth),
        }
      : null,
    mailboxes: listMailboxes().map((mailbox) => ({
      id: mailbox.id,
      email_address: mailbox.email_address,
      display_name: mailbox.display_name,
      is_default: Boolean(mailbox.is_default),
      needs_reauth: Boolean(mailbox.needs_reauth),
    })),
  });
}

export async function PUT(request) {
  const { user, response } = requireAdmin();
  if (response) return response;

  const { mailboxId } = await request.json();

  // An empty value means "use the default mailbox" rather than an error.
  if (!mailboxId) {
    setSetting(MEMBER_EMAIL_MAILBOX_SETTING, null, user.name);
    return NextResponse.json({ success: true, selectedId: null });
  }

  const exists = listMailboxes().some((mailbox) => String(mailbox.id) === String(mailboxId));
  if (!exists) {
    return NextResponse.json({ error: 'That mailbox does not exist.' }, { status: 404 });
  }

  setSetting(MEMBER_EMAIL_MAILBOX_SETTING, mailboxId, user.name);
  return NextResponse.json({ success: true, selectedId: String(mailboxId) });
}

/**
 * Sends a sample welcome email so the wiring can be checked without approving
 * a real applicant. Uses obviously fake credentials — no account is touched.
 */
export async function POST(request) {
  const { user, response } = requireAdmin();
  if (response) return response;

  const { to } = await request.json();
  const recipient = to?.toString().trim() || user.email;
  if (!recipient) {
    return NextResponse.json({ error: 'Enter an address to send the test to.' }, { status: 400 });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipient)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  const result = await sendMemberWelcomeEmail({
    to: recipient,
    name: 'Test Member',
    username: 'testmember',
    password: 'Example123',
    siteUrl: appOrigin(request),
  });

  return NextResponse.json({ ...result, to: recipient });
}
