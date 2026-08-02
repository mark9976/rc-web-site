import { NextResponse } from 'next/server';
import { getQueueItems, deleteQueueItem } from '@/lib/photoStorage';
import { requireAdmin } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { response } = requireAdmin();
  if (response) return response;

  return NextResponse.json(getQueueItems());
}

export async function DELETE(request) {
  const { response } = requireAdmin();
  if (response) return response;

  const { id } = await request.json();
  if (!id) {
    return NextResponse.json({ error: 'Missing photo id.' }, { status: 400 });
  }

  deleteQueueItem(id);
  return NextResponse.json({ success: true });
}
