import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getSession, getUserById, serializeUser } from '@/lib/photoStorage';
import { SESSION_COOKIE } from '@/lib/apiAuth';

export async function GET() {
  const sessionToken = cookies().get(SESSION_COOKIE)?.value;
  if (!sessionToken) {
    return NextResponse.json({ user: null });
  }

  const session = getSession(sessionToken);
  if (!session) {
    return NextResponse.json({ user: null });
  }

  const user = getUserById(session.userId);
  if (!user) {
    return NextResponse.json({ user: null });
  }

  // An account still owing a password reset is not treated as signed in; the
  // session exists only so the reset page knows whose password to change.
  if (user.needsPasswordReset) {
    return NextResponse.json({ user: null, pendingReset: true });
  }

  return NextResponse.json({ user: serializeUser(user) });
}
