import { NextResponse } from 'next/server';
import { getNewsletters, insertNewsletter, deleteNewsletter, normalizeFilename } from '@/lib/photoStorage';
import { normalizeDateString } from '@/lib/dateUtils';
import { requireAdmin } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 25 * 1024 * 1024; // matches client_max_body_size in the nginx site
const PDF_MAGIC = '%PDF-';

// Published newsletters are public.
export async function GET() {
  return NextResponse.json({ newsletters: getNewsletters() });
}

export async function POST(request) {
  const { user, response } = requireAdmin();
  if (response) return response;

  const form = await request.formData();
  const title = form.get('title')?.toString().trim().slice(0, 160);
  const issueDate = normalizeDateString(form.get('issueDate')?.toString());
  const file = form.get('newsletter');

  if (!title) {
    return NextResponse.json({ error: 'Give the newsletter a title.' }, { status: 400 });
  }
  if (!issueDate) {
    return NextResponse.json({ error: 'Choose the issue date.' }, { status: 400 });
  }
  if (!file || typeof file === 'string' || !file.name || !file.arrayBuffer) {
    return NextResponse.json({ error: 'Attach a PDF file.' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Newsletters must be 25 MB or smaller.' }, { status: 413 });
  }

  const content = Buffer.from(await file.arrayBuffer());

  // Check the file's own header rather than trusting the declared MIME type,
  // which the client controls.
  if (content.subarray(0, PDF_MAGIC.length).toString('latin1') !== PDF_MAGIC) {
    return NextResponse.json({ error: 'That file is not a PDF.' }, { status: 400 });
  }

  const newsletter = insertNewsletter({
    title,
    issueDate,
    filename: normalizeFilename(file.name),
    byteSize: content.length,
    uploadedBy: user.name,
    content,
  });
  return NextResponse.json({ newsletter });
}

export async function DELETE(request) {
  const { response } = requireAdmin();
  if (response) return response;

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: 'Missing newsletter id.' }, { status: 400 });

  deleteNewsletter(id);
  return NextResponse.json({ success: true });
}
