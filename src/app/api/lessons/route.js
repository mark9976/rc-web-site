import { NextResponse } from 'next/server';
import {
  getLessonRequests,
  insertLessonRequest,
  updateLessonRequestStatus,
  deleteLessonRequest,
  getInstructors,
} from '@/lib/photoStorage';
import { requireAdmin } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

const EXPERIENCE_LEVELS = [
  'Complete beginner',
  'Some simulator time',
  'Flown with help before',
  'Returning after a break',
];
const STATUSES = ['new', 'scheduled', 'completed'];
const LIMITS = { name: 120, email: 160, phone: 40, aircraft: 160, availability: 300, notes: 1000 };

/** Requests contain applicant contact details, so the list is admin-only. */
export async function GET() {
  const { response } = requireAdmin();
  if (response) return response;

  return NextResponse.json({ lessonRequests: getLessonRequests() });
}

export async function POST(request) {
  const body = await request.json();

  const fields = {};
  for (const [key, limit] of Object.entries(LIMITS)) {
    fields[key] = body[key]?.toString().trim().slice(0, limit) || '';
  }
  const experience = body.experience?.toString();

  if (!fields.name || !fields.email || !fields.phone) {
    return NextResponse.json({ error: 'Name, email, and phone are required.' }, { status: 400 });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fields.email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }
  if (!EXPERIENCE_LEVELS.includes(experience)) {
    return NextResponse.json({ error: 'Choose your experience level.' }, { status: 400 });
  }

  // "No preference" is allowed; a named instructor must actually be one.
  let instructorId = body.instructorId?.toString() || '';
  let instructorName = null;
  if (instructorId) {
    const instructor = getInstructors().find((candidate) => candidate.id === instructorId);
    if (!instructor) {
      return NextResponse.json({ error: 'That instructor is not available.' }, { status: 400 });
    }
    instructorName = instructor.name;
  } else {
    instructorId = null;
  }

  insertLessonRequest({ ...fields, experience, instructorId, instructorName });
  return NextResponse.json({ success: true });
}

export async function PATCH(request) {
  const { response } = requireAdmin();
  if (response) return response;

  const { id, status } = await request.json();
  if (!id || !STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Provide a request id and a valid status.' }, { status: 400 });
  }

  updateLessonRequestStatus(id, status);
  return NextResponse.json({ success: true });
}

export async function DELETE(request) {
  const { response } = requireAdmin();
  if (response) return response;

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: 'Missing request id.' }, { status: 400 });

  deleteLessonRequest(id);
  return NextResponse.json({ success: true });
}
