import { NextResponse } from 'next/server';
import { approveQueueItem, getPhotoUrl } from '@/lib/photoStorage';
import { requireAdmin } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const { response } = requireAdmin();
  if (response) return response;

  const body = await request.json();
  const { id } = body;
  if (!id) {
    return NextResponse.json({ error: 'Missing photo id.' }, { status: 400 });
  }

  // This route only ever approves. A caller that sends `approved: false` or
  // `status: "rejected"` means the opposite, and silently approving anyway is
  // how a rejected photo ends up published while the client reports success.
  // Fail loudly and point at the right route instead.
  const meansReject = body.approved === false || String(body.status || '').toLowerCase() === 'rejected';
  if (meansReject) {
    return NextResponse.json(
      {
        error:
          'This endpoint only approves photos. To reject a pending photo POST to /api/photos/reject; to take down an approved one use DELETE /api/photos/recent.',
      },
      { status: 400 }
    );
  }

  const approvedPhoto = approveQueueItem(id);
  if (!approvedPhoto) {
    return NextResponse.json({ error: 'Photo not found in queue.' }, { status: 404 });
  }

  return NextResponse.json({
    ...approvedPhoto,
    src: getPhotoUrl(approvedPhoto.id),
  });
}
