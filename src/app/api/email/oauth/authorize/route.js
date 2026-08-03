import { NextResponse } from 'next/server';
import { requireAdmin, sessionCookieOptions } from '@/lib/apiAuth';
import { getAuthorizationUrl, createState, oauthConfigured, oauthConfig, appUrl } from '@/lib/email/microsoftOAuth';

export const dynamic = 'force-dynamic';

export const OAUTH_STATE_COOKIE = 'lhmac_oauth_state';
const STATE_TTL_SECONDS = 600; // the sign-in should not take ten minutes

export async function GET(request) {
  const { response } = requireAdmin();
  if (response) return response;

  const settingsUrl = appUrl('/admin/email/settings/', request.url);

  if (!oauthConfigured()) {
    const { clientId, clientSecret, redirectUri } = oauthConfig();
    const missing = [
      !clientId && 'MICROSOFT_CLIENT_ID',
      !clientSecret && 'MICROSOFT_CLIENT_SECRET',
      !redirectUri && 'MICROSOFT_REDIRECT_URI',
    ].filter(Boolean);

    settingsUrl.searchParams.set('oauth_error', `Microsoft sign-in is not configured. Missing: ${missing.join(', ')}.`);
    return NextResponse.redirect(settingsUrl);
  }

  const { state, nonce } = createState({ purpose: 'connect' });

  // The nonce is echoed back through Microsoft in `state` and compared against
  // this cookie, so a callback that did not originate here is rejected.
  const redirect = NextResponse.redirect(getAuthorizationUrl(state));
  redirect.cookies.set(OAUTH_STATE_COOKIE, nonce, {
    ...sessionCookieOptions(STATE_TTL_SECONDS),
    // Microsoft posts the user back via a cross-site top-level navigation, so
    // the cookie has to survive it. 'lax' does for a GET redirect.
    sameSite: 'lax',
  });
  return redirect;
}
