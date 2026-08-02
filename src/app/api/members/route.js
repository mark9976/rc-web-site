import { NextResponse } from 'next/server';
import {
  getUsers,
  getUserById,
  deleteUser,
  updateUser,
  isUsernameTaken,
  resetUserPassword,
  getDashboardCounts,
  serializeUser,
} from '@/lib/photoStorage';
import { OFFICER_TITLES } from '@/lib/clubConstants';
import { requireAdmin } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

const TEMPORARY_PASSWORD = 'welcome';
const LIMITS = { name: 120, username: 40, email: 160, phone: 40, address: 240, amaNumber: 20, instructorNote: 300 };

function clean(value, limit) {
  return value === undefined ? undefined : value.toString().trim().slice(0, limit);
}

export async function GET() {
  const { response } = requireAdmin();
  if (response) return response;

  return NextResponse.json({ members: getUsers(), counts: getDashboardCounts() });
}

export async function PATCH(request) {
  const { user, response } = requireAdmin();
  if (response) return response;

  const body = await request.json();
  const id = body.id?.toString();
  if (!id) return NextResponse.json({ error: 'Missing member id.' }, { status: 400 });

  const target = getUserById(id);
  if (!target) return NextResponse.json({ error: 'Member not found.' }, { status: 404 });

  // Admin-issued password reset, kept separate from ordinary profile edits.
  if (body.action === 'resetPassword') {
    resetUserPassword(id, TEMPORARY_PASSWORD);
    return NextResponse.json({ success: true, temporaryPassword: TEMPORARY_PASSWORD });
  }

  const fields = {
    name: clean(body.name, LIMITS.name),
    username: clean(body.username, LIMITS.username),
    email: clean(body.email, LIMITS.email),
    phone: clean(body.phone, LIMITS.phone),
    address: clean(body.address, LIMITS.address),
    amaNumber: clean(body.amaNumber, LIMITS.amaNumber),
    role: body.role,
    isInstructor: body.isInstructor === undefined ? undefined : body.isInstructor ? 1 : 0,
    instructorNote: clean(body.instructorNote, LIMITS.instructorNote),
    officerTitle: clean(body.officerTitle, 60),
  };

  if (fields.officerTitle) {
    if (!OFFICER_TITLES.includes(fields.officerTitle)) {
      return NextResponse.json({ error: 'Choose a valid officer title.' }, { status: 400 });
    }
  }

  if (fields.name !== undefined && !fields.name) {
    return NextResponse.json({ error: 'Name cannot be empty.' }, { status: 400 });
  }

  if (fields.username !== undefined) {
    if (!/^[a-z0-9._-]{3,40}$/i.test(fields.username)) {
      return NextResponse.json(
        { error: 'Username must be 3-40 characters, letters/numbers/._- only.' },
        { status: 400 }
      );
    }
    if (isUsernameTaken(fields.username, id)) {
      return NextResponse.json({ error: 'That username is already taken.' }, { status: 409 });
    }
  }

  if (fields.email) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fields.email)) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
    }
  }

  if (fields.role !== undefined) {
    if (!['admin', 'member'].includes(fields.role)) {
      return NextResponse.json({ error: 'Role must be admin or member.' }, { status: 400 });
    }
    // Guard against an admin removing their own last route back in.
    if (id === user.id && fields.role !== 'admin') {
      return NextResponse.json({ error: 'You cannot remove your own admin access.' }, { status: 400 });
    }
  }

  const updated = updateUser(id, fields);
  return NextResponse.json({ member: serializeUser(updated) });
}

export async function DELETE(request) {
  const { user, response } = requireAdmin();
  if (response) return response;

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: 'Missing member id.' }, { status: 400 });
  if (id === user.id) {
    return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 });
  }

  deleteUser(id);
  return NextResponse.json({ success: true });
}
