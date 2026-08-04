import { NextResponse } from 'next/server';
import {
  getClubApplications,
  insertClubApplication,
  updateClubApplicationStatus,
  deleteClubApplication,
} from '@/lib/photoStorage';
import { MEMBERSHIP_CLASSES, FAMILY_ADD_ON, LATE_FEE, CLUB_APPLICATION_STATUSES } from '@/lib/clubConstants';
import { requireAdmin } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

const LIMITS = {
  name: 120, amaNumber: 20, faaNumber: 30, address: 200, city: 80, state: 20, zip: 15,
  homePhone: 30, mobilePhone: 30, email: 160, dateOfBirth: 20,
  emergencyName: 160, emergencyPhone: 30, signature: 120, guardianSignature: 120,
};

const clean = (value, limit) => value?.toString().trim().slice(0, limit) || '';

/** Recomputed here rather than trusted: the total decides what is owed. */
function calculateDues({ membershipClass, includesFamily, lateFee }) {
  const base = MEMBERSHIP_CLASSES.find((option) => option.value === membershipClass);
  if (!base) return null;
  return base.amount + (includesFamily ? FAMILY_ADD_ON : 0) + (lateFee ? LATE_FEE : 0);
}

// Applications carry dates of birth, addresses and phone numbers, so the list
// is admin-only. Submission below is public.
export async function GET(request) {
  const { response } = requireAdmin();
  if (response) return response;

  const status = new URL(request.url).searchParams.get('status');
  return NextResponse.json({
    applications: getClubApplications({ status: CLUB_APPLICATION_STATUSES.includes(status) ? status : null }),
  });
}

export async function POST(request) {
  const body = await request.json();

  const fields = {};
  for (const [key, limit] of Object.entries(LIMITS)) fields[key] = clean(body[key], limit);

  const applicationType = body.applicationType === 'renewal' ? 'renewal' : 'new';
  const membershipClass = body.membershipClass?.toString();
  const includesFamily = Boolean(body.includesFamily);
  const lateFee = Boolean(body.lateFee);

  // AMA number is optional here: applicants often join the club before they
  // have one. The column is NOT NULL, and clean() yields '' rather than null,
  // so a blank still satisfies the constraint.
  if (!fields.name || !fields.email) {
    return NextResponse.json({ error: 'Name and email are required.' }, { status: 400 });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fields.email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  const duesTotal = calculateDues({ membershipClass, includesFamily, lateFee });
  if (duesTotal === null) {
    return NextResponse.json({ error: 'Choose a membership type.' }, { status: 400 });
  }

  // The waiver is the point of the form; a typed name is the signature.
  if (!fields.signature) {
    return NextResponse.json({ error: 'Type your name to sign the acceptance statement.' }, { status: 400 });
  }
  if (!body.agreed) {
    return NextResponse.json({ error: 'You must accept the acceptance statement to apply.' }, { status: 400 });
  }

  // A youth application needs a parent or guardian to sign as well.
  if (membershipClass === 'youth' && !fields.guardianSignature) {
    return NextResponse.json(
      { error: 'A parent or guardian must also sign for applicants under 19.' },
      { status: 400 }
    );
  }

  const familyMembers = (Array.isArray(body.familyMembers) ? body.familyMembers : [])
    .slice(0, 3)
    .map((member) => ({
      name: clean(member?.name, 120),
      dob: clean(member?.dob, 20),
      amaNumber: clean(member?.amaNumber, 20),
      email: clean(member?.email, 160),
    }))
    .filter((member) => member.name);

  insertClubApplication({ ...fields, applicationType, membershipClass, includesFamily, lateFee, duesTotal, familyMembers });

  // Nothing is echoed back: this endpoint is public and the row holds the
  // applicant's date of birth and home address.
  return NextResponse.json({ success: true, duesTotal });
}

export async function PATCH(request) {
  const { user, response } = requireAdmin();
  if (response) return response;

  const { id, status, adminNotes } = await request.json();
  if (!id || !CLUB_APPLICATION_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Provide an application id and a valid status.' }, { status: 400 });
  }

  const application = updateClubApplicationStatus(id, status, {
    reviewedBy: user.name,
    adminNotes: adminNotes?.toString().slice(0, 1000),
  });
  if (!application) return NextResponse.json({ error: 'Application not found.' }, { status: 404 });

  return NextResponse.json({ application });
}

export async function DELETE(request) {
  const { response } = requireAdmin();
  if (response) return response;

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: 'Missing application id.' }, { status: 400 });

  deleteClubApplication(id);
  return NextResponse.json({ success: true });
}
