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

export const CLASSIFIED_TYPES = ['For Sale', 'Wanted'];

export const CLASSIFIED_CATEGORIES = [
  'Airframes',
  'Radios',
  'Engines',
  'Batteries',
  'Field Equipment',
  'Other',
];

export const SITE_IMAGE_SLOTS = ['hero'];

export const CLASSIFIED_LIFETIME_DAYS = 90;

/**
 * Flying sites, used for the maps and directions links on the Fields page.
 *
 * Mammoth Park's coordinates match the ones already used elsewhere in the site.
 * VERIFY the Acme Dam coordinates before relying on them for navigation — they
 * are an approximation of the Chestnut Ridge Park float-fly site, not a surveyed
 * point.
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
    address: 'Acme, PA 15610',
    lat: 40.1361,
    lon: -79.4283,
    verified: false,
  },
};

export const EXPERIENCE_LEVELS = [
  'Complete beginner',
  'Some simulator time',
  'Flown with help before',
  'Returning after a break',
];
