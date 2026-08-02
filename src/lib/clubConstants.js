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
