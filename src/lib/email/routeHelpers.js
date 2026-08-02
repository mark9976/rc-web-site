import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

/** Every email route is admin-only; this keeps the guard in one place. */
export function guard() {
  return requireAdmin();
}

export function ok(data = {}) {
  return NextResponse.json(data);
}

export function fail(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Wraps a handler so an unexpected throw becomes a 500 instead of a crash. */
export function handler(fn) {
  return async (request, context) => {
    const { user, response } = guard();
    if (response) return response;
    try {
      return await fn({ request, context, user });
    } catch (error) {
      console.error('[email api]', error);
      return fail(error.message || 'Unexpected server error.', 500);
    }
  };
}
