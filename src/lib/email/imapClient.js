import { ImapFlow } from 'imapflow';

const CONNECT_TIMEOUT_MS = 20000;

/** Builds a connection for a mailbox row that already has a plaintext password. */
export function createImapClient(credentials) {
  return new ImapFlow({
    host: credentials.imap_host,
    port: credentials.imap_port || 993,
    secure: (credentials.imap_port || 993) === 993,
    auth: { user: credentials.username, pass: credentials.password },
    // imapflow logs verbosely at info level; keep the app log readable.
    logger: false,
    socketTimeout: CONNECT_TIMEOUT_MS,
  });
}

/**
 * Runs `fn` with a connected client and always closes the socket, including on
 * error — a leaked IMAP connection counts against the server's per-user limit
 * and eventually locks the mailbox out.
 */
export async function withImap(credentials, fn) {
  const client = createImapClient(credentials);
  await client.connect();
  try {
    return await fn(client);
  } finally {
    try {
      await client.logout();
    } catch {
      client.close();
    }
  }
}

/** Verifies credentials and reports which of the expected folders exist. */
export async function testImapConnection(credentials) {
  try {
    return await withImap(credentials, async (client) => {
      const list = await client.list();
      return {
        ok: true,
        folders: list.map((f) => f.path),
      };
    });
  } catch (error) {
    return { ok: false, error: error.message || 'IMAP connection failed.' };
  }
}

/**
 * Resolves the server's actual folder names.
 *
 * Providers disagree: GoDaddy/cPanel use INBOX.Sent, Gmail uses [Gmail]/Sent
 * Mail. imapflow exposes RFC 6154 special-use flags, which are the reliable
 * way to find them; the name match is a fallback for servers that omit flags.
 */
export async function resolveFolders(client) {
  const list = await client.list();
  const bySpecialUse = (use) => list.find((f) => f.specialUse === use)?.path;
  const byName = (needle) =>
    list.find((f) => f.path.toLowerCase().split(/[./]/).pop() === needle)?.path;

  return {
    INBOX: 'INBOX',
    Sent: bySpecialUse('\\Sent') || byName('sent') || null,
    Drafts: bySpecialUse('\\Drafts') || byName('drafts') || null,
    Trash: bySpecialUse('\\Trash') || byName('trash') || byName('deleted items') || null,
  };
}
