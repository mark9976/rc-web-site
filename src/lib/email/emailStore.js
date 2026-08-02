import { emailDb } from '@/lib/email/setupEmailDb';
import { encrypt, decrypt } from '@/lib/email/encryption';
// The club roster lives in the site database, not the email one.
import { getUsers } from '@/lib/photoStorage';

const json = (value) => (value ? JSON.stringify(value) : null);
const unjson = (value, fallback = []) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

/* ─────────────────────────── mailboxes ─────────────────────────── */

// The password column never leaves this module in plaintext except through
// getMailboxCredentials, which the IMAP/SMTP clients use.
const MAILBOX_PUBLIC =
  'id, email_address, display_name, imap_host, imap_port, smtp_host, smtp_port, username, is_default, last_sync_at, last_sync_error, created_at';

export function listMailboxes() {
  return emailDb().prepare(`SELECT ${MAILBOX_PUBLIC} FROM email_mailboxes ORDER BY is_default DESC, display_name ASC`).all();
}

export function getMailbox(id) {
  return emailDb().prepare(`SELECT ${MAILBOX_PUBLIC} FROM email_mailboxes WHERE id = ?`).get(id);
}

export function getDefaultMailbox() {
  return (
    emailDb().prepare(`SELECT ${MAILBOX_PUBLIC} FROM email_mailboxes ORDER BY is_default DESC, id ASC LIMIT 1`).get() ?? null
  );
}

/** Includes the decrypted password. Server-side callers only. */
export function getMailboxCredentials(id) {
  const row = emailDb().prepare('SELECT * FROM email_mailboxes WHERE id = ?').get(id);
  if (!row) return null;
  return { ...row, password: decrypt(row.password) };
}

function clearOtherDefaults(db, keepId) {
  db.prepare('UPDATE email_mailboxes SET is_default = 0 WHERE id != ?').run(keepId);
}

export function createMailbox(data) {
  const db = emailDb();
  const info = db
    .prepare(
      `INSERT INTO email_mailboxes
       (email_address, display_name, imap_host, imap_port, smtp_host, smtp_port, username, password, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      data.email_address,
      data.display_name,
      data.imap_host,
      data.imap_port ?? 993,
      data.smtp_host,
      data.smtp_port ?? 465,
      data.username,
      encrypt(data.password),
      data.is_default ? 1 : 0
    );

  if (data.is_default) clearOtherDefaults(db, info.lastInsertRowid);
  return getMailbox(info.lastInsertRowid);
}

export function updateMailbox(id, data) {
  const db = emailDb();
  const existing = db.prepare('SELECT * FROM email_mailboxes WHERE id = ?').get(id);
  if (!existing) return null;

  db.prepare(
    `UPDATE email_mailboxes SET
       email_address = ?, display_name = ?, imap_host = ?, imap_port = ?,
       smtp_host = ?, smtp_port = ?, username = ?, password = ?, is_default = ?
     WHERE id = ?`
  ).run(
    data.email_address ?? existing.email_address,
    data.display_name ?? existing.display_name,
    data.imap_host ?? existing.imap_host,
    data.imap_port ?? existing.imap_port,
    data.smtp_host ?? existing.smtp_host,
    data.smtp_port ?? existing.smtp_port,
    data.username ?? existing.username,
    // An empty password field means "leave it alone" rather than "blank it".
    data.password ? encrypt(data.password) : existing.password,
    data.is_default ? 1 : 0,
    id
  );

  if (data.is_default) clearOtherDefaults(db, id);
  return getMailbox(id);
}

export function deleteMailbox(id) {
  return emailDb().prepare('DELETE FROM email_mailboxes WHERE id = ?').run(id);
}

export function recordSyncResult(id, { error = null } = {}) {
  emailDb()
    .prepare('UPDATE email_mailboxes SET last_sync_at = ?, last_sync_error = ? WHERE id = ?')
    .run(new Date().toISOString(), error, id);
}

/* ─────────────────────────── messages ─────────────────────────── */

// Bodies are excluded from list queries; a 50-message page would otherwise pull
// megabytes of HTML for previews that only need the snippet.
const MESSAGE_LIST_COLUMNS = `
  id, mailbox_id, message_id, uid, folder, from_address, from_name,
  to_addresses, cc_addresses, subject, snippet, has_attachments,
  is_read, is_starred, is_draft, thread_id, sent_at`;

function hydrate(row) {
  if (!row) return row;
  return {
    ...row,
    to_addresses: unjson(row.to_addresses),
    cc_addresses: unjson(row.cc_addresses),
    bcc_addresses: unjson(row.bcc_addresses),
    references_header: unjson(row.references_header),
    has_attachments: Boolean(row.has_attachments),
    is_read: Boolean(row.is_read),
    is_starred: Boolean(row.is_starred),
    is_draft: Boolean(row.is_draft),
  };
}

export function listMessages({ mailboxId, folder = 'INBOX', page = 1, limit = 50, search = '' }) {
  const offset = (Math.max(1, page) - 1) * limit;
  const params = [mailboxId, folder];
  let where = 'mailbox_id = ? AND folder = ?';

  if (search) {
    where += ' AND (subject LIKE ? OR from_address LIKE ? OR from_name LIKE ? OR snippet LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }

  const rows = emailDb()
    .prepare(`SELECT ${MESSAGE_LIST_COLUMNS} FROM email_messages WHERE ${where} ORDER BY sent_at DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset);

  const total = emailDb().prepare(`SELECT COUNT(*) AS c FROM email_messages WHERE ${where}`).get(...params).c;

  return { messages: rows.map(hydrate), total, page, limit, hasMore: offset + rows.length < total };
}

