import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { getSession, getUserById, serializeUser } from '@/lib/photoStorage';

export const SESSION_COOKIE = 'lhmac_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

/**
 * Cookie options for the session.
 *
 * `secure` is decided by the protocol the browser actually used, not by
 * NODE_ENV: the club site is served over plain HTTP on the LAN, and a Secure
 * cookie is silently dropped by the browser there, which logs everyone out on
 * their next request. nginx passes the real scheme in X-Forwarded-Proto.
 */
export function sessionCookieOptions(maxAge = SESSION_MAX_AGE) {
  const forwardedProto = headers().get('x-forwarded-proto');
  const isHttps = (forwardedProto || '').split(',')[0].trim() === 'https';

  return {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: isHttps,
    maxAge,
  };
}

/**
 * Returns the signed-in user for the current request, or null.
 *
 * An account that still owes a forced password reset is deliberately treated as
 * not signed in: login issues it a session only so the reset page knows whose
 * password to change, and it must not grant access to anything else.
 */
export function getCurrentUser() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = getSession(token);
  if (!session) return null;

  const user = getUserById(session.userId);
  if (!user || user.needsPasswordReset) return null;

  return serializeUser(user);
}

/**
 * Route guards. Each returns { user } on success or { response } holding the
 * error to return, so routes can early-out with a single check.
 */
export function requireUser() {
  const user = getCurrentUser();
  if (!user) {
    return { response: NextResponse.json({ error: 'Sign in required.' }, { status: 401 }) };
  }
  return { user };
}

export function requireAdmin() {
  const user = getCurrentUser();
  if (!user) {
    return { response: NextResponse.json({ error: 'Sign in required.' }, { status: 401 }) };
  }
  if (user.role !== 'admin') {
    return { response: NextResponse.json({ error: 'Admin access required.' }, { status: 403 }) };
  }
  return { user };
}
