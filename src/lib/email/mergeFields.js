/**
 * {{field}} substitution for templates and blasts.
 *
 * Values are HTML-escaped on the way in: contact names come from user input and
 * from imported CSVs, and the result is injected into an HTML email body.
 */

export const AVAILABLE_MERGE_FIELDS = [
  { key: 'first_name', label: 'First name', sample: 'Jane' },
  { key: 'last_name', label: 'Last name', sample: 'Doe' },
  { key: 'full_name', label: 'Full name', sample: 'Jane Doe' },
  { key: 'email', label: 'Email address', sample: 'jane@example.com' },
  { key: 'club_name', label: 'Club name', sample: 'Laurel Highlands Model Airplane Club' },
];

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Builds the substitution map for one contact. */
export function mergeContextForContact(contact) {
  const first = contact?.first_name || '';
  const last = contact?.last_name || '';
  const full = [first, last].filter(Boolean).join(' ');

  return {
    first_name: first,
    last_name: last,
    // Falling back to the address means a greeting never reads "Hi ,".
    full_name: full || contact?.email || '',
    email: contact?.email || '',
    club_name: 'Laurel Highlands Model Airplane Club',
  };
}

/** Replaces {{field}} tokens. Unknown fields render empty rather than leaking the token. */
export function applyMergeFields(body, context) {
  return String(body || '').replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_match, field) =>
    escapeHtml(context?.[field.toLowerCase()] ?? '')
  );
}

/** Lists the {{fields}} actually used in a body, for validation and preview. */
export function usedMergeFields(body) {
  const found = new Set();
  for (const match of String(body || '').matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi)) {
    found.add(match[1].toLowerCase());
  }
  return [...found];
}

export function sampleContext() {
  return Object.fromEntries(AVAILABLE_MERGE_FIELDS.map((f) => [f.key, f.sample]));
}
