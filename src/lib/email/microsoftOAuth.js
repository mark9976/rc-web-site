import crypto from 'node:crypto';
import { getMailboxOAuth, updateMailboxTokens, markMailboxNeedsReauth } from '@/lib/email/emailStore';

// "common" rather than a tenant id, so the app registration works multi-tenant.
const AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

/**
 * IMAP and SMTP scopes must be the outlook.office365.com ones. The equivalent
 * graph.microsoft.com scopes look right, are granted happily, and then fail at
 * IMAP AUTHENTICATE — the single most common way to get this wrong.
 */
const SCOPES = [
  'https://outlook.office365.com/IMAP.AccessAsUser.All',
  'https://outlook.office365.com/SMTP.Send',
  'offline_access',
  'openid',
  'email',
  'profile',
];

// Refresh this far before actual expiry, so a token cannot lapse mid-sync.
const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

export function oauthConfig() {
  return {
    clientId: process.env.MICROSOFT_CLIENT_ID || '',
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
    redirectUri: process.env.MICROSOFT_REDIRECT_URI || '',
  };
}

export function oauthConfigured() {
  const { clientId, clientSecret, redirectUri } = oauthConfig();
  return Boolean(clientId && clientSecret && redirectUri);
}

/**
 * Problems with MICROSOFT_REDIRECT_URI that Entra will reject, reported before
 * the admin is bounced out to Microsoft only to hit AADSTS50011.
 */
export function redirectUriProblem() {
  const { redirectUri } = oauthConfig();
  if (!redirectUri) return null;

  let url;
  try {
    url = new URL(redirectUri);
  } catch {
    return 'MICROSOFT_REDIRECT_URI is not a valid URL.';
  }

  const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  // Entra permits http only for localhost; anything else must be https.
  if (url.protocol === 'http:' && !isLocalhost) {
    return `MICROSOFT_REDIRECT_URI uses http. Microsoft only accepts https (localhost excepted), so this will fail with AADSTS50011. Use https://${url.host}${url.pathname}.`;
  }
  if (!url.pathname.endsWith('/api/email/oauth/callback')) {
    return `MICROSOFT_REDIRECT_URI should end in /api/email/oauth/callback, but is ${url.pathname}.`;
  }
  if (redirectUri.endsWith('/')) {
    return 'MICROSOFT_REDIRECT_URI has a trailing slash. Microsoft matches it byte for byte; remove it.';
  }
  return null;
}

/**
 * Builds an absolute URL back into this app.
 *
 * Derived from MICROSOFT_REDIRECT_URI rather than `request.url`: behind nginx
 * the request URL resolves to the server's own origin (localhost), which would
 * bounce the admin somewhere unreachable after connecting. The redirect URI is
 * by definition the externally-reachable address, since Microsoft has to be
 * able to call it.
 */
export function appUrl(path, fallbackBase) {
  const { redirectUri } = oauthConfig();
  try {
    return new URL(path, new URL(redirectUri).origin);
  } catch {
    return new URL(path, fallbackBase);
  }
}

/** Opaque value tying the callback to the browser that started the flow. */
export function createState(payload = {}) {
  const nonce = crypto.randomBytes(16).toString('hex');
  const state = Buffer.from(JSON.stringify({ ...payload, nonce })).toString('base64url');
  return { state, nonce };
}

export function parseState(state) {
  try {
    return JSON.parse(Buffer.from(state, 'base64url').toString());
  } catch {
    return null;
  }
}

export function getAuthorizationUrl(state) {
  const { clientId, redirectUri } = oauthConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    response_mode: 'query',
    scope: SCOPES.join(' '),
    state,
    // Forces the consent screen so offline_access is definitely granted; without
    // it a previously-consented account can come back with no refresh token.
    prompt: 'consent',
  });
  return `${AUTH_URL}?${params.toString()}`;
}

/** The id_token comes straight from Microsoft over TLS, so it is read, not verified. */
export function parseIdToken(idToken) {
  try {
    const payload = idToken?.split('.')[1];
    if (!payload) return null;
    return JSON.parse(Buffer.from(payload, 'base64url').toString());
  } catch {
    return null;
  }
}

async function postToken(body) {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    // Microsoft puts the useful detail in error_description.
    const detail = data.error_description || data.error || `HTTP ${response.status}`;
    throw new Error(String(detail).split('\r\n')[0]);
  }
  return data;
}

export async function exchangeCodeForTokens(code) {
  const { clientId, clientSecret, redirectUri } = oauthConfig();
  const data = await postToken({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || null,
    expiresAt: new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString(),
    claims: parseIdToken(data.id_token),
  };
}

export async function refreshAccessToken(refreshToken) {
  const { clientId, clientSecret } = oauthConfig();
  const data = await postToken({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    scope: SCOPES.join(' '),
  });

  return {
    accessToken: data.access_token,
    // Microsoft rotates refresh tokens; keep the new one when offered, and fall
    // back to the existing one when it reuses it.
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString(),
  };
}

/**
 * In-flight refreshes, keyed by mailbox.
 *
 * Sync, send and the scheduler can all want a token at once. Because Microsoft
 * invalidates the old refresh token when it issues a new one, two concurrent
 * refreshes would race and one would persist a token that is already dead,
 * locking the mailbox out. Callers share a single refresh instead.
 */
const inFlight = new Map();

/**
 * A usable access token for an OAuth2 mailbox, refreshing if needed.
 * Throws when the grant is gone; the mailbox is flagged for reconnection.
 */
export async function getValidAccessToken(mailbox) {
  const stored = getMailboxOAuth(mailbox.id);
  if (!stored) throw new Error('Mailbox not found.');
  if (stored.auth_type !== 'oauth2') throw new Error('Mailbox does not use OAuth2.');

  const expiresAt = stored.oauth_token_expiry ? Date.parse(stored.oauth_token_expiry) : 0;
  const stillFresh = stored.access_token && expiresAt - EXPIRY_BUFFER_MS > Date.now();
  if (stillFresh) return stored.access_token;

  if (inFlight.has(mailbox.id)) return inFlight.get(mailbox.id);

  const refresh = (async () => {
    if (!stored.refresh_token) {
      markMailboxNeedsReauth(mailbox.id, 'No refresh token stored. Reconnect the mailbox.');
      throw new Error('No refresh token stored. Reconnect the mailbox.');
    }

    try {
      const tokens = await refreshAccessToken(stored.refresh_token);
      updateMailboxTokens(mailbox.id, tokens);
      return tokens.accessToken;
    } catch (error) {
      markMailboxNeedsReauth(mailbox.id, error.message);
      throw error;
    } finally {
      inFlight.delete(mailbox.id);
    }
  })();

  inFlight.set(mailbox.id, refresh);
  return refresh;
}

export { SCOPES };
