import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { normalizeDateString } from '@/lib/dateUtils';
import { hashPassword } from '@/lib/password';
import { OFFICER_TITLES } from '@/lib/clubConstants';

const DEFAULT_DB_PATH = process.env.PHOTO_DB_PATH || path.join(process.cwd(), 'server-photos', 'photos.db');
export const PHOTO_DB_PATH = path.resolve(DEFAULT_DB_PATH);

let db;

function ensureDbPath() {
  const dir = path.dirname(PHOTO_DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Seeds only what a brand-new install genuinely needs: one admin account and the
 * recurring club events. Demo members and demo classifieds are deliberately not
 * seeded — this database backs the live site.
 */
function seedInitialData(database) {
  const userCount = database.prepare('SELECT COUNT(*) AS count FROM users').get().count;
  if (userCount === 0) {
    database.prepare(
      'INSERT INTO users (id, username, name, role, password, needsPasswordReset, phone, email, address, amaNumber, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run('admin', 'mkaufmann', 'Mark Kaufmann', 'admin', hashPassword('1234'), 1, null, 'admin@lhmac.org', 'Mammoth Park, PA', null, new Date().toISOString());
  }

  const eventCount = database.prepare('SELECT COUNT(*) AS count FROM events').get().count;
  if (eventCount === 0) {
    const now = new Date().toISOString();
    const insertEvent = database.prepare(
      'INSERT INTO events (id, title, date, startTime, endTime, time, location, type, desc, ownerId, ownerName, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    insertEvent.run('event-1', 'Monthly Club Meeting', '2026-08-02', '12:00', '13:00', '12:00 PM – 1:00 PM', 'Mammoth Park Pavilion', 'Meeting', 'Regular monthly meeting. All members welcome.', 'admin', 'Club Admin', now, now);
    insertEvent.run('event-2', 'Fun Fly & Cookout', '2026-08-16', '10:00', '14:00', '10:00 AM – 2:00 PM', 'Mammoth Park', 'Event', 'Bring your planes and an appetite. Burgers and dogs provided.', 'admin', 'Club Admin', now, now);
    insertEvent.run('event-3', 'Float Fly', '2026-08-23', '10:00', '13:00', '10:00 AM – 1:00 PM', 'Acme Dam, Chestnut Ridge', 'Float Fly', 'Open to all AMA members. Bring your float planes!', 'admin', 'Club Admin', now, now);
    insertEvent.run('event-4', 'Swap Meet', '2026-09-06', '09:00', '12:00', '9:00 AM – 12:00 PM', 'Mammoth Park Pavilion', 'Swap Meet', 'Buy, sell, and trade RC equipment.', 'admin', 'Club Admin', now, now);
  }

  const statusCount = database.prepare('SELECT COUNT(*) AS count FROM field_status').get().count;
  if (statusCount === 0) {
    database.prepare(
      'INSERT INTO field_status (id, status, reason, updatedAt, updatedBy) VALUES (?, ?, ?, ?, ?)'
    ).run(1, 'open', '', new Date().toISOString(), 'system');
  }
}

function getDb() {
  if (!db) {
    ensureDbPath();
    db = new Database(PHOTO_DB_PATH);
    db.pragma('journal_mode = WAL');

    db.prepare(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE,
      name TEXT,
      role TEXT,
      password TEXT,
      needsPasswordReset INTEGER,
      phone TEXT,
      email TEXT,
      address TEXT,
      amaNumber TEXT,
      applicationId TEXT,
      createdAt TEXT
    )`).run();

    db.prepare(`CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      userId TEXT,
      createdAt TEXT,
      expiresAt TEXT
    )`).run();

    db.prepare(`CREATE TABLE IF NOT EXISTS member_applications (
      id TEXT PRIMARY KEY,
      name TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      amaNumber TEXT,
      reason TEXT,
      status TEXT,
      submittedAt TEXT,
      reviewedAt TEXT,
      reviewerId TEXT
    )`).run();

    db.prepare(`CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      title TEXT,
      date TEXT,
      startTime TEXT,
      endTime TEXT,
      time TEXT,
      location TEXT,
      type TEXT,
      desc TEXT,
      ownerId TEXT,
      ownerName TEXT,
      createdAt TEXT,
      updatedAt TEXT
    )`).run();

    db.prepare(`CREATE TABLE IF NOT EXISTS classifieds (
      id TEXT PRIMARY KEY,
      title TEXT,
      price TEXT,
      type TEXT,
      category TEXT,
      posted TEXT,
      description TEXT
    )`).run();

    db.prepare(`CREATE TABLE IF NOT EXISTS field_status (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      status TEXT,
      reason TEXT,
      updatedAt TEXT,
      updatedBy TEXT
    )`).run();

    db.prepare(`CREATE TABLE IF NOT EXISTS contact_messages (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT,
      subject TEXT,
      message TEXT,
      status TEXT,
      submittedAt TEXT
    )`).run();

    // Scheduled closures, NOTAM-style. startsAt/endsAt are absolute UTC ISO
    // instants so comparisons are timezone-independent; the browser converts to
    // and from the club's local time at the edges.
    db.prepare(`CREATE TABLE IF NOT EXISTS field_closures (
      id TEXT PRIMARY KEY,
      status TEXT,
      reason TEXT,
      startsAt TEXT,
      endsAt TEXT,
      createdBy TEXT,
      createdAt TEXT
    )`).run();

    // issueDate is a plain YYYY-MM-DD string, deliberately not a timestamp — a
    // newsletter belongs to a month, not to an instant.
    // Admin-configurable site imagery, keyed by slot (e.g. 'hero').
    db.prepare(`CREATE TABLE IF NOT EXISTS site_images (
      slot TEXT PRIMARY KEY,
      filename TEXT,
      contentType TEXT,
      byteSize INTEGER,
      updatedBy TEXT,
      updatedAt TEXT,
      content BLOB
    )`).run();

    db.prepare(`CREATE TABLE IF NOT EXISTS newsletters (
      id TEXT PRIMARY KEY,
      title TEXT,
      issueDate TEXT,
      filename TEXT,
      byteSize INTEGER,
      uploadedBy TEXT,
      uploadedAt TEXT,
      content BLOB
    )`).run();

    db.prepare(`CREATE TABLE IF NOT EXISTS lesson_requests (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT,
      phone TEXT,
      instructorId TEXT,
      instructorName TEXT,
      experience TEXT,
      aircraft TEXT,
      availability TEXT,
      notes TEXT,
      status TEXT,
      submittedAt TEXT,
      handledAt TEXT
    )`).run();

    db.prepare(`CREATE TABLE IF NOT EXISTS photo_queue (
      id TEXT PRIMARY KEY,
      filename TEXT,
      caption TEXT,
      submitter TEXT,
      submitted TEXT,
      status TEXT,
      content BLOB
    )`).run();

    db.prepare(`CREATE TABLE IF NOT EXISTS recent_photos (
      id TEXT PRIMARY KEY,
      filename TEXT,
      caption TEXT,
      photographer TEXT,
      date TEXT,
      approvedAt TEXT,
      content BLOB
    )`).run();

    runMigrations(db);
    seedInitialData(db);
  }
  return db;
}

/** Adds columns introduced after the first release, for databases already on disk. */
function runMigrations(database) {
  const addColumn = (table, column, definition) => {
    const columns = database.prepare(`PRAGMA table_info(${table})`).all();
    if (!columns.some((c) => c.name === column)) {
      database.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
    }
  };

  addColumn('classifieds', 'ownerId', 'TEXT');
  addColumn('classifieds', 'ownerName', 'TEXT');
  addColumn('classifieds', 'createdAt', 'TEXT');
  addColumn('classifieds', 'photo', 'BLOB');
  addColumn('classifieds', 'photoFilename', 'TEXT');
  addColumn('classifieds', 'phone', 'TEXT');
  addColumn('users', 'isInstructor', 'INTEGER DEFAULT 0');
  addColumn('users', 'instructorNote', 'TEXT');
  addColumn('users', 'officerTitle', 'TEXT');
}

export function serializeUser(user) {
  if (!user) return null;
  const { password, ...rest } = user;
  return {
    ...rest,
    needsPasswordReset: Boolean(rest.needsPasswordReset),
  };
}

export function getUserByUsername(username) {
  return getDb()
    .prepare('SELECT * FROM users WHERE username = ?')
    .get(username);
}

export function getUserById(id) {
  return getDb()
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(id);
}

export function getUsers() {
  return getDb()
    .prepare(
      'SELECT id, username, name, role, phone, email, address, amaNumber, needsPasswordReset, isInstructor, instructorNote, officerTitle, createdAt FROM users ORDER BY name ASC'
    )
    .all()
    .map((user) => ({ ...user, isInstructor: Boolean(user.isInstructor) }));
}

/**
 * Club officers for the public About page, in board order. Only name, title,
 * and email are exposed — the About page is public.
 */
export function getOfficers() {
  const rows = getDb()
    .prepare("SELECT name, officerTitle, email FROM users WHERE officerTitle IS NOT NULL AND officerTitle != ''")
    .all();

  return rows.sort((a, b) => {
    const rank = (title) => {
      const index = OFFICER_TITLES.indexOf(title);
      return index === -1 ? OFFICER_TITLES.length : index;
    };
    return rank(a.officerTitle) - rank(b.officerTitle) || a.name.localeCompare(b.name);
  });
}

/**
 * Public-facing instructor list for the lesson request form. Deliberately
 * exposes only a name and blurb — no contact details, since this is unauthenticated.
 */
export function getInstructors() {
  return getDb()
    .prepare('SELECT id, name, instructorNote FROM users WHERE isInstructor = 1 ORDER BY name ASC')
    .all();
}

export function getLessonRequests() {
  return getDb().prepare('SELECT * FROM lesson_requests ORDER BY submittedAt DESC').all();
}

export function insertLessonRequest(requestData) {
  const id = `lesson-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  getDb()
    .prepare(
      'INSERT INTO lesson_requests (id, name, email, phone, instructorId, instructorName, experience, aircraft, availability, notes, status, submittedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run(
      id,
      requestData.name,
      requestData.email,
      requestData.phone,
      requestData.instructorId || null,
      requestData.instructorName || null,
      requestData.experience,
      requestData.aircraft || '',
      requestData.availability || '',
      requestData.notes || '',
      'new',
      new Date().toISOString()
    );
  return getDb().prepare('SELECT * FROM lesson_requests WHERE id = ?').get(id);
}

export function updateLessonRequestStatus(id, status) {
  return getDb()
    .prepare('UPDATE lesson_requests SET status = ?, handledAt = ? WHERE id = ?')
    .run(status, new Date().toISOString(), id);
}

export function deleteLessonRequest(id) {
  return getDb().prepare('DELETE FROM lesson_requests WHERE id = ?').run(id);
}

export function createUser(user) {
  return getDb()
    .prepare(
      'INSERT INTO users (id, username, name, role, password, needsPasswordReset, phone, email, address, amaNumber, applicationId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run(
      user.id,
      user.username,
      user.name,
      user.role,
      hashPassword(user.password),
      user.needsPasswordReset ? 1 : 0,
      user.phone || null,
      user.email || null,
      user.address || null,
      user.amaNumber || null,
      user.applicationId || null,
      user.createdAt || new Date().toISOString()
    );
}

const EDITABLE_USER_FIELDS = [
  'name',
  'username',
  'email',
  'phone',
  'address',
  'amaNumber',
  'role',
  'isInstructor',
  'instructorNote',
  'officerTitle',
];

/** True when another account already holds this username. */
export function isUsernameTaken(username, excludeUserId) {
  const row = getDb()
    .prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE AND id != ?')
    .get(username, excludeUserId);
  return Boolean(row);
}

/**
 * Admin edit of a member's profile. Only the whitelisted fields can be written,
 * so a crafted request cannot reach `password` or `needsPasswordReset`.
 */
export function updateUser(id, fields) {
  const updates = EDITABLE_USER_FIELDS.filter((field) => fields[field] !== undefined);
  if (updates.length === 0) return getUserById(id);

  const assignments = updates.map((field) => `${field} = ?`).join(', ');
  const values = updates.map((field) => {
    const value = fields[field];
    return typeof value === 'string' && value.trim() === '' ? null : value;
  });

  getDb().prepare(`UPDATE users SET ${assignments} WHERE id = ?`).run(...values, id);
  return getUserById(id);
}

export function updateUserPassword(userId, password) {
  return getDb()
    .prepare('UPDATE users SET password = ?, needsPasswordReset = 0 WHERE id = ?')
    .run(hashPassword(password), userId);
}

/**
 * Admin-issued temporary password. Existing sessions are dropped so the member
 * is forced through the reset flow the next time they sign in.
 */
export function resetUserPassword(userId, temporaryPassword) {
  const db = getDb();
  db.transaction(() => {
    db.prepare('UPDATE users SET password = ?, needsPasswordReset = 1 WHERE id = ?')
      .run(hashPassword(temporaryPassword), userId);
    db.prepare('DELETE FROM sessions WHERE userId = ?').run(userId);
  })();
}

/** Re-stores an already-verified plaintext password as a hash, on next sign-in. */
export function upgradeStoredPassword(userId, password) {
  return getDb()
    .prepare('UPDATE users SET password = ? WHERE id = ?')
    .run(hashPassword(password), userId);
}

export function deleteUser(id) {
  const db = getDb();
  db.transaction(() => {
    db.prepare('DELETE FROM sessions WHERE userId = ?').run(id);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
  })();
}

export function setUserRole(id, role) {
  return getDb().prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
}

export function getDashboardCounts() {
  const db = getDb();
  const count = (sql, ...args) => db.prepare(sql).get(...args).count;
  return {
    photoQueue: count('SELECT COUNT(*) AS count FROM photo_queue'),
    unreadMessages: count("SELECT COUNT(*) AS count FROM contact_messages WHERE status = 'unread'"),
    members: count('SELECT COUNT(*) AS count FROM users'),
    events: count('SELECT COUNT(*) AS count FROM events'),
    pendingApplications: count("SELECT COUNT(*) AS count FROM member_applications WHERE status = 'pending'"),
    classifieds: count('SELECT COUNT(*) AS count FROM classifieds'),
    newLessonRequests: count("SELECT COUNT(*) AS count FROM lesson_requests WHERE status = 'new'"),
    instructors: count('SELECT COUNT(*) AS count FROM users WHERE isInstructor = 1'),
    newsletters: count('SELECT COUNT(*) AS count FROM newsletters'),
  };
}

export function createSession(userId) {
  const token = crypto.randomBytes(24).toString('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7).toISOString();
  getDb()
    .prepare('INSERT INTO sessions (token, userId, createdAt, expiresAt) VALUES (?, ?, ?, ?)')
    .run(token, userId, now.toISOString(), expiresAt);
  return token;
}

export function getSession(token) {
  if (!token) return null;
  const session = getDb().prepare('SELECT * FROM sessions WHERE token = ?').get(token);
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    deleteSession(token);
    return null;
  }
  return session;
}

export function deleteSession(token) {
  return getDb().prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function getApplications() {
  return getDb()
    .prepare('SELECT * FROM member_applications ORDER BY submittedAt DESC')
    .all();
}

export function insertApplication(application) {
  const id = `app-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const submittedAt = new Date().toISOString();
  getDb()
    .prepare(
      'INSERT INTO member_applications (id, name, phone, email, address, amaNumber, reason, status, submittedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run(id, application.name, application.phone, application.email, application.address, application.amaNumber, application.reason || '', 'pending', submittedAt);
  return getDb().prepare('SELECT * FROM member_applications WHERE id = ?').get(id);
}

export function reviewApplication(id, action) {
  const db = getDb();
  const application = db.prepare('SELECT * FROM member_applications WHERE id = ?').get(id);
  if (!application || application.status !== 'pending') return null;
  const status = action === 'approve' ? 'approved' : 'rejected';
  const reviewedAt = new Date().toISOString();
  db.prepare('UPDATE member_applications SET status = ?, reviewedAt = ?, reviewerId = ? WHERE id = ?')
    .run(status, reviewedAt, 'admin', id);

  if (status === 'approved') {
    const usernameBase = application.email.split('@')[0].replace(/[^a-z0-9]/gi, '').toLowerCase() || `member${Date.now()}`;
    const userId = `member-${Date.now()}`;
    const user = {
      id: userId,
      username: usernameBase,
      name: application.name,
      role: 'member',
      password: 'welcome',
      needsPasswordReset: true,
      phone: application.phone,
      email: application.email,
      address: application.address,
      amaNumber: application.amaNumber,
      applicationId: application.id,
      createdAt: new Date().toISOString(),
    };
    createUser(user);
    return { application: { ...application, status, reviewedAt }, user: serializeUser(user) };
  }
  return { application: { ...application, status, reviewedAt } };
}

export function getEvents() {
  return getDb()
    .prepare('SELECT * FROM events ORDER BY date ASC, startTime ASC')
    .all()
    .map((event) => ({ ...event, date: normalizeDateString(event.date) }));
}

export function getEventById(id) {
  const event = getDb().prepare('SELECT * FROM events WHERE id = ?').get(id);
  return event ? { ...event, date: normalizeDateString(event.date) } : event;
}

export function upsertEvent(event) {
  const db = getDb();
  const normalizedDate = normalizeDateString(event.date);
  const existing = getEventById(event.id);
  const now = new Date().toISOString();
  if (existing) {
    db.prepare(
      'UPDATE events SET title = ?, date = ?, startTime = ?, endTime = ?, time = ?, location = ?, type = ?, desc = ?, ownerId = ?, ownerName = ?, updatedAt = ? WHERE id = ?'
    ).run(event.title, normalizedDate, event.startTime, event.endTime, event.time, event.location, event.type, event.desc, event.ownerId, event.ownerName, now, event.id);
    return getEventById(event.id);
  }
  db.prepare(
    'INSERT INTO events (id, title, date, startTime, endTime, time, location, type, desc, ownerId, ownerName, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(event.id, event.title, normalizedDate, event.startTime, event.endTime, event.time, event.location, event.type, event.desc, event.ownerId, event.ownerName, now, now);
  return getEventById(event.id);
}

export function deleteEvent(id) {
  return getDb().prepare('DELETE FROM events WHERE id = ?').run(id);
}

// The photo blob is excluded from list queries so a page of listings does not
// drag every image through memory; images are served by their own route.
const CLASSIFIED_COLUMNS =
  'id, title, price, type, category, posted, description, phone, ownerId, ownerName, createdAt, (photo IS NOT NULL) AS hasPhoto';

export const CLASSIFIED_LIFETIME_DAYS = 90;

/** The cutoff before which a listing is considered expired. */
function classifiedCutoff() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - CLASSIFIED_LIFETIME_DAYS);
  return cutoff.toISOString();
}

/**
 * Live listings only. Expiry is applied at read time rather than by a cleanup
 * job, so the 90-day promise on the page is always true even if nothing has
 * swept the table recently.
 */
export function getClassifieds() {
  return getDb()
    .prepare(
      `SELECT ${CLASSIFIED_COLUMNS} FROM classifieds
       WHERE COALESCE(createdAt, posted) > ?
       ORDER BY COALESCE(createdAt, posted) DESC`
    )
    .all(classifiedCutoff());
}

/** Physically removes listings past their lifetime, reclaiming photo storage. */
export function purgeExpiredClassifieds() {
  return getDb()
    .prepare('DELETE FROM classifieds WHERE COALESCE(createdAt, posted) <= ?')
    .run(classifiedCutoff());
}

export function getClassifiedById(id) {
  return getDb().prepare(`SELECT ${CLASSIFIED_COLUMNS} FROM classifieds WHERE id = ?`).get(id);
}

export function getClassifiedPhoto(id) {
  return getDb().prepare('SELECT photoFilename, photo FROM classifieds WHERE id = ?').get(id);
}

export function insertClassified(listing) {
  const id = `listing-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdAt = new Date().toISOString();
  getDb()
    .prepare(
      'INSERT INTO classifieds (id, title, price, type, category, posted, description, phone, ownerId, ownerName, createdAt, photo, photoFilename) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run(
      id,
      listing.title,
      listing.price || null,
      listing.type,
      listing.category,
      createdAt,
      listing.description || '',
      listing.phone,
      listing.ownerId,
      listing.ownerName,
      createdAt,
      listing.photo || null,
      listing.photoFilename || null
    );
  return getClassifiedById(id);
}

export function deleteClassified(id) {
  return getDb().prepare('DELETE FROM classifieds WHERE id = ?').run(id);
}

export function getManualFieldStatus() {
  return getDb().prepare('SELECT * FROM field_status WHERE id = 1').get();
}

export function setFieldStatus(status, reason, updatedBy) {
  getDb()
    .prepare('UPDATE field_status SET status = ?, reason = ?, updatedAt = ?, updatedBy = ? WHERE id = 1')
    .run(status, reason || '', new Date().toISOString(), updatedBy);
  return getManualFieldStatus();
}

export function getFieldClosures() {
  return getDb().prepare('SELECT * FROM field_closures ORDER BY startsAt ASC').all();
}

export function insertFieldClosure(closure) {
  const id = `closure-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  getDb()
    .prepare(
      'INSERT INTO field_closures (id, status, reason, startsAt, endsAt, createdBy, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .run(id, closure.status, closure.reason || '', closure.startsAt, closure.endsAt, closure.createdBy, new Date().toISOString());
  return getDb().prepare('SELECT * FROM field_closures WHERE id = ?').get(id);
}

export function deleteFieldClosure(id) {
  return getDb().prepare('DELETE FROM field_closures WHERE id = ?').run(id);
}

/** Closures that have already ended; cleared so the list stays readable. */
export function purgeExpiredClosures() {
  return getDb().prepare('DELETE FROM field_closures WHERE endsAt < ?').run(new Date().toISOString());
}

/**
 * The status the field is actually in right now.
 *
 * A scheduled closure that is currently running wins over the manual toggle, so
 * an admin does not have to remember to flip the switch when the window opens.
 * When several overlap, the one ending last wins — the field stays shut until
 * every closure has passed.
 */
export function getEffectiveFieldStatus() {
  const now = new Date().toISOString();
  const active = getDb()
    .prepare('SELECT * FROM field_closures WHERE startsAt <= ? AND endsAt > ? ORDER BY endsAt DESC LIMIT 1')
    .get(now, now);

  if (active) {
    return {
      status: active.status,
      reason: active.reason,
      source: 'scheduled',
      activeUntil: active.endsAt,
      updatedBy: active.createdBy,
      updatedAt: active.createdAt,
    };
  }

  const manual = getManualFieldStatus();
  return {
    status: manual?.status ?? 'open',
    reason: manual?.reason ?? '',
    source: 'manual',
    activeUntil: null,
    updatedBy: manual?.updatedBy ?? null,
    updatedAt: manual?.updatedAt ?? null,
  };
}

/** Closures that have not finished yet, for display on the site. */
export function getUpcomingClosures() {
  const now = new Date().toISOString();
  return getDb()
    .prepare('SELECT * FROM field_closures WHERE endsAt > ? ORDER BY startsAt ASC')
    .all(now);
}

export function getSiteImageMeta(slot) {
  return getDb()
    .prepare('SELECT slot, filename, contentType, byteSize, updatedBy, updatedAt FROM site_images WHERE slot = ?')
    .get(slot);
}

export function getSiteImageFile(slot) {
  return getDb().prepare('SELECT contentType, content, updatedAt FROM site_images WHERE slot = ?').get(slot);
}

export function upsertSiteImage(image) {
  getDb()
    .prepare(
      `INSERT INTO site_images (slot, filename, contentType, byteSize, updatedBy, updatedAt, content)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(slot) DO UPDATE SET
         filename = excluded.filename,
         contentType = excluded.contentType,
         byteSize = excluded.byteSize,
         updatedBy = excluded.updatedBy,
         updatedAt = excluded.updatedAt,
         content = excluded.content`
    )
    .run(
      image.slot,
      image.filename,
      image.contentType,
      image.byteSize,
      image.updatedBy,
      new Date().toISOString(),
      image.content
    );
  return getSiteImageMeta(image.slot);
}

export function deleteSiteImage(slot) {
  return getDb().prepare('DELETE FROM site_images WHERE slot = ?').run(slot);
}

// The PDF blob is excluded from listings; it is served by its own route.
const NEWSLETTER_COLUMNS = 'id, title, issueDate, filename, byteSize, uploadedBy, uploadedAt';

export function getNewsletters() {
  return getDb()
    .prepare(`SELECT ${NEWSLETTER_COLUMNS} FROM newsletters ORDER BY issueDate DESC, uploadedAt DESC`)
    .all()
    .map((newsletter) => ({ ...newsletter, issueDate: normalizeDateString(newsletter.issueDate) }));
}

export function getNewsletterFile(id) {
  return getDb().prepare('SELECT filename, content FROM newsletters WHERE id = ?').get(id);
}

export function insertNewsletter(newsletter) {
  const id = `news-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  getDb()
    .prepare(
      'INSERT INTO newsletters (id, title, issueDate, filename, byteSize, uploadedBy, uploadedAt, content) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run(
      id,
      newsletter.title,
      normalizeDateString(newsletter.issueDate),
      newsletter.filename,
      newsletter.byteSize,
      newsletter.uploadedBy,
      new Date().toISOString(),
      newsletter.content
    );
  return getDb().prepare(`SELECT ${NEWSLETTER_COLUMNS} FROM newsletters WHERE id = ?`).get(id);
}

export function deleteNewsletter(id) {
  return getDb().prepare('DELETE FROM newsletters WHERE id = ?').run(id);
}

export function getContactMessages() {
  return getDb()
    .prepare('SELECT * FROM contact_messages ORDER BY submittedAt DESC')
    .all();
}

export function insertContactMessage(message) {
  const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const submittedAt = new Date().toISOString();
  getDb()
    .prepare(
      'INSERT INTO contact_messages (id, name, email, subject, message, status, submittedAt) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .run(id, message.name, message.email, message.subject, message.message, 'unread', submittedAt);
  return getDb().prepare('SELECT * FROM contact_messages WHERE id = ?').get(id);
}

export function markContactMessageRead(id) {
  return getDb().prepare("UPDATE contact_messages SET status = 'read' WHERE id = ?").run(id);
}

export function deleteContactMessage(id) {
  return getDb().prepare('DELETE FROM contact_messages WHERE id = ?').run(id);
}

export function getQueueItems() {
  return getDb()
    .prepare('SELECT id, filename, caption, submitter, submitted, status FROM photo_queue ORDER BY submitted DESC')
    .all();
}

export function deleteQueueItem(id) {
  return getDb().prepare('DELETE FROM photo_queue WHERE id = ?').run(id);
}

/** Approved gallery photos — safe to serve publicly. */
export function getApprovedPhotoContent(id) {
  return getDb().prepare('SELECT filename, content FROM recent_photos WHERE id = ?').get(id);
}

/** Photos still awaiting review — admin only. */
export function getQueuedPhotoContent(id) {
  return getDb().prepare('SELECT filename, content FROM photo_queue WHERE id = ?').get(id);
}

export function getRecentPhotos() {
  return getDb()
    .prepare('SELECT id, filename, caption, photographer, date, approvedAt FROM recent_photos ORDER BY approvedAt DESC')
    .all();
}

export function getPhotoUrl(id) {
  return `/api/photos/files/${encodeURIComponent(id)}`;
}

export function insertQueuePhoto(photo) {
  const db = getDb();
  db.prepare(
    'INSERT INTO photo_queue (id, filename, caption, submitter, submitted, status, content) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(photo.id, photo.filename, photo.caption, photo.submitter, photo.submitted, photo.status, photo.content);
}

export function approveQueueItem(id) {
  const db = getDb();
  const photo = db
    .prepare('SELECT * FROM photo_queue WHERE id = ?')
    .get(id);
  if (!photo) return null;

  const approvedAt = new Date().toISOString();
  const date = new Date().toLocaleString('default', { month: 'short', year: 'numeric' });
  db.transaction(() => {
    db.prepare(
      'INSERT INTO recent_photos (id, filename, caption, photographer, date, approvedAt, content) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(photo.id, photo.filename, photo.caption, photo.submitter, date, approvedAt, photo.content);
    db.prepare('DELETE FROM photo_queue WHERE id = ?').run(id);
  })();

  return {
    id: photo.id,
    filename: photo.filename,
    caption: photo.caption,
    photographer: photo.submitter,
    date,
    approvedAt,
  };
}

export function normalizeFilename(filename) {
  const basename = path.basename(filename);
  const cleaned = basename.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-');
  return `${Date.now()}-${cleaned}`;
}
