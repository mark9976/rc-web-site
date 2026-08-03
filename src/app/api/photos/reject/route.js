import { NextResponse } from 'next/server';
import { getQueuedPhotoContent, deleteQueueItem } from '@/lib/photoStorage';
import { requireAdmin } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

/**
 * Rejects a photo awaiting review, discarding it.
 *
 * The counterpart to /api/photos/approve. This is the same operation as
 * `DELETE /api/photos/queue`, exposed under an explicit name because "reject"
 * is what callers reach for — and reaching for a route that did not exist
 * previously meant a 404 that was easy to mistake for a silent failure.
 *
 * Returns 404 for an id that is not in the queue, rather than a hollow success,
 * so a caller can tell "rejected" from "there was nothing to reject" — an
 * already-approved photo has to be removed with DELETE /api/photos/recent.
 */
export async function POST(request) {
  const { response } = requireAdmin();
  if (response) return response;

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: 'Missing photo id.' }, { status: 400 });

  if (!getQueuedPhotoContent(id)) {
    return NextResponse.json(
      {
        error:
          'No pending photo with that id. If it has already been approved, remove it with DELETE /api/photos/recent.',
      },
      { status: 404 }
    );
  }

  deleteQueueItem(id);
  return NextResponse.json({ success: true, rejected: id });
}
