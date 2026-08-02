/**
 * Pulls a human-readable message out of a failed API response.
 * Routes reply with { error: "..." }, so showing the raw body would print JSON
 * at the user.
 */
export async function readError(response, fallback = 'Something went wrong.') {
  try {
    const text = await response.text();
    if (!text) return fallback;
    try {
      return JSON.parse(text).error || fallback;
    } catch {
      return text;
    }
  } catch {
    return fallback;
  }
}
