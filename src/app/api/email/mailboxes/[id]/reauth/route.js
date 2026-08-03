import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/apiAuth';
import { getMailbox } from '@/lib/email/emailStore';
import { appUrl } from '@/lib/email/microsoftOAuth';

export const dynamic = 'force-dynamic';

/**
 * Restarts the Microsoft consent flow for an existing mailbox.
 *
 * The account is identified by whoever signs in at Microsoft, and the callback
 * upserts on email address — so reconnecting is the same flow as connecting,
 * and this endpoint exists to give the UI a per-mailbox link.
 */
export async function GET(request, context) {
  const { response } = requireAdmin();
  if (response) return response;

  const mailbox = getMailbox(Number(context.params.id));
  if (!mailbox) {
    return NextResponse.json({ error: 'Mailbox not found.' }, { status: 404 });
  }
  if (mailbox.auth_type !== 'oauth2') {
    return NextResponse.json({ error: 'This mailbox does not use Microsoft sign-in.' }, { status: 400 });
  }

  return NextResponse.redirect(appUrl('/api/email/oauth/authorize', request.url));
}
