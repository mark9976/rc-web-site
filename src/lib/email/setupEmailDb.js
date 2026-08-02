import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Email lives in its own SQLite file, separate from photos.db.
 *
 * Message bodies and attachments grow far faster than the rest of the site, and
 * keeping them apart means the two can be backed up, pruned, and restored on
 * their own schedules — losing or rolling back one does not touch the other.
 *
 * Defaults to a sibling of the photo database so there is still just one
 * directory to back up.
 */
function resolveDbPath() {
  if (process.env.EMAIL_DB_PATH) return path.resolve(process.env.EMAIL_DB_PATH);

  const photoPath = process.env.PHOTO_DB_PATH || path.join(process.cwd(), 'server-photos', 'photos.db');
  return path.resolve(path.join(path.dirname(photoPath), 'email.db'));
}

export const EMAIL_DB_PATH = resolveDbPath();

let db;

export function setupEmailDb() {
  if (db) return db;

  const dir = path.dirname(EMAIL_DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  db = new Database(EMAIL_DB_PATH);
  db.pragma('journal_mode = WAL');
  // Referenced rows (attachments, group members, blast recipients) rely on
  // ON DELETE CASCADE, which SQLite ignores unless this is switched on.
  db.pragma('foreign_keys = ON');

  const schemaPath = path.join(process.cwd(), 'src', 'lib', 'email', 'emailSchema.sql');
  db.exec(fs.readFileSync(schemaPath, 'utf8'));

  return db;
}

/** Every email helper goes through this so the schema is always present. */
export function emailDb() {
  return setupEmailDb();
}
