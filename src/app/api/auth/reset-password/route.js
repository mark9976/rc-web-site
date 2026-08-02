import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createSession, getSession, getUserById, updateUserPassword, serializeUser } from '@/lib/photoStorage';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/apiAuth';

function setSessionCookie(response, token) {
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
}

export async function POST(request) {
  const body = await request.json();
  const password = body.password?.toString();

  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'Choose a password of at least 8 characters.' }, { status: 400 });
  }

  // The account being reset comes from the session issued at login, never from the
  // request body — otherwise anyone could reset any account still pending a reset.
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = token ? getSession(token) : null;
  if (!session) {
    return NextResponse.json({ error: 'Sign in again to reset your password.' }, { status: 401 });
  }

  const user = getUserById(session.userId);
  if (!user || !user.needsPasswordReset) {
    return NextResponse.json({ error: 'Password reset is not allowed for this account.' }, { status: 400 });
  }

  updateUserPassword(user.id, password);
  const freshToken = createSession(user.id);
  const response = NextResponse.json({
    user: serializeUser({ ...user, needsPasswordReset: 0 }),
  });
  setSessionCookie(response, freshToken);
  return response;
}