export function getMessage(id) {
  const row = emailDb().prepare('SELECT * FROM email_messages WHERE id = ?').get(id);
  if (!row) return null;

  const attachments = emailDb()
    .prepare('SELECT id, filename, content_type, size, content_id FROM email_attachments WHERE message_id = ?')
    .all(id);

  return { ...hydrate(row), attachments };
}

export function getThread(threadId) {
  const rows = emailDb()
    .prepare('SELECT * FROM email_messages WHERE thread_id = ? ORDER BY sent_at ASC')
    .all(threadId);
  return rows.map(hydrate);
}

export function updateMessageFlags(id, { is_read, is_starred }) {
  const sets = [];
  const params = [];
  if (is_read !== undefined) { sets.push('is_read = ?'); params.push(is_read ? 1 : 0); }
  if (is_starred !== undefined) { sets.push('is_starred = ?'); params.push(is_starred ? 1 : 0); }
  if (sets.length === 0) return getMessage(id);

  emailDb().prepare(`UPDATE email_messages SET ${sets.join(', ')} WHERE id = ?`).run(...params, id);
  return getMessage(id);
}

/** First delete moves to Trash; deleting from Trash removes it for good. */
export function deleteMessage(id) {
  const db = emailDb();
  const row = db.prepare('SELECT folder FROM email_messages WHERE id = ?').get(id);
  if (!row) return { deleted: false };

  if (row.folder === 'Trash') {
    db.prepare('DELETE FROM email_messages WHERE id = ?').run(id);
    return { deleted: true, permanent: true };
  }

  db.prepare("UPDATE email_messages SET folder = 'Trash' WHERE id = ?").run(id);
  return { deleted: true, permanent: false };
}

export function getAttachment(messageId, attachmentId) {
  return emailDb()
    .prepare('SELECT * FROM email_attachments WHERE id = ? AND message_id = ?')
    .get(attachmentId, messageId);
}

export function folderCounts(mailboxId) {
  const rows = emailDb()
    .prepare(
      `SELECT folder, COUNT(*) AS total, SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) AS unread
       FROM email_messages WHERE mailbox_id = ? GROUP BY folder`
    )
    .all(mailboxId);

  const counts = {};
  for (const row of rows) counts[row.folder] = { total: row.total, unread: row.unread || 0 };
  return counts;
}

/** Drives the navigation badge: unread across every mailbox, inbox only. */
export function totalUnreadCount() {
  const row = emailDb()
    .prepare("SELECT COUNT(*) AS c FROM email_messages WHERE is_read = 0 AND folder = 'INBOX'")
    .get();
  return row?.c ?? 0;
}

export function unreadByMailbox() {
  return emailDb()
    .prepare(
      `SELECT mailbox_id, COUNT(*) AS unread FROM email_messages
       WHERE is_read = 0 AND folder = 'INBOX' GROUP BY mailbox_id`
    )
    .all();
}

export function messageExists(mailboxId, messageId) {
  return Boolean(
    emailDb().prepare('SELECT 1 FROM email_messages WHERE mailbox_id = ? AND message_id = ?').get(mailboxId, messageId)
  );
}

export function highestUid(mailboxId, folder) {
  const row = emailDb()
    .prepare('SELECT MAX(uid) AS uid FROM email_messages WHERE mailbox_id = ? AND folder = ?')
    .get(mailboxId, folder);
  return row?.uid ?? 0;
}

