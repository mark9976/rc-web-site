const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function normalizeDateString(value) {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  if (typeof value !== 'string') return '';
  const normalized = value.split('T')[0];
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(normalized)) return '';
  return normalized;
}

export function parseDateString(value) {
  const normalized = normalizeDateString(value);
  if (!normalized) return null;
  const [year, month, day] = normalized.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatDateDisplay(date) {
  const parsed = parseDateString(date);
  if (!parsed) return date || '';
  return `${monthNames[parsed.getMonth()]} ${parsed.getDate()}`;
}
