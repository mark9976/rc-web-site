import { NextResponse } from 'next/server';
import { listContacts } from '@/lib/email/emailStore';
import { handler } from '@/lib/email/routeHelpers';

export const dynamic = 'force-dynamic';

/** Quotes a CSV cell, and blocks spreadsheet formula injection. */
function csvCell(value) {
  let s = String(value ?? '');
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export const GET = handler(async () => {
  const rows = listContacts({ type: 'all' });
  const header = ['email', 'first_name', 'last_name', 'contact_type', 'tags', 'notes'];
  const csv = [
    header.join(','),
    ...rows.map((c) =>
      [c.email, c.first_name, c.last_name, c.contact_type, (c.tags || []).join('|'), c.notes].map(csvCell).join(',')
    ),
  ].join('\r\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="lhmac-contacts-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
});