export function insertMessage(message, attachments = []) {
  const db = emailDb();

  return db.transaction(() => {
    const info = db
      .prepare(
        `INSERT OR IGNORE INTO email_messages
         (mailbox_id, message_id, uid, folder, from_address, from_name, to_addresses, cc_addresses,
          bcc_addresses, subject, body_text, body_html, snippet, has_attachments, is_read, is_starred,
          is_draft, in_reply_to, references_header, thread_id, sent_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        message.mailbox_id,
        message.message_id,
        message.uid ?? null,
        message.folder,
        message.from_address,
        message.from_name ?? null,
        json(message.to_addresses) ?? '[]',
        json(message.cc_addresses),
        json(message.bcc_addresses),
        message.subject ?? null,
        message.body_text ?? null,
        message.body_html ?? null,
        message.snippet ?? null,
        attachments.length > 0 ? 1 : 0,
        message.is_read ? 1 : 0,
        message.is_starred ? 1 : 0,
        message.is_draft ? 1 : 0,
        message.in_reply_to ?? null,
        json(message.references_header),
        message.thread_id,
        message.sent_at
      );

    if (info.changes === 0) return null; // already synced

    const rowId = info.lastInsertRowid;
    const insertAttachment = db.prepare(
      'INSERT INTO email_attachments (message_id, filename, content_type, size, content, content_id) VALUES (?,?,?,?,?,?)'
    );
    for (const a of attachments) {
      insertAttachment.run(rowId, a.filename, a.contentType, a.size, a.content, a.contentId ?? null);
    }

    return rowId;
  })();
}

/* ─────────────────────────── contacts ─────────────────────────── */

export function listContacts({ type, search } = {}) {
  let where = '1 = 1';
  const params = [];
  if (type && type !== 'all') { where += ' AND contact_type = ?'; params.push(type); }
  if (search) {
    where += ' AND (email LIKE ? OR first_name LIKE ? OR last_name LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like);
  }

  return emailDb()
    .prepare(`SELECT * FROM email_contacts WHERE ${where} ORDER BY last_name, first_name, email`)
    .all(...params)
    .map((c) => ({ ...c, tags: unjson(c.tags) }));
}

export function getContact(id) {
  const row = emailDb().prepare('SELECT * FROM email_contacts WHERE id = ?').get(id);
  return row ? { ...row, tags: unjson(row.tags) } : null;
}

export function upsertContact(data) {
  const db = emailDb();
  const email = String(data.email).trim().toLowerCase();

  db.prepare(
    `INSERT INTO email_contacts (email, first_name, last_name, contact_type, member_id, tags, notes, updated_at)
     VALUES (?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
     ON CONFLICT(email) DO UPDATE SET
       first_name = excluded.first_name,
       last_name = excluded.last_name,
       contact_type = excluded.contact_type,
       member_id = COALESCE(excluded.member_id, email_contacts.member_id),
       tags = excluded.tags,
       notes = excluded.notes,
       updated_at = CURRENT_TIMESTAMP`
  ).run(
    email,
    data.first_name ?? null,
    data.last_name ?? null,
    data.contact_type ?? 'external',
    data.member_id ?? null,
    json(data.tags),
    data.notes ?? null
  );

  return emailDb().prepare('SELECT * FROM email_contacts WHERE email = ?').get(email);
}

export function updateContact(id, data) {
  const existing = getContact(id);
  if (!existing) return null;

  emailDb()
    .prepare(
      `UPDATE email_contacts SET email = ?, first_name = ?, last_name = ?, contact_type = ?,
       tags = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    )
    .run(
      (data.email ?? existing.email).trim().toLowerCase(),
      data.first_name ?? existing.first_name,
      data.last_name ?? existing.last_name,
      data.contact_type ?? existing.contact_type,
      json(data.tags ?? existing.tags),
      data.notes ?? existing.notes,
      id
    );
  return getContact(id);
}

export function deleteContact(id) {
  return emailDb().prepare('DELETE FROM email_contacts WHERE id = ?').run(id);
}

/**
 * Pulls the club roster in as internal contacts.
 *
 * The roster lives in the site database and contacts live here, so the members
 * are read through photoStorage rather than joined in SQL — the two files are
 * separate connections.
 */
export function syncMembersToContacts() {
  const db = emailDb();
  const members = getUsers().filter((member) => member.email && member.email.trim());

  let added = 0;
  let updated = 0;

  const tx = db.transaction(() => {
    for (const member of members) {
      const email = member.email.trim().toLowerCase();
      const existing = db.prepare('SELECT id FROM email_contacts WHERE email = ?').get(email);
      const [first, ...rest] = (member.name || '').split(' ');

      upsertContact({
        email,
        first_name: first || null,
        last_name: rest.join(' ') || null,
        contact_type: 'internal',
        member_id: member.id,
        tags: ['member'],
      });

      if (existing) updated += 1;
      else added += 1;
    }
  });
  tx();

  return { added, updated, total: members.length };
}

/* ─────────────────────────── groups ─────────────────────────── */

export function listGroups() {
  return emailDb()
    .prepare(
      `SELECT g.*, COUNT(gm.contact_id) AS member_count
       FROM email_groups g LEFT JOIN email_group_members gm ON gm.group_id = g.id
       GROUP BY g.id ORDER BY g.name`
    )
    .all();
}

export function getGroup(id) {
  const group = emailDb().prepare('SELECT * FROM email_groups WHERE id = ?').get(id);
  if (!group) return null;

  const members = emailDb()
    .prepare(
      `SELECT c.* FROM email_contacts c
       JOIN email_group_members gm ON gm.contact_id = c.id
       WHERE gm.group_id = ? ORDER BY c.last_name, c.first_name, c.email`
    )
    .all(id)
    .map((c) => ({ ...c, tags: unjson(c.tags) }));

  return { ...group, members };
}

export function createGroup({ name, description }) {
  const info = emailDb().prepare('INSERT INTO email_groups (name, description) VALUES (?, ?)').run(name, description ?? null);
  return getGroup(info.lastInsertRowid);
}

export function updateGroup(id, { name, description }) {
  emailDb().prepare('UPDATE email_groups SET name = COALESCE(?, name), description = ? WHERE id = ?').run(name, description ?? null, id);
  return getGroup(id);
}

export function deleteGroup(id) {
  return emailDb().prepare('DELETE FROM email_groups WHERE id = ?').run(id);
}

export function addContactsToGroup(groupId, contactIds) {
  const db = emailDb();
  const stmt = db.prepare('INSERT OR IGNORE INTO email_group_members (group_id, contact_id) VALUES (?, ?)');
  db.transaction(() => contactIds.forEach((id) => stmt.run(groupId, id)))();
  return getGroup(groupId);
}

export function removeContactFromGroup(groupId, contactId) {
  return emailDb().prepare('DELETE FROM email_group_members WHERE group_id = ? AND contact_id = ?').run(groupId, contactId);
}

/* ─────────────────────────── templates ─────────────────────────── */

export function listTemplates() {
  return emailDb()
    .prepare('SELECT * FROM email_templates ORDER BY name')
    .all()
    .map((t) => ({ ...t, merge_fields: unjson(t.merge_fields) }));
}

export function getTemplate(id) {
  const row = emailDb().prepare('SELECT * FROM email_templates WHERE id = ?').get(id);
  return row ? { ...row, merge_fields: unjson(row.merge_fields) } : null;
}

export function createTemplate(data) {
  const info = emailDb()
    .prepare('INSERT INTO email_templates (name, subject, body_html, merge_fields) VALUES (?,?,?,?)')
    .run(data.name, data.subject, data.body_html, json(data.merge_fields));
  return getTemplate(info.lastInsertRowid);
}

export function updateTemplate(id, data) {
  const existing = getTemplate(id);
  if (!existing) return null;
  emailDb()
    .prepare(
      'UPDATE email_templates SET name=?, subject=?, body_html=?, merge_fields=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
    )
    .run(
      data.name ?? existing.name,
      data.subject ?? existing.subject,
      data.body_html ?? existing.body_html,
      json(data.merge_fields ?? existing.merge_fields),
      id
    );
  return getTemplate(id);
}

export function deleteTemplate(id) {
  return emailDb().prepare('DELETE FROM email_templates WHERE id = ?').run(id);
}

/* ─────────────────────────── signatures ─────────────────────────── */

export function listSignatures(mailboxId) {
  return mailboxId
    ? emailDb().prepare('SELECT * FROM email_signatures WHERE mailbox_id = ? ORDER BY is_default DESC, name').all(mailboxId)
    : emailDb().prepare('SELECT * FROM email_signatures ORDER BY mailbox_id, is_default DESC, name').all();
}

export function getSignature(id) {
  return emailDb().prepare('SELECT * FROM email_signatures WHERE id = ?').get(id);
}

export function createSignature(data) {
  const db = emailDb();
  const info = db
    .prepare('INSERT INTO email_signatures (mailbox_id, name, body_html, is_default) VALUES (?,?,?,?)')
    .run(data.mailbox_id, data.name, data.body_html, data.is_default ? 1 : 0);

  if (data.is_default) {
    db.prepare('UPDATE email_signatures SET is_default = 0 WHERE mailbox_id = ? AND id != ?').run(
      data.mailbox_id,
      info.lastInsertRowid
    );
  }
  return getSignature(info.lastInsertRowid);
}

export function updateSignature(id, data) {
  const db = emailDb();
  const existing = getSignature(id);
  if (!existing) return null;

  db.prepare('UPDATE email_signatures SET name=?, body_html=?, is_default=? WHERE id=?').run(
    data.name ?? existing.name,
    data.body_html ?? existing.body_html,
    data.is_default ? 1 : 0,
    id
  );
  if (data.is_default) {
    db.prepare('UPDATE email_signatures SET is_default = 0 WHERE mailbox_id = ? AND id != ?').run(existing.mailbox_id, id);
  }
  return getSignature(id);
}

export function deleteSignature(id) {
  return emailDb().prepare('DELETE FROM email_signatures WHERE id = ?').run(id);
}

/* ─────────────────────────── blasts ─────────────────────────── */

export function listBlasts() {
  return emailDb()
    .prepare(
      `SELECT b.*, g.name AS group_name, m.email_address AS mailbox_address
       FROM email_blasts b
       LEFT JOIN email_groups g ON g.id = b.group_id
       LEFT JOIN email_mailboxes m ON m.id = b.mailbox_id
       ORDER BY b.created_at DESC`
    )
    .all();
}

export function getBlast(id) {
  const blast = emailDb()
    .prepare(
      `SELECT b.*, g.name AS group_name, m.email_address AS mailbox_address
       FROM email_blasts b
       LEFT JOIN email_groups g ON g.id = b.group_id
       LEFT JOIN email_mailboxes m ON m.id = b.mailbox_id
       WHERE b.id = ?`
    )
    .get(id);
  if (!blast) return null;

  const recipients = emailDb()
    .prepare('SELECT * FROM email_blast_recipients WHERE blast_id = ? ORDER BY id')
    .all(id);
  return { ...blast, recipients };
}

export function createBlast(data, recipients) {
  const db = emailDb();

  return db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO email_blasts
         (mailbox_id, subject, body_html, from_address, recipient_type, group_id, total_recipients, status, scheduled_for)
         VALUES (?,?,?,?,?,?,?,?,?)`
      )
      .run(
        data.mailbox_id,
        data.subject,
        data.body_html,
        data.from_address,
        data.recipient_type,
        data.group_id ?? null,
        recipients.length,
        data.scheduled_for ? 'pending' : 'pending',
        data.scheduled_for ?? null
      );

    const blastId = info.lastInsertRowid;
    const stmt = db.prepare('INSERT INTO email_blast_recipients (blast_id, contact_id, email) VALUES (?,?,?)');
    for (const r of recipients) stmt.run(blastId, r.id ?? null, r.email);

    return blastId;
  })();
}

export function pendingBlastRecipients(blastId, limit) {
  return emailDb()
    .prepare(
      `SELECT r.*, c.first_name, c.last_name FROM email_blast_recipients r
       LEFT JOIN email_contacts c ON c.id = r.contact_id
       WHERE r.blast_id = ? AND r.status = 'pending' ORDER BY r.id LIMIT ?`
    )
    .all(blastId, limit);
}

export function markRecipient(recipientId, status, errorMessage = null) {
  emailDb()
    .prepare('UPDATE email_blast_recipients SET status = ?, error_message = ?, sent_at = ? WHERE id = ?')
    .run(status, errorMessage, new Date().toISOString(), recipientId);
}

export function updateBlastStatus(blastId, fields) {
  const sets = [];
  const params = [];
  for (const [key, value] of Object.entries(fields)) {
    sets.push(`${key} = ?`);
    params.push(value);
  }
  if (sets.length === 0) return;
  emailDb().prepare(`UPDATE email_blasts SET ${sets.join(', ')} WHERE id = ?`).run(...params, blastId);
}

export function refreshBlastCounts(blastId) {
  const row = emailDb()
    .prepare(
      `SELECT
         SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
         SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending
       FROM email_blast_recipients WHERE blast_id = ?`
    )
    .get(blastId);

  updateBlastStatus(blastId, { sent_count: row.sent || 0, failed_count: row.failed || 0 });
  return { sent: row.sent || 0, failed: row.failed || 0, pending: row.pending || 0 };
}

export function dueBlasts() {
  return emailDb()
    .prepare(
      `SELECT id FROM email_blasts
       WHERE status = 'pending' AND (scheduled_for IS NULL OR scheduled_for <= ?)`
    )
    .all(new Date().toISOString());
}
