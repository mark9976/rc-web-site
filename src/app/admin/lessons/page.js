'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import AdminShell from '@/components/admin/AdminShell';
import { useAuth } from '@/components/AuthProvider';
import { readError } from '@/lib/apiClient';
import { GraduationCap, Check, Trash2 } from 'lucide-react';

const memberInputClass =
  'w-full rounded-3xl border border-black/10 bg-surface-card px-4 py-3 text-sm outline-none focus:border-field-green focus:ring-2 focus:ring-field-green/10';

function formatTimestamp(value) {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString('default', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function Page() {
  const auth = useAuth();
  const [lessonRequests, setLessonRequests] = useState([]);

  const refreshAdminData = useCallback(async () => {
    const res = await fetch('/api/lessons', { cache: 'no-store' });
    if (res.ok) setLessonRequests((await res.json()).lessonRequests ?? []);
  }, []);

  useEffect(() => {
    if (auth.isAdmin) refreshAdminData();
  }, [auth.isAdmin, refreshAdminData]);

  const handleLessonAction = async (id, body, method) => {
    await fetch('/api/lessons', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...body }),
    });
    await refreshAdminData();
  };

  return (
    <AdminShell title="Lesson Requests" subtitle="Flight instruction enquiries">
      <>

        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-xl flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-field-green" />
              Flying Lesson Requests
            </h2>
            <span className="text-xs font-display font-bold bg-field-green/10 text-field-green px-2 py-1 rounded-full shrink-0">
              {lessonRequests.filter((r) => r.status === 'new').length} new
            </span>
          </div>

          <div className="space-y-3">
            {lessonRequests.length === 0 ? (
              <div className="rounded-3xl bg-surface-muted p-6 text-center text-sm text-ink-muted">
                No lesson requests yet. The form is on the Membership page.
              </div>
            ) : (
              lessonRequests.map((lesson) => (
                <div
                  key={lesson.id}
                  className={`rounded-3xl border p-4 ${lesson.status === 'new' ? 'border-field-green/30 bg-field-green/5' : 'border-black/10 bg-surface-card'}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display font-semibold text-ink">
                        {lesson.name}
                        <span className="ml-2 rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                          {lesson.status}
                        </span>
                      </p>
                      <p className="text-xs text-ink-muted mt-1">
                        <a href={`mailto:${lesson.email}`} className="text-field-green">{lesson.email}</a>
                        {' · '}{lesson.phone}
                      </p>
                      <p className="text-xs text-ink-light mt-1">
                        Wants: {lesson.instructorName || 'any instructor'} · {lesson.experience}
                        {lesson.aircraft ? ` · flies ${lesson.aircraft}` : ''}
                      </p>
                    </div>
                    <span className="text-xs text-ink-light shrink-0">{formatTimestamp(lesson.submittedAt)}</span>
                  </div>

                  {lesson.availability ? (
                    <p className="mt-3 text-sm text-ink-muted"><strong>Available:</strong> {lesson.availability}</p>
                  ) : null}
                  {lesson.notes ? (
                    <p className="mt-1 text-sm text-ink-muted whitespace-pre-wrap">{lesson.notes}</p>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {lesson.status !== 'scheduled' ? (
                      <button onClick={() => handleLessonAction(lesson.id, { status: 'scheduled' }, 'PATCH')} className="btn-secondary text-xs">
                        Mark scheduled
                      </button>
                    ) : null}
                    {lesson.status !== 'completed' ? (
                      <button onClick={() => handleLessonAction(lesson.id, { status: 'completed' }, 'PATCH')} className="btn-secondary text-xs">
                        Mark completed
                      </button>
                    ) : null}
                    <a
                      href={`mailto:${lesson.email}?subject=${encodeURIComponent('LHMAC flying lesson')}`}
                      className="btn-secondary text-xs"
                    >
                      Email
                    </a>
                    <button
                      onClick={() => {
                        if (window.confirm(`Delete the lesson request from ${lesson.name}?`)) {
                          handleLessonAction(lesson.id, {}, 'DELETE');
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded-full bg-flyday-nogo/10 px-3 py-1 text-xs font-semibold text-flyday-nogo hover:bg-flyday-nogo/20"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </>
    </AdminShell>
  );
}
