/**
 * Values shared by server routes and client components.
 *
 * Kept out of photoStorage.js on purpose: that module pulls in better-sqlite3,
 * which cannot be imported from a client component.
 */

// Displayed in this order on the About page, so the board reads sensibly
// rather than alphabetically.
export const OFFICER_TITLES = [
  'President',
  'Vice President',
  'Secretary',
  'Treasurer',
  'Safety Officer',
  'Field Marshal',
  'Newsletter Editor',
  'Webmaster',
];

/**
 * Club dues, from the paper application (rev 10/2021).
 *
 * Amounts are whole dollars. Keep these in step with the printed form — the
 * online application shows the same figures and totals them the same way.
 */
export const MEMBERSHIP_CLASSES = [
  { value: 'regular', label: 'Regular — age 19 to 64', amount: 40 },
  { value: 'youth', label: 'Youth (Jr.) — under 19', amount: 20 },
  { value: 'senior', label: 'Senior / Retiree — age 65 or any pension', amount: 30 },
];

export const FAMILY_ADD_ON = 5;   // spouse and children under 19
export const LATE_FEE = 10;       // renewals after 31 December

export const CLUB_TREASURER = {
  name: 'Rene Marquis',
  address: '158 Frothingham Ave, Jeannette, PA 15644-1868',
  phone: '724-216-8327',
};

/** Verbatim from the paper form; this is a liability waiver, so do not reword. */
export const ACCEPTANCE_STATEMENT =
  'If accepted into Laurel Highlands Model Airplane Club (LHMAC), I agree to serve as an officer if ' +
  'nominated, participate in club field maintenance, and comply with all county, LHMAC & Academy of ' +
  'Model Aeronautics (AMA) field and safety regulations. I am aware that modeling may present hazards ' +
  'and I accept and relieve the Laurel Highlands Model Airplane Club, Inc., its officers, and members ' +
  'from all liabilities for personal injury, property damage, or wrongful death caused by negligence.';

export const CLUB_APPLICATION_STATUSES = ['new', 'approved', 'paid', 'rejected'];

export const CLASSIFIED_TYPES = ['For Sale', 'Wanted'];

export const CLASSIFIED_CATEGORIES = [
  'Airframes',
  'Radios',
  'Engines',
  'Batteries',
  'Field Equipment',
  'Other',
];

/**
 * Admin-replaceable images, served from the database at
 * /api/site-images/<slot>.
 *
 * `logo` is the club crest. The iOS app's clubs.json points at
 * /api/site-images/logo, so this is the single source of truth for the mark —
 * the website and the app both read it from here.
 */
export const SITE_IMAGE_SLOTS = ['hero', 'logo'];

export const CLASSIFIED_LIFETIME_DAYS = 90;

/**
 * Flying sites, used for the maps and directions links on the Fields page.
 *
 * Mammoth Park's coordinates match the ones already used elsewhere in the site.
 * The float-fly pin sits at the north end of Donegal Lake, placed from the
 * location Mark marked on the map on 2026-08-02.
 */
export const FLYING_SITES = {
  mammoth: {
    name: 'Mammoth Park Flying Field',
    address: 'Klaka Road, Mammoth, PA 15664',
    lat: 40.213889,
    lon: -79.462197,
    verified: true,
  },
  acmeDam: {
    name: 'Chestnut Ridge Park — Acme Dam',
    address: 'Donegal Lake, Donegal, PA 15628',
    // West shore at the north end of Donegal Lake, by the dam.
    lat: 40.1439,
    lon: -79.3733,
    verified: true,
  },
};

export const EXPERIENCE_LEVELS = [
  'Complete beginner',
  'Some simulator time',
  'Flown with help before',
  'Returning after a break',
];
