-- Email client schema.
--
-- Lives in its own SQLite file (EMAIL_DB_PATH, default: email.db beside
-- photos.db). Message bodies and attachments are stored inline and grow much
-- faster than the rest of the site, so they are kept out of photos.db — see
-- setupEmailDb.js.
--
-- Note there is no foreign key from email_contacts.member_id to the roster:
-- users live in the other database file, so the link is by id only and is not
-- enforced by SQLite.

CREATE TABLE IF NOT EXISTS email_mailboxes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email_address TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  imap_host TEXT NOT NULL,
  imap_port INTEGER NOT NULL DEFAULT 993,
  smtp_host TEXT NOT NULL,
  smtp_port INTEGER NOT NULL DEFAULT 465,
  username TEXT NOT NULL,
  password TEXT NOT NULL,            -- AES-256-GCM ciphertext, see encryption.js
  is_default INTEGER DEFAULT 0,
  last_sync_at TEXT,
  last_sync_error TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS email_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mailbox_id INTEGER NOT NULL REFERENCES email_mailboxes(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  uid INTEGER,
  folder TEXT NOT NULL DEFAULT 'INBOX',
  from_address TEXT NOT NULL,
  from_name TEXT,
  to_addresses TEXT NOT NULL,        -- JSON array
  cc_addresses TEXT,                 -- JSON array
  bcc_addresses TEXT,                -- JSON array
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  snippet TEXT,
  has_attachments INTEGER DEFAULT 0,
  is_read INTEGER DEFAULT 0,
  is_starred INTEGER DEFAULT 0,
  is_draft INTEGER DEFAULT 0,
  in_reply_to TEXT,
  references_header TEXT,            -- JSON array
  thread_id TEXT,
  sent_at TEXT NOT NULL,
  synced_at TEXT DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(mailbox_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_email_messages_list
  ON email_messages(mailbox_id, folder, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_messages_unread
  ON email_messages(mailbox_id, folder, is_read);
CREATE INDEX IF NOT EXISTS idx_email_messages_thread
  ON email_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_uid
  ON email_messages(mailbox_id, folder, uid);

CREATE TABLE IF NOT EXISTS email_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL REFERENCES email_messages(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  content BLOB,
  content_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_attachments_message
  ON email_attachments(message_id);

CREATE TABLE IF NOT EXISTS email_contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  contact_type TEXT NOT NULL DEFAULT 'external',
  member_id TEXT,                    -- users.id is TEXT in this project
  tags TEXT,                         -- JSON array
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_contacts_type ON email_contacts(contact_type);

CREATE TABLE IF NOT EXISTS email_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS email_group_members (
  group_id INTEGER NOT NULL REFERENCES email_groups(id) ON DELETE CASCADE,
  contact_id INTEGER NOT NULL REFERENCES email_contacts(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, contact_id)
);

CREATE TABLE IF NOT EXISTS email_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  merge_fields TEXT,                 -- JSON array
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS email_blasts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mailbox_id INTEGER NOT NULL REFERENCES email_mailboxes(id),
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  from_address TEXT NOT NULL,
  recipient_type TEXT NOT NULL,
  group_id INTEGER,
  total_recipients INTEGER NOT NULL,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  scheduled_for TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS email_blast_recipients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  blast_id INTEGER NOT NULL REFERENCES email_blasts(id) ON DELETE CASCADE,
  contact_id INTEGER REFERENCES email_contacts(id),
  email TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  sent_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_blast_recipients_blast
  ON email_blast_recipients(blast_id, status);

CREATE TABLE IF NOT EXISTS email_signatures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mailbox_id INTEGER NOT NULL REFERENCES email_mailboxes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  body_html TEXT NOT NULL,
  is_default INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
