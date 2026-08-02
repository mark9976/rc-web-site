/**
 * Server-side helpers for the club's local timezone.
 *
 * The server runs UTC, so anything phrased in wall-clock terms ("expire at
 * 11 PM", "which hour is busiest") is wrong if it uses Date#getHours or
 * SQLite's strftime on a UTC timestamp. These convert properly, including
 * across the DST boundary, using the Intl timezone database.
 */

export const CLUB_TIMEZONE = 'America/New_York';

/** Milliseconds to add to a UTC instant to get the club's wall-clock reading. */
function offsetAt(date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: CLUB_TIMEZONE,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value])
  );

  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    // Intl renders midnight as hour "24" in some ICU versions.
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second)
  );
  return asUtc - date.getTime();
}

/** The club-local calendar parts of a UTC instant. */
export function clubParts(date = new Date()) {
  const shifted = new Date(date.getTime() + offsetAt(date));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
    dateKey: shifted.toISOString().slice(0, 10),
  };
}

/**
 * The UTC instant for a wall-clock time in the club's timezone.
 *
 * Applies the offset twice: the first guess can land on the wrong side of a DST
 * transition, so the offset is recomputed at the candidate instant.
 */
export function clubTimeToUtc(year, month, day, hour = 0, minute = 0) {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const corrected = new Date(guess.getTime() - offsetAt(guess));
  return new Date(guess.getTime() - offsetAt(corrected));
}

/**
 * The next time it is `hour` o'clock in the club's timezone.
 *
 * Rolls to tomorrow when that hour has already passed today, so a check-in made
 * at 11:30 PM does not expire the instant it is created.
 */
export function nextClubHour(hour, from = new Date()) {
  const parts = clubParts(from);
  let target = clubTimeToUtc(parts.year, parts.month, parts.day, hour, 0);
  if (target <= from) {
    const tomorrow = new Date(from.getTime() + 24 * 60 * 60 * 1000);
    const next = clubParts(tomorrow);
    target = clubTimeToUtc(next.year, next.month, next.day, hour, 0);
  }
  return target;
}
