import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { requireAdmin, sessionCookieOptions } from '@/lib/apiAuth';
import { exchangeCodeForTokens, parseState, appUrl } from '@/lib/email/microsoftOAuth';
import { upsertOAuth2Mailbox, getMailboxCredentials, markMailboxNeedsReauth } from '@/lib/email/emailStore';
import { testImapConnection } from '@/lib/email/imapClient';
import { OAUTH_STATE_COOKIE } from '@/app/api/email/oauth/authorize/route';

export const dynamic = 'force-dynamic';

function backToSettings(request, params) {
  const url = appUrl('/admin/email/settings/', request.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const response = NextResponse.redirect(url);
  // The state nonce is single-use.
  response.cookies.set(OAUTH_STATE_COOKIE, '', sessionCookieOptions(0));
  return response;
}

export async function GET(request) {
  // Still admin-only: the callback creates a mailbox.
  const { response } = requireAdmin();
  if (response) return response;

  const params = new URL(request.url).searchParams;

  // Microsoft reports a refused consent here rather than by failing the request.
  const providerError = params.get('error');
  if (providerError) {
    const detail = params.get('error_description')?.split('\r\n')[0] || providerError;
    return backToSettings(request, { oauth_error: detail });
  }

  const code = params.get('code');
  const state = params.get('state');
  if (!code || !state) {
    return backToSettings(request, { oauth_error: 'Microsoft did not return an authorization code.' });
  }

  const parsed = parseState(state);
  const expectedNonce = cookies().get(OAUTH_STATE_COOKIE)?.value;
  if (!parsed?.nonce || !expectedNonce || parsed.nonce !== expectedNonce) {
    return backToSettings(request, {
      oauth_error: 'Sign-in could not be verified. Start the connection again from this page.',
    });
  }

  let tokens;
  try {
    tokens = await exchangeCodeForTokens(code);
  } catch (error) {
    return backToSettings(request, { oauth_error: `Microsoft rejected the sign-in: ${error.message}` });
  }

  const email = tokens.claims?.preferred_username || tokens.claims?.email || tokens.claims?.upn;
  if (!email) {
    return backToSettings(request, { oauth_error: 'Microsoft did not return an email address for this account.' });
  }
  if (!tokens.refreshToken) {
    // Without offline_access the connection would silently die in an hour.
    return backToSettings(request, {
      oauth_error: 'Microsoft did not return a refresh token. Add the offline_access permission to the app registration, then reconnect.',
    });
  }

  const { mailbox, created } = upsertOAuth2Mailbox({
    email,
    displayName: tokens.claims?.name || email,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
  });

  // Prove the token actually works for IMAP before calling it connected —
  // consent can succeed while the scopes are wrong.
  const credentials = getMailboxCredentials(mailbox.id);
  const test = await testImapConnection({ ...credentials, accessToken: tokens.accessToken });
  if (!test.ok) {
    markMailboxNeedsReauth(mailbox.id, `Connected, but IMAP was refused: ${test.error}`);
    return backToSettings(request, {
      oauth_error: `${email} was saved, but IMAP was refused: ${test.error}. Check that the app registration uses the outlook.office365.com scopes.`,
    });
  }

  return backToSettings(request, {
    oauth_success: `${email} ${created ? 'connected' : 'reconnected'}.`,
  });
}
