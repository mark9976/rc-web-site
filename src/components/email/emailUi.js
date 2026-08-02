'use client';

/** Small shared bits used across the email screens. */

export const inputClass =
  'w-full rounded-2xl border border-black/10 bg-surface-card px-4 py-2.5 text-sm outline-none focus:border-field-green focus:ring-2 focus:ring-field-green/10';

export function formatEmailDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString('default', { hour: 'numeric', minute: '2-digit' });
  if (d.getFullYear() === now.getFullYear())
    return d.toLocaleDateString('default', { month: 'short', day: 'numeric' });
  return d.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatFullDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleString('default', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** "Jane Doe <jane@x.com>" -> "Jane Doe" */
export function displayName(address) {
  const match = /^(.*?)\s*<(.+)>$/.exec(String(address || '').trim());
  return match ? match[1].replace(/^"|"$/g, '') || match[2] : address;
}

export async function apiJson(url, options) {
  const res = await fetch(url, { cache: 'no-store', ...options });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text }; }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
