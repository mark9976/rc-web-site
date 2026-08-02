import { NextResponse } from 'next/server';
import {
  getLessonRequests,
  insertLessonRequest,
  updateLessonRequestStatus,
  deleteLessonRequest,
  getInstructors,
  getLessonRequestById,
  acceptLessonRequest,
  scheduleLessonRequest,
  completeLessonRequest,
} from '@/lib/photoStorage';
import { requireAdmin, requireUser, getCurrentUser } from '@/lib/apiAuth';
import { sendPushToUser } from '@/lib/pushService';

export const dynamic = 'force-dynamic';

const EXPERIENCE_LEVELS = [
  'Complete beginner',
  'Some simulator time',
  'Flown with help before',
  'Returning after a break',
];
const STATUSES = ['new', 'accepted', 'scheduled', 'completed'];
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

  // Anonymous requests are allowed; when the requester is signed in we keep
  // their id so the app can notify them when an instructor responds.
  const requester = getCurrentUser();
  insertLessonRequest({
    ...fields,
    experience,
    instructorId,
    instructorName,
    studentUserId: requester?.id ?? null,
  });
  return NextResponse.json({ success: true });
}

/**
 * Instructor workflow: accept -> schedule -> complete.
 *
 * Open to admins and to members flagged as instructors. The student is pushed
 * on accept and schedule, but only if they were signed in when they applied —
 * anonymous requests have no account to notify.
 */
export async function PUT(request) {
  const { user, response } = requireUser();
  if (response) return response;
  if (user.role !== 'admin' && !user.isInstructor) {
    return NextResponse.json({ error: 'Instructor access required.' }, { status: 403 });
  }

  const body = await request.json();
  const { id, action } = body;
  if (!id) return NextResponse.json({ error: 'Missing request id.' }, { status: 400 });

  const existing = getLessonRequestById(id);
  if (!existing) return NextResponse.json({ error: 'Request not found.' }, { status: 404 });

  let lessonRequest;
  let notification = null;

  if (action === 'accept') {
    lessonRequest = acceptLessonRequest(id, user.id, user.name);
    notification = { title: 'Lesson request accepted', body: `${user.name} will be your instructor.` };
  } else if (action === 'schedule') {
    const scheduledDate = body.scheduledDate?.toString();
    if (!scheduledDate || Number.isNaN(new Date(scheduledDate).getTime())) {
      return NextResponse.json({ error: 'Provide a valid scheduledDate.' }, { status: 400 });
    }
    lessonRequest = scheduleLessonRequest(id, new Date(scheduledDate).toISOString());
    notification = { title: 'Lesson scheduled', body: `Your lesson with ${lessonRequest.instructorName || user.name} is booked.` };
  } else if (action === 'complete') {
    lessonRequest = completeLessonRequest(id);
  } else {
    return NextResponse.json({ error: 'Action must be accept, schedule, or complete.' }, { status: 400 });
  }

  if (notification && lessonRequest.studentUserId) {
    await sendPushToUser(
      lessonRequest.studentUserId,
      notification.title,
      notification.body,
      { type: 'lesson', lessonId: id },
      'lessons'
    );
  }

  return NextResponse.json({ lessonRequest });
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
