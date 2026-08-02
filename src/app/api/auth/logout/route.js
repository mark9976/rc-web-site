import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { deleteSession } from '@/lib/photoStorage';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function POST() {
  const sessionToken = cookies().get(SESSION_COOKIE)?.value;
  if (sessionToken) {
    deleteSession(sessionToken);
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE, '', sessionCookieOptions(0));
  return response;
}
