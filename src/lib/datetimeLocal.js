/**
 * Bridges `<input type="datetime-local">` and the UTC instants stored in the
 * database.
 *
 * A datetime-local value has no timezone ("2026-08-15T10:00"). JS parses that
 * string as *local* time, which is what we want: the admin means 10am where the
 * field is. Converting straight to ISO gives an unambiguous instant, so the
 * server (which runs in UTC) compares the right moment.
 */

/** "2026-08-15T10:00" in the browser's timezone -> UTC ISO instant. */
export function localInputToIso(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** UTC ISO instant -> "2026-08-15T10:00" for a datetime-local input. */
export function isoToLocalInput(iso) {
  if (!iso) return '';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '';

  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}` +
    `T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`
  );
}

/** Human-readable local rendering of a stored instant. */
export function formatInstant(iso) {
  if (!iso) return '';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString('default', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** "Sat, Aug 15, 10:00 AM – 2:00 PM" style range, collapsing a same-day end. */
export function formatInstantRange(startIso, endIso) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${startIso} – ${endIso}`;
  }

  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();

  const endText = sameDay
    ? end.toLocaleTimeString('default', { hour: 'numeric', minute: '2-digit' })
    : formatInstant(endIso);

  return `${formatInstant(startIso)} – ${endText}`;
}
