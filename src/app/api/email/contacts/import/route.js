import { upsertContact } from '@/lib/email/emailStore';
import { handler, ok, fail } from '@/lib/email/routeHelpers';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Minimal RFC 4180 parser: handles quoted fields, embedded commas and "" escapes. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; }
        else inQuotes = false;
      } else field += char;
      continue;
    }

    if (char === '"') inQuotes = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\r') { /* handled by \n */ }
    else if (char === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += char;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

export const POST = handler(async ({ request }) => {
  const form = await request.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') return fail('Attach a CSV file.');

  const rows = parseCsv(await file.text());
  if (rows.length < 2) return fail('The CSV needs a header row and at least one contact.');

  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const emailIndex = header.indexOf('email');
  if (emailIndex === -1) return fail('The CSV must have an "email" column.');

  const column = (row, name) => {
    const index = header.indexOf(name);
    return index === -1 ? null : row[index]?.trim() || null;
  };

  let imported = 0;
  const skipped = [];

  for (const [i, row] of rows.slice(1).entries()) {
    const email = row[emailIndex]?.trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email)) {
      skipped.push({ line: i + 2, reason: email ? `Invalid address "${email}"` : 'Missing email' });
      continue;
    }

    const tags = column(row, 'tags');
    upsertContact({
      email,
      first_name: column(row, 'first_name') || column(row, 'firstname'),
      last_name: column(row, 'last_name') || column(row, 'lastname'),
      contact_type: column(row, 'contact_type') === 'internal' ? 'internal' : 'external',
      tags: tags ? tags.split(/[|;]/).map((t) => t.trim()).filter(Boolean) : [],
      notes: column(row, 'notes'),
    });
    imported += 1;
  }

  return ok({ imported, skipped: skipped.slice(0, 25), skippedCount: skipped.length });
});
