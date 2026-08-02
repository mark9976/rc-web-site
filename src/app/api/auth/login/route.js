import { NextResponse } from 'next/server';
import { getUserByUsername, createSession, serializeUser, upgradeStoredPassword } from '@/lib/photoStorage';
import { verifyPassword, isHashed } from '@/lib/password';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/apiAuth';

function setSessionCookie(response, token) {
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
}

export async function POST(request) {
  const body = await request.json();
  const username = body.username?.toString().trim();
  const password = body.password?.toString();

  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password are required.' }, { status: 400 });
  }

  const user = getUserByUsername(username);
  if (!user || !verifyPassword(password, user.password)) {
    return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 });
  }

  // Accounts predating password hashing are upgraded once they sign in successfully.
  if (!isHashed(user.password)) {
    upgradeStoredPassword(user.id, password);
  }

  // A real session is issued even for a forced reset, so the reset page can prove
  // who is resetting after a refresh instead of relying on in-memory state.
  const token = createSession(user.id);
  // The token is returned in the body as well as the cookie: the iOS app cannot
  // use cookies, so it reads `token` here and sends it as a Bearer header. The
  // website ignores it and keeps using the httpOnly cookie.
  const response = user.needsPasswordReset
    ? NextResponse.json({ needsPasswordReset: true, userId: user.id, token })
    : NextResponse.json({ user: serializeUser(user), token });
  setSessionCookie(response, token);
  return response;
}
