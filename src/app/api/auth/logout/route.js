import { NextResponse } from 'next/server';
import { deleteSession } from '@/lib/photoStorage';
import { SESSION_COOKIE, sessionCookieOptions, getSessionToken } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function POST() {
  // Resolves a Bearer token as well as the cookie: the app has no cookie, and
  // reading only the cookie would leave its session valid after sign-out.
  const sessionToken = getSessionToken();
  if (sessionToken) {
    deleteSession(sessionToken);
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE, '', sessionCookieOptions(0));
  return response;
}
