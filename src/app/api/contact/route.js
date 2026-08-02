import { NextResponse } from 'next/server';
import {
  getContactMessages,
  insertContactMessage,
  markContactMessageRead,
  deleteContactMessage,
} from '@/lib/photoStorage';
import { requireAdmin } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

const SUBJECTS = ['General Inquiry', 'Membership Question', 'Flying Lessons', 'Event Information', 'Other'];

/** The inbox holds messages from the public, so reading it is admin-only. */
export async function GET() {
  const { response } = requireAdmin();
  if (response) return response;

  return NextResponse.json({ messages: getContactMessages() });
}

export async function POST(request) {
  const body = await request.json();
  const name = body.name?.toString().trim().slice(0, 120);
  const email = body.email?.toString().trim().slice(0, 160);
  const message = body.message?.toString().trim().slice(0, 4000);
  const subject = SUBJECTS.includes(body.subject) ? body.subject : 'General Inquiry';

  if (!name || !email || !message) {
    return NextResponse.json({ error: 'Name, email, and message are required.' }, { status: 400 });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  insertContactMessage({ name, email, subject, message });
  return NextResponse.json({ success: true });
}

export async function PATCH(request) {
  const { response } = requireAdmin();
  if (response) return response;

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: 'Missing message id.' }, { status: 400 });

  markContactMessageRead(id);
  return NextResponse.json({ success: true });
}

export async function DELETE(request) {
  const { response } = requireAdmin();
  if (response) return response;

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: 'Missing message id.' }, { status: 400 });

  deleteContactMessage(id);
  return NextResponse.json({ success: true });
}
