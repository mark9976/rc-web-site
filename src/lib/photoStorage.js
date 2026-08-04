import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { normalizeDateString } from '@/lib/dateUtils';
import { hashPassword, generateTemporaryPassword } from '@/lib/password';
import { OFFICER_TITLES, FLYING_SITES } from '@/lib/clubConstants';
import { nextClubHour, clubParts } from '@/lib/clubTime';

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

  seedEventTypes(database);
  seedLogoImage(database);

  const statusCount = database.prepare('SELECT COUNT(*) AS count FROM field_status').get().count;
  if (statusCount === 0) {
    database.prepare(
      'INSERT INTO field_status (id, status, reason, updatedAt, updatedBy) VALUES (?, ?, ?, ?, ?)'
    ).run(1, 'open', '', new Date().toISOString(), 'system');
  }
}

/**
 * Loads the club crest into the `logo` slot from the copy shipped in the repo.
 *
 * The iOS app reads the logo from /api/site-images/logo, which is served out of
 * the database — so a fresh deploy would 404 until somebody remembered to
 * upload it. Seeding from the repo file means every instance has it on first
 * start. Only fills an empty slot, so an admin upload is never overwritten.
 */
/**
 * Populates the event categories on first run.
 *
 * Also picks up any type already present on an existing event, so a database
 * that predates this table does not end up with events whose category is
 * missing from the list.
 */
function seedEventTypes(database) {
  const defaults = [
    ['Meeting', '#2D5A27'],
    ['Event', '#4A8FCA'],
    ['Float Fly', '#1D6FB8'],
    ['Swap Meet', '#E8890C'],
    ['Fun Fly', '#2E7D32'],
    ['Contest', '#8E44AD'],
  ];

  const existingNames = new Set(
    database.prepare('SELECT name FROM event_types').all().map((row) => row.name)
  );
  const inUse = database
    .prepare("SELECT DISTINCT type FROM events WHERE type IS NOT NULL AND type != ''")
    .all()
    .map((row) => row.type);

  const insert = database.prepare(
    'INSERT OR IGNORE INTO event_types (id, name, color, sortOrder, createdAt) VALUES (?, ?, ?, ?, ?)'
  );
  const now = new Date().toISOString();
  let order = existingNames.size;

  for (const [name, color] of defaults) {
    if (existingNames.has(name)) continue;
    insert.run(`etype-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, name, color, order, now);
    existingNames.add(name);
    order += 1;
  }
  for (const name of inUse) {
    if (existingNames.has(name)) continue;
    insert.run(`etype-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name, '#6B7280', order, now);
    existingNames.add(name);
    order += 1;
  }
}

