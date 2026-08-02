import { simpleParser } from 'mailparser';
import { withImap, resolveFolders } from '@/lib/email/imapClient';
import { computeThreadId, parseReferences } from '@/lib/email/threadUtils';
import {
  listMailboxes,
  getMailboxCredentials,
  insertMessage,
  highestUid,
  recordHighestUid,
  isTombstoned,
  recordSyncResult,
} from '@/lib/email/emailStore';

const INITIAL_SYNC_DAYS = 90;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const SNIPPET_LENGTH = 200;

// One sync per mailbox at a time. A slow IMAP fetch can outlast the cron
// interval, and two overlapping syncs would fight over the same UIDs.
const inFlight = new Set();

function addressList(value) {
  if (!value?.value) return [];
  return value.value.filter((a) => a.address).map((a) => (a.name ? `${a.name} <${a.address}>` : a.address));
}

function makeSnippet(text, html) {
  const source =
    text ||
    String(html || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ');
  return source.replace(/\s+/g, ' ').trim().slice(0, SNIPPET_LENGTH);
}

/** Turns a parsed message into our row shape. */
function toRow(parsed, { mailboxId, folder, uid, seen }) {
  const references = parseReferences(parsed.references);
  const messageId = parsed.messageId || `<generated-${uid}-${folder}@lhmac.local>`;
  const from = parsed.from?.value?.[0] ?? {};

  return {
    mailbox_id: mailboxId,
    message_id: messageId,
    uid,
    folder,
    from_address: from.address || 'unknown@unknown',
    from_name: from.name || null,
    to_addresses: addressList(parsed.to),
    cc_addresses: addressList(parsed.cc),
    bcc_addresses: addressList(parsed.bcc),
    subject: parsed.subject || '(no subject)',
    body_text: parsed.text || null,
    body_html: parsed.html || null,
    snippet: makeSnippet(parsed.text, parsed.html),
    // Sent mail is never "unread" to us, and the IMAP \Seen flag drives the rest.
    is_read: folder === 'Sent' ? true : Boolean(seen),
    is_starred: false,
    is_draft: folder === 'Drafts',
    in_reply_to: parsed.inReplyTo || null,
    references_header: references,
    thread_id: computeThreadId({
      messageId,
      inReplyTo: parsed.inReplyTo,
      references,
      subject: parsed.subject,
    }),
    sent_at: (parsed.date || new Date()).toISOString(),
  };
}

function toAttachments(parsed) {
  return (parsed.attachments || [])
    .filter((a) => a.content && a.size <= MAX_ATTACHMENT_BYTES)
    .map((a) => ({
      filename: a.filename || 'attachment',
      contentType: a.contentType || 'application/octet-stream',
      size: a.size ?? a.content.length,
      content: a.content,
      contentId: a.cid || null,
    }));
}

async function syncFolder(client, { mailboxId, remotePath, localFolder }) {
  const lock = await client.getMailboxLock(remotePath);
  let stored = 0;

  try {
    const lastUid = highestUid(mailboxId, localFolder);

    // First run pulls a bounded window of history; later runs pull only what is
    // newer than the highest UID we already hold.
    let range;
    if (lastUid > 0) {
      range = `${lastUid + 1}:*`;
    } else {
      const since = new Date();
      since.setDate(since.getDate() - INITIAL_SYNC_DAYS);
      const uids = await client.search({ since }, { uid: true });
      if (!uids || uids.length === 0) return 0;
      range = uids.join(',');
    }

    for await (const message of client.fetch(range, { uid: true, source: true, flags: true }, { uid: true })) {
      // A `n:*` range always returns at least one message even when nothing is
      // new, so skip anything we have already stored.
      if (lastUid > 0 && message.uid <= lastUid) continue;

      try {
        const parsed = await simpleParser(message.source);
        const row = toRow(parsed, {
          mailboxId,
          folder: localFolder,
          uid: message.uid,
          seen: message.flags?.has('\\Seen'),
        });

        // Something the admin deleted here must not reappear, even if the copy
        // on the server outlived the delete.
        if (isTombstoned(mailboxId, row.message_id)) {
          recordHighestUid(mailboxId, localFolder, message.uid);
          continue;
        }

        if (insertMessage(row, toAttachments(parsed))) stored += 1;
      } catch (parseError) {
        // One malformed message must not abort the whole folder.
        console.error(`[email] failed to parse uid ${message.uid} in ${remotePath}:`, parseError.message);
      }

      // Advance the mark for every UID seen, including ones we skipped, so a
      // message that fails to parse is not retried forever.
      recordHighestUid(mailboxId, localFolder, message.uid);
    }
  } finally {
    lock.release();
  }

  return stored;
}

/** Syncs INBOX and Sent for one mailbox. Never throws; errors are recorded. */
export async function syncMailbox(mailboxId) {
  if (inFlight.has(mailboxId)) {
    return { skipped: true, reason: 'A sync is already running for this mailbox.' };
  }
  inFlight.add(mailboxId);

  try {
    const credentials = getMailboxCredentials(mailboxId);
    if (!credentials) return { ok: false, error: 'Mailbox not found.' };

    const result = await withImap(credentials, async (client) => {
      const folders = await resolveFolders(client);
      const counts = {};

      counts.INBOX = await syncFolder(client, { mailboxId, remotePath: 'INBOX', localFolder: 'INBOX' });
      if (folders.Sent) {
        counts.Sent = await syncFolder(client, { mailboxId, remotePath: folders.Sent, localFolder: 'Sent' });
      }
      return counts;
    });

    recordSyncResult(mailboxId, { error: null });
    return { ok: true, stored: result };
  } catch (error) {
    const message = error.message || 'Sync failed.';
    console.error(`[email] sync failed for mailbox ${mailboxId}:`, message);
    recordSyncResult(mailboxId, { error: message });
    return { ok: false, error: message };
  } finally {
    inFlight.delete(mailboxId);
  }
}

/**
 * Removes a message from the IMAP server.
 *
 * Without this the message survives on the server, so it stays visible in any
 * other mail client and can be pulled back by a later sync. Best-effort: the
 * local tombstone already guarantees it stays gone from this UI, so a failure
 * here is logged rather than surfaced as an error.
 */
export async function deleteOnServer(target) {
  // A message we only hold locally (a draft, or our own copy of a sent mail)
  // has no UID on the server side worth chasing.
  if (!target?.uid || !target.mailbox_id) return { ok: false, reason: 'No server copy to delete.' };

  try {
    // Inside the try: decrypting the stored password can throw, and that must
    // not turn an already-successful local delete into a failed request.
    const credentials = getMailboxCredentials(target.mailbox_id);
    if (!credentials) return { ok: false, reason: 'Mailbox not found.' };

    return await withImap(credentials, async (client) => {
      const folders = await resolveFolders(client);
      const remotePath = target.folder === 'Sent' ? folders.Sent : 'INBOX';
      if (!remotePath) return { ok: false, reason: 'Folder not found on server.' };

      const lock = await client.getMailboxLock(remotePath);
      try {
        // Prefer moving to the server's Trash so it is recoverable there;
        // fall back to a flag-and-expunge if the server has no Trash folder.
        if (folders.Trash && target.folder !== 'Trash') {
          await client.messageMove(String(target.uid), folders.Trash, { uid: true });
        } else {
          await client.messageDelete(String(target.uid), { uid: true });
        }
        return { ok: true };
      } finally {
        lock.release();
      }
    });
  } catch (error) {
    console.error(`[email] could not delete uid ${target.uid} on the server:`, error.message);
    return { ok: false, reason: error.message };
  }
}

export async function syncAllMailboxes() {
  const results = {};
  for (const mailbox of listMailboxes()) {
    results[mailbox.id] = await syncMailbox(mailbox.id);
  }
  return results;
}
