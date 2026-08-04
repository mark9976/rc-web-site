import { NextResponse } from 'next/server';
import { getApplications, reviewApplication } from '@/lib/photoStorage';
import { requireAdmin } from '@/lib/apiAuth';
import { sendMemberWelcomeEmail } from '@/lib/email/memberWelcome';

/**
 * Public origin for the sign-in link in the email.
 *
 * Prefers the proxy's forwarded headers, because request.url resolves to the
 * server's own address behind nginx and would produce a localhost link.
 */
function appOrigin(request) {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const proto = (request.headers.get('x-forwarded-proto') || '').split(',')[0].trim();
  if (host) return `${proto || 'https'}://${host}`;
  return new URL(request.url).origin;
}

export const dynamic = 'force-dynamic';

// Applications carry names, addresses, phone numbers and AMA numbers, so this
// list is admin-only.
export async function GET() {
  const { response } = requireAdmin();
  if (response) return response;

  return NextResponse.json({ applications: getApplications() });
}

export async function POST(request) {
  const { response } = requireAdmin();
  if (response) return response;

  const { id, action } = await request.json();
  if (!id || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const result = reviewApplication(id, action);
  if (!result) {
    return NextResponse.json({ error: 'Application not found or already reviewed.' }, { status: 404 });
  }

  // Only an approval sends mail; a rejection tells the applicant nothing.
  let email = null;
  if (action === 'approve' && result.user) {
    email = await sendMemberWelcomeEmail({
      to: result.application.email,
      name: result.user.name,
      username: result.user.username,
      password: result.temporaryPassword,
      siteUrl: appOrigin(request),
    });
  }

  // The password is handed back to the admin only when the email did not go
  // out, so they can pass it on themselves. On success it is never echoed.
  return NextResponse.json({
    result: {
      application: result.application,
      user: result.user,
      email,
      temporaryPassword: email && !email.sent ? result.temporaryPassword : undefined,
    },
  });
}