function seedLogoImage(database) {
  const existing = database.prepare("SELECT 1 FROM site_images WHERE slot = 'logo'").get();
  if (existing) return;

  const logoPath = path.join(process.cwd(), 'public', 'lhmac-logo.png');
  if (!fs.existsSync(logoPath)) return;

  try {
    const content = fs.readFileSync(logoPath);
    database.prepare(
      `INSERT INTO site_images (slot, filename, contentType, byteSize, updatedBy, updatedAt, content)
       VALUES ('logo', 'lhmac-logo.png', 'image/png', ?, 'system', ?, ?)`
    ).run(content.length, new Date().toISOString(), content);
    console.log(`[site-images] seeded club logo (${content.length} bytes)`);
  } catch (error) {
    // A missing or unreadable logo must not stop the database opening.
    console.error('[site-images] could not seed the club logo:', error.message);
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

    // Admin-managed event categories. Colour is stored as a hex value and
    // applied inline: a Tailwind class name assembled from database content
    // would be stripped by the compiler, which only keeps classes it can see
    // in the source.
    db.prepare(`CREATE TABLE IF NOT EXISTS event_types (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#2D5A27',
      sortOrder INTEGER DEFAULT 0,
      createdAt TEXT
    )`).run();

    // ---- RC Club Connect (iOS app) ----------------------------------------
    // One active check-in per member; a new one replaces the old.
    db.prepare(`CREATE TABLE IF NOT EXISTS checkins (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      userName TEXT NOT NULL,
      checkedInAt TEXT NOT NULL,
      expiresAt TEXT NOT NULL,
      UNIQUE(userId)
    )`).run();

    // Permanent history behind the admin stats page. Rows are never deleted;
    // checkedOutAt/durationMinutes are filled in on check-out or expiry.
    db.prepare(`CREATE TABLE IF NOT EXISTS field_activity_log (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      userName TEXT NOT NULL,
      checkedInAt TEXT NOT NULL,
      checkedOutAt TEXT,
      durationMinutes INTEGER
    )`).run();

    db.prepare('CREATE INDEX IF NOT EXISTS idx_field_activity_checkedin ON field_activity_log(checkedInAt)').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_field_activity_open ON field_activity_log(userId, checkedOutAt)').run();

    // Social groups for the app. Named connect_* to stay clear of the email
    // client's own groups, which live in the separate email database.
    db.prepare(`CREATE TABLE IF NOT EXISTS connect_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      createdBy TEXT NOT NULL,
      createdByName TEXT NOT NULL,
      createdAt TEXT NOT NULL
    )`).run();

    db.prepare(`CREATE TABLE IF NOT EXISTS connect_group_members (
      id TEXT PRIMARY KEY,
      groupId TEXT NOT NULL REFERENCES connect_groups(id) ON DELETE CASCADE,
      userId TEXT NOT NULL,
      userName TEXT NOT NULL,
      joinedAt TEXT NOT NULL,
      UNIQUE(groupId, userId)
    )`).run();

    db.prepare(`CREATE TABLE IF NOT EXISTS connect_group_messages (
      id TEXT PRIMARY KEY,
      groupId TEXT NOT NULL REFERENCES connect_groups(id) ON DELETE CASCADE,
      senderId TEXT NOT NULL,
      senderName TEXT NOT NULL,
      text TEXT NOT NULL,
      isBroadcast INTEGER DEFAULT 0,
      sentAt TEXT NOT NULL
    )`).run();

    db.prepare('CREATE INDEX IF NOT EXISTS idx_connect_messages_group ON connect_group_messages(groupId, sentAt DESC)').run();

    db.prepare(`CREATE TABLE IF NOT EXISTS push_devices (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      deviceToken TEXT NOT NULL UNIQUE,
      platform TEXT NOT NULL DEFAULT 'ios',
      snsEndpointArn TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )`).run();

    db.prepare(`CREATE TABLE IF NOT EXISTS push_preferences (
      userId TEXT PRIMARY KEY,
      fieldStatus INTEGER DEFAULT 1,
      events INTEGER DEFAULT 1,
      lessons INTEGER DEFAULT 1,
      groupMessages INTEGER DEFAULT 1,
      newsletters INTEGER DEFAULT 1,
      duesReminders INTEGER DEFAULT 1,
      classifieds INTEGER DEFAULT 0,
      photos INTEGER DEFAULT 0
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
  // connect_group_members / connect_group_messages rely on ON DELETE CASCADE,
  // which SQLite ignores unless this is switched on for the connection.
  database.pragma('foreign_keys = ON');

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
  // Multi-day events. NULL means a single-day event, which is most of them.
  addColumn('events', 'endDate', 'TEXT');
  // Optional poster/photo and an external link for an event.
  addColumn('events', 'photo', 'BLOB');
  addColumn('events', 'photoFilename', 'TEXT');
  addColumn('events', 'link', 'TEXT');
  addColumn('lesson_requests', 'scheduledDate', 'TEXT');
  // Set when the requester was signed in, so the app can notify them. The
  // public form allows anonymous requests, which leave this null.
  addColumn('lesson_requests', 'studentUserId', 'TEXT');
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
      'INSERT INTO lesson_requests (id, name, email, phone, instructorId, instructorName, experience, aircraft, availability, notes, status, submittedAt, studentUserId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
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
      new Date().toISOString(),
      requestData.studentUserId || null
    );
  return getDb().prepare('SELECT * FROM lesson_requests WHERE id = ?').get(id);
}

export function updateLessonRequestStatus(id, status) {
  return getDb()
    .prepare('UPDATE lesson_requests SET status = ?, handledAt = ? WHERE id = ?')
    .run(status, new Date().toISOString(), id);
}

export function getLessonRequestById(id) {
  return getDb().prepare('SELECT * FROM lesson_requests WHERE id = ?').get(id);
}

/** An instructor picks up a request. */
export function acceptLessonRequest(id, instructorId, instructorName) {
  getDb()
    .prepare(
      "UPDATE lesson_requests SET instructorId = ?, instructorName = ?, status = 'accepted', handledAt = ? WHERE id = ?"
    )
    .run(instructorId, instructorName, new Date().toISOString(), id);
  return getLessonRequestById(id);
}

export function scheduleLessonRequest(id, scheduledDate) {
  getDb()
    .prepare("UPDATE lesson_requests SET scheduledDate = ?, status = 'scheduled', handledAt = ? WHERE id = ?")
    .run(scheduledDate, new Date().toISOString(), id);
  return getLessonRequestById(id);
}

export function completeLessonRequest(id) {
  getDb()
    .prepare("UPDATE lesson_requests SET status = 'completed', handledAt = ? WHERE id = ?")
    .run(new Date().toISOString(), id);
  return getLessonRequestById(id);
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

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Field usage statistics for the admin dashboard.
 *
 * Day and hour buckets are computed in JavaScript rather than with SQLite's
 * strftime: the timestamps are stored as UTC, and this server runs UTC, so
 * strftime would report an evening flying session as the small hours of the
 * next morning. clubParts() applies the club's real timezone, DST included.
 */
export function getFieldActivityStats(rangeDays = 30) {
  const db = getDb();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - rangeDays);
  const cutoffStr = cutoff.toISOString();

  const rows = db
    .prepare('SELECT userId, userName, checkedInAt, durationMinutes FROM field_activity_log WHERE checkedInAt > ?')
    .all(cutoffStr);

  const dailyMap = new Map();
  const dayOfWeekCounts = new Array(7).fill(0);
  const hourCounts = new Array(24).fill(0);
  const visitorMap = new Map();
  let durationTotal = 0;
  let durationSamples = 0;

  for (const row of rows) {
    const parts = clubParts(new Date(row.checkedInAt));
    dailyMap.set(parts.dateKey, (dailyMap.get(parts.dateKey) ?? 0) + 1);
    dayOfWeekCounts[parts.weekday] += 1;
    hourCounts[parts.hour] += 1;

    const visitor = visitorMap.get(row.userId) ?? { userId: row.userId, userName: row.userName, visits: 0 };
    visitor.visits += 1;
    visitor.userName = row.userName;
    visitorMap.set(row.userId, visitor);

    if (row.durationMinutes !== null && row.durationMinutes !== undefined) {
      durationTotal += row.durationMinutes;
      durationSamples += 1;
    }
  }

  const byDayOfWeek = dayOfWeekCounts
    .map((count, dayOfWeek) => ({ dayOfWeek, dayName: DAY_NAMES[dayOfWeek], count }))
    .sort((a, b) => b.count - a.count);

  const byHourOfDay = hourCounts
    .map((count, hour) => ({ hour, count }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count);

  return {
    rangeDays,
    totalCheckins: rows.length,
    uniqueMembers: visitorMap.size,
    averageDurationMinutes: durationSamples > 0 ? Math.round(durationTotal / durationSamples) : null,
    busiestDay: byDayOfWeek[0]?.count > 0 ? byDayOfWeek[0].dayName : null,
    busiestHour: byHourOfDay[0]?.hour ?? null,
    dailyCounts: [...dailyMap.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    topVisitors: [...visitorMap.values()].sort((a, b) => b.visits - a.visits).slice(0, 10),
    byDayOfWeek,
    byHourOfDay,
  };
}

/**
 * Club identity and feature flags for the iOS app.
 *
 * Hardcoded for LHMAC for now; when this goes multi-club it should come from a
 * club_config table or a per-instance JSON file. Coordinates are read from
 * FLYING_SITES so the app and the website's map never disagree.
 */
export function getClubConfig() {
  const db = getDb();
  const instructorCount = db.prepare('SELECT COUNT(*) AS count FROM users WHERE isInstructor = 1').get().count;
  const memberCount = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
  const field = FLYING_SITES.mammoth;

  return {
    name: 'Laurel Highlands Model Airplane Club',
    shortName: 'LHMAC',
    amaNumber: '557',
    fieldLocation: field.address,
    fieldCoords: { lat: field.lat, lng: field.lon },
    timezone: 'America/New_York',
    website: 'https://lhmac.info',
    features: {
      classifieds: true,
      flightInstructors: instructorCount > 0,
      newsletters: true,
      photoGallery: true,
      fieldStatus: true,
      events: true,
      lessons: true,
    },
    stats: { memberCount, instructorCount },
    officers: getOfficers().map((officer) => ({ name: officer.name, title: officer.officerTitle })),
  };
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

/**
 * Appends a number if the derived username is taken.
 *
 * `users.username` is UNIQUE, and two applicants with the same email local part
 * (mark@gmail / mark@yahoo) would otherwise fail the insert at approval time.
 */
function uniqueUsername(base) {
  const db = getDb();
  const taken = (name) => db.prepare('SELECT 1 FROM users WHERE username = ? COLLATE NOCASE').get(name);
  if (!taken(base)) return base;

  for (let suffix = 2; suffix < 100; suffix += 1) {
    const candidate = `${base}${suffix}`;
    if (!taken(candidate)) return candidate;
  }
  return `${base}${Date.now()}`;
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
    const usernameBase = uniqueUsername(
      application.email.split('@')[0].replace(/[^a-z0-9]/gi, '').toLowerCase() || `member${Date.now()}`
    );
    const userId = `member-${Date.now()}`;
    // One-time and random rather than a shared word: it travels by email and
    // is the only thing guarding the account until they set their own.
    const temporaryPassword = generateTemporaryPassword();
    const user = {
      id: userId,
      username: usernameBase,
      name: application.name,
      role: 'member',
      password: temporaryPassword,
      needsPasswordReset: true,
      phone: application.phone,
      email: application.email,
      address: application.address,
      amaNumber: application.amaNumber,
      applicationId: application.id,
      createdAt: new Date().toISOString(),
    };
    createUser(user);
    // The plaintext password is returned exactly once, for the welcome email.
    // createUser stores only the hash, so it cannot be recovered afterwards.
    return {
      application: { ...application, status, reviewedAt },
      user: serializeUser(user),
      temporaryPassword,
    };
  }
  return { application: { ...application, status, reviewedAt } };
}

// The photo blob is deliberately excluded: a SELECT * here would ship every
// event poster on every calendar load. `hasPhoto` is enough for the UI to know
// whether to request /api/events/photo/<id>.
const EVENT_COLUMNS = `
  id, title, date, endDate, startTime, endTime, time, location, type, desc,
  ownerId, ownerName, link, photoFilename, createdAt, updatedAt,
  CASE WHEN photo IS NULL THEN 0 ELSE 1 END AS hasPhoto`;

function toEvent(event) {
  if (!event) return event;
  const date = normalizeDateString(event.date);
  const endDate = normalizeDateString(event.endDate);
  return {
    ...event,
    date,
    // An end date equal to (or before) the start is just a single-day event;
    // normalising it away here keeps every consumer from special-casing it.
    endDate: endDate && endDate > date ? endDate : null,
    hasPhoto: Boolean(event.hasPhoto),
  };
}

// ---- event types ----------------------------------------------------------

export function getEventTypes() {
  return getDb()
    .prepare('SELECT id, name, color, sortOrder FROM event_types ORDER BY sortOrder ASC, name ASC')
    .all();
}

export function getEventTypeByName(name) {
  return getDb().prepare('SELECT * FROM event_types WHERE name = ? COLLATE NOCASE').get(name);
}

export function insertEventType({ name, color }) {
  const db = getDb();
  const id = `etype-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const nextOrder = (db.prepare('SELECT MAX(sortOrder) AS max FROM event_types').get().max ?? -1) + 1;
  db.prepare('INSERT INTO event_types (id, name, color, sortOrder, createdAt) VALUES (?, ?, ?, ?, ?)')
    .run(id, name, color, nextOrder, new Date().toISOString());
  return db.prepare('SELECT id, name, color, sortOrder FROM event_types WHERE id = ?').get(id);
}

/**
 * Renaming a type also relabels the events using it, so existing events keep
 * their category instead of pointing at a name that no longer exists.
 */
export function updateEventType(id, { name, color }) {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM event_types WHERE id = ?').get(id);
  if (!existing) return null;

  db.transaction(() => {
    db.prepare('UPDATE event_types SET name = ?, color = ? WHERE id = ?').run(name, color, id);
    if (name !== existing.name) {
      db.prepare('UPDATE events SET type = ? WHERE type = ?').run(name, existing.name);
    }
  })();

  return db.prepare('SELECT id, name, color, sortOrder FROM event_types WHERE id = ?').get(id);
}

export function countEventsOfType(name) {
  return getDb().prepare('SELECT COUNT(*) AS count FROM events WHERE type = ?').get(name).count;
}

export function deleteEventType(id) {
  return getDb().prepare('DELETE FROM event_types WHERE id = ?').run(id);
}

export function getEvents() {
  return getDb()
    .prepare(`SELECT ${EVENT_COLUMNS} FROM events ORDER BY date ASC, startTime ASC`)
    .all()
    .map(toEvent);
}

export function getEventById(id) {
  return toEvent(getDb().prepare(`SELECT ${EVENT_COLUMNS} FROM events WHERE id = ?`).get(id));
}

export function getEventPhoto(id) {
  return getDb().prepare('SELECT photo, photoFilename FROM events WHERE id = ?').get(id);
}

/**
 * Creates or updates an event.
 *
 * `photo` is only written when a new one is supplied, so editing an event
 * without re-picking the file keeps the existing image. Pass
 * `removePhoto: true` to clear it deliberately.
 */
export function upsertEvent(event) {
  const db = getDb();
  const normalizedDate = normalizeDateString(event.date);
  const rawEnd = normalizeDateString(event.endDate);
  // Only keep an end date that is genuinely later than the start.
  const normalizedEndDate = rawEnd && rawEnd > normalizedDate ? rawEnd : null;
  const existing = getEventById(event.id);
  const now = new Date().toISOString();
  const link = event.link || null;

  if (existing) {
    db.prepare(
      `UPDATE events SET title = ?, date = ?, endDate = ?, startTime = ?, endTime = ?, time = ?,
         location = ?, type = ?, desc = ?, ownerId = ?, ownerName = ?, link = ?, updatedAt = ?
       WHERE id = ?`
    ).run(event.title, normalizedDate, normalizedEndDate, event.startTime, event.endTime, event.time, event.location, event.type, event.desc, event.ownerId, event.ownerName, link, now, event.id);

    if (event.removePhoto) {
      db.prepare('UPDATE events SET photo = NULL, photoFilename = NULL WHERE id = ?').run(event.id);
    } else if (event.photo) {
      db.prepare('UPDATE events SET photo = ?, photoFilename = ? WHERE id = ?')
        .run(event.photo, event.photoFilename, event.id);
    }
    return getEventById(event.id);
  }

  db.prepare(
    `INSERT INTO events (id, title, date, endDate, startTime, endTime, time, location, type, desc,
       ownerId, ownerName, link, photo, photoFilename, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    event.id, event.title, normalizedDate, normalizedEndDate, event.startTime, event.endTime,
    event.time, event.location, event.type, event.desc, event.ownerId, event.ownerName, link,
    event.photo ?? null, event.photoFilename ?? null, now, now
  );
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
// ---- RC Club Connect: check-ins ------------------------------------------

const CHECKIN_EXPIRY_HOUR = 23; // 11 PM, club local time

/** Closes any activity-log row left open for a member. */
function closeOpenActivity(db, userId, closedAt) {
  const open = db
    .prepare('SELECT id, checkedInAt FROM field_activity_log WHERE userId = ? AND checkedOutAt IS NULL')
    .all(userId);

  for (const row of open) {
    const minutes = Math.max(0, Math.round((new Date(closedAt) - new Date(row.checkedInAt)) / 60000));
    db.prepare('UPDATE field_activity_log SET checkedOutAt = ?, durationMinutes = ? WHERE id = ?')
      .run(closedAt, minutes, row.id);
  }
}

export function checkIn(userId, userName) {
  const db = getDb();
  const id = `checkin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date();
  const checkedInAt = now.toISOString();
  // 11 PM in the club's timezone, not the server's — this box runs UTC, where
  // setHours(23) would mean 7 PM Eastern. Rolls to tomorrow if it is already
  // past 11 PM, so a late check-in is not born expired.
  const expiresAt = nextClubHour(CHECKIN_EXPIRY_HOUR, now).toISOString();

  db.transaction(() => {
    // Checking in twice without checking out would otherwise leave the first
    // activity row open forever and skew every duration statistic.
    closeOpenActivity(db, userId, checkedInAt);

    db.prepare('DELETE FROM checkins WHERE userId = ?').run(userId);
    db.prepare(
      'INSERT INTO checkins (id, userId, userName, checkedInAt, expiresAt) VALUES (?, ?, ?, ?, ?)'
    ).run(id, userId, userName, checkedInAt, expiresAt);

    const logId = `activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    db.prepare(
      'INSERT INTO field_activity_log (id, userId, userName, checkedInAt) VALUES (?, ?, ?, ?)'
    ).run(logId, userId, userName, checkedInAt);
  })();

  return { id, userId, userName, checkedInAt, expiresAt };
}

export function checkOut(userId) {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM checkins WHERE userId = ?').get(userId);
  if (!existing) return null;

  db.transaction(() => {
    db.prepare('DELETE FROM checkins WHERE userId = ?').run(userId);
    closeOpenActivity(db, userId, new Date().toISOString());
  })();

  return existing;
}

export function getCheckedInCount() {
  return getDb()
    .prepare('SELECT COUNT(*) AS count FROM checkins WHERE expiresAt > ?')
    .get(new Date().toISOString()).count;
}

export function getCheckedInUsers() {
  return getDb()
    .prepare('SELECT userId, userName, checkedInAt FROM checkins WHERE expiresAt > ? ORDER BY checkedInAt ASC')
    .all(new Date().toISOString());
}

export function isUserCheckedIn(userId) {
  return Boolean(
    getDb()
      .prepare('SELECT 1 FROM checkins WHERE userId = ? AND expiresAt > ?')
      .get(userId, new Date().toISOString())
  );
}

/** Clears check-ins past their expiry, closing their activity rows. */
export function expireAllCheckins() {
  const db = getDb();
  const now = new Date().toISOString();
  const expired = db.prepare('SELECT * FROM checkins WHERE expiresAt <= ?').all(now);
  if (expired.length === 0) return 0;

  db.transaction(() => {
    for (const checkin of expired) {
      // Credit the session up to its expiry time, not to now — the sweep runs
      // on a timer and may fire well after the cut-off.
      closeOpenActivity(db, checkin.userId, checkin.expiresAt);
    }
    db.prepare('DELETE FROM checkins WHERE expiresAt <= ?').run(now);
  })();

  return expired.length;
}

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

// ---- RC Club Connect: social groups ---------------------------------------

export function getConnectGroups(userId) {
  return getDb()
    .prepare(`
      SELECT g.*, COUNT(gm.id) AS memberCount
      FROM connect_groups g
      JOIN connect_group_members gm ON gm.groupId = g.id
      WHERE g.id IN (SELECT groupId FROM connect_group_members WHERE userId = ?)
      GROUP BY g.id
      ORDER BY g.name ASC
    `)
    .all(userId);
}

export function getConnectGroup(id) {
  return getDb().prepare('SELECT * FROM connect_groups WHERE id = ?').get(id);
}

export function createConnectGroup(name, userId, userName) {
  const db = getDb();
  const id = `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const memberId = `gm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();

  db.transaction(() => {
    db.prepare(
      'INSERT INTO connect_groups (id, name, createdBy, createdByName, createdAt) VALUES (?, ?, ?, ?, ?)'
    ).run(id, name, userId, userName, now);
    // The creator joins their own group.
    db.prepare(
      'INSERT INTO connect_group_members (id, groupId, userId, userName, joinedAt) VALUES (?, ?, ?, ?, ?)'
    ).run(memberId, id, userId, userName, now);
  })();

  return getConnectGroup(id);
}

export function deleteConnectGroup(id) {
  return getDb().prepare('DELETE FROM connect_groups WHERE id = ?').run(id);
}

export function updateConnectGroupName(id, name) {
  getDb().prepare('UPDATE connect_groups SET name = ? WHERE id = ?').run(name, id);
  return getConnectGroup(id);
}

/** Members of a group, each flagged with whether they are at the field now. */
export function getConnectGroupMembers(groupId) {
  return getDb()
    .prepare(`
      SELECT gm.userId, gm.userName, gm.joinedAt,
             CASE WHEN c.userId IS NULL THEN 0 ELSE 1 END AS isCheckedIn
      FROM connect_group_members gm
      LEFT JOIN checkins c ON c.userId = gm.userId AND c.expiresAt > ?
      WHERE gm.groupId = ?
      ORDER BY gm.userName ASC
    `)
    .all(new Date().toISOString(), groupId)
    .map((member) => ({ ...member, isCheckedIn: Boolean(member.isCheckedIn) }));
}

export function addConnectGroupMember(groupId, userId, userName) {
  const id = `gm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  getDb()
    .prepare(
      'INSERT OR IGNORE INTO connect_group_members (id, groupId, userId, userName, joinedAt) VALUES (?, ?, ?, ?, ?)'
    )
    .run(id, groupId, userId, userName, new Date().toISOString());
}

export function removeConnectGroupMember(groupId, userId) {
  return getDb()
    .prepare('DELETE FROM connect_group_members WHERE groupId = ? AND userId = ?')
    .run(groupId, userId);
}

export function isConnectGroupMember(groupId, userId) {
  return Boolean(
    getDb()
      .prepare('SELECT 1 FROM connect_group_members WHERE groupId = ? AND userId = ?')
      .get(groupId, userId)
  );
}

export function getConnectGroupMemberIds(groupId) {
  return getDb()
    .prepare('SELECT userId FROM connect_group_members WHERE groupId = ?')
    .all(groupId)
    .map((row) => row.userId);
}

export function getConnectGroupMessages(groupId, page = 1, limit = 50) {
  const offset = (page - 1) * limit;
  return getDb()
    .prepare('SELECT * FROM connect_group_messages WHERE groupId = ? ORDER BY sentAt DESC LIMIT ? OFFSET ?')
    .all(groupId, limit, offset)
    .map((message) => ({ ...message, isBroadcast: Boolean(message.isBroadcast) }));
}

export function insertConnectGroupMessage(groupId, senderId, senderName, text, isBroadcast = false) {
  const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  getDb()
    .prepare(
      'INSERT INTO connect_group_messages (id, groupId, senderId, senderName, text, isBroadcast, sentAt) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .run(id, groupId, senderId, senderName, text, isBroadcast ? 1 : 0, new Date().toISOString());

  const message = getDb().prepare('SELECT * FROM connect_group_messages WHERE id = ?').get(id);
  return { ...message, isBroadcast: Boolean(message.isBroadcast) };
}

export function getGroupCheckedInMembers(groupId) {
  return getDb()
    .prepare(`
      SELECT gm.userId, gm.userName, c.checkedInAt
      FROM connect_group_members gm
      JOIN checkins c ON c.userId = gm.userId AND c.expiresAt > ?
      WHERE gm.groupId = ?
      ORDER BY c.checkedInAt ASC
    `)
    .all(new Date().toISOString(), groupId);
}

// ---- RC Club Connect: push devices and preferences ------------------------

const PUSH_PREFERENCE_FIELDS = [
  'fieldStatus',
  'events',
  'lessons',
  'groupMessages',
  'newsletters',
  'duesReminders',
  'classifieds',
  'photos',
];

export function registerPushDevice(userId, deviceToken, platform = 'ios') {
  const db = getDb();
  const now = new Date().toISOString();

  // Keyed on the device token: a handed-down phone must follow its new owner
  // rather than keep notifying the previous one.
  const existing = db.prepare('SELECT id FROM push_devices WHERE deviceToken = ?').get(deviceToken);
  if (existing) {
    db.prepare('UPDATE push_devices SET userId = ?, platform = ?, updatedAt = ? WHERE deviceToken = ?')
      .run(userId, platform, now, deviceToken);
  } else {
    const id = `device-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    db.prepare(
      'INSERT INTO push_devices (id, userId, deviceToken, platform, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, userId, deviceToken, platform, now, now);
  }

  return db.prepare('SELECT * FROM push_devices WHERE deviceToken = ?').get(deviceToken);
}

export function unregisterPushDevice(deviceToken) {
  return getDb().prepare('DELETE FROM push_devices WHERE deviceToken = ?').run(deviceToken);
}

export function getUserDevices(userId) {
  return getDb().prepare('SELECT * FROM push_devices WHERE userId = ?').all(userId);
}

export function getDevicesForUsers(userIds) {
  if (!userIds.length) return [];
  const placeholders = userIds.map(() => '?').join(',');
  return getDb().prepare(`SELECT * FROM push_devices WHERE userId IN (${placeholders})`).all(...userIds);
}

function toPreferenceBooleans(row) {
  if (!row) return null;
  const prefs = { userId: row.userId };
  for (const field of PUSH_PREFERENCE_FIELDS) prefs[field] = Boolean(row[field]);
  return prefs;
}

/** Reads a member's preferences, creating the defaults row on first access. */
export function getPushPreferences(userId) {
  const db = getDb();
  let row = db.prepare('SELECT * FROM push_preferences WHERE userId = ?').get(userId);
  if (!row) {
    db.prepare('INSERT OR IGNORE INTO push_preferences (userId) VALUES (?)').run(userId);
    row = db.prepare('SELECT * FROM push_preferences WHERE userId = ?').get(userId);
  }
  return toPreferenceBooleans(row);
}

export function updatePushPreferences(userId, preferences) {
  const db = getDb();
  getPushPreferences(userId);

  const updates = PUSH_PREFERENCE_FIELDS.filter((field) => preferences[field] !== undefined);
  if (updates.length === 0) return getPushPreferences(userId);

  const assignments = updates.map((field) => `${field} = ?`).join(', ');
  const values = updates.map((field) => (preferences[field] ? 1 : 0));
  db.prepare(`UPDATE push_preferences SET ${assignments} WHERE userId = ?`).run(...values, userId);

  return getPushPreferences(userId);
}

/** Of the given members, those who accept a given notification category. */
export function filterUsersByPushPreference(userIds, category) {
  if (!PUSH_PREFERENCE_FIELDS.includes(category)) return [];
  return userIds.filter((userId) => getPushPreferences(userId)[category]);
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

/**
 * Removes an approved photo from the public gallery.
 *
 * Separate from deleteQueueItem, which only rejects a photo that is still
 * awaiting review — once approved, a photo lives in recent_photos and nothing
 * used to be able to remove it.
 */
export function deleteRecentPhoto(id) {
  const db = getDb();
  const photo = db.prepare('SELECT id, filename, caption FROM recent_photos WHERE id = ?').get(id);
  if (!photo) return null;

  db.prepare('DELETE FROM recent_photos WHERE id = ?').run(id);
  return photo;
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
