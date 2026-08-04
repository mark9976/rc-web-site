'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import AdminShell from '@/components/admin/AdminShell';
import { useAuth } from '@/components/AuthProvider';
import { readError } from '@/lib/apiClient';
import { Newspaper, Trash2, Upload, Eye } from 'lucide-react';
import { parseDateString } from '@/lib/dateUtils';

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

/** Newsletters belong to a month; parse locally so the month never shifts. */
function formatIssueMonth(issueDate) {
  const parsed = parseDateString(issueDate);
  return parsed ? parsed.toLocaleDateString('default', { month: 'long', year: 'numeric' }) : issueDate || '';
}

export default function Page() {
  const auth = useAuth();
  const [newsletters, setNewsletters] = useState([]);
  const [newsletterDraft, setNewsletterDraft] = useState({ title: '', issueDate: '' });
  const [newsletterFile, setNewsletterFile] = useState(null);
  const [newsletterError, setNewsletterError] = useState('');
  const [uploadingNewsletter, setUploadingNewsletter] = useState(false);

  const refreshAdminData = useCallback(async () => {
    const res = await fetch('/api/newsletters', { cache: 'no-store' });
    if (res.ok) setNewsletters((await res.json()).newsletters ?? []);
  }, []);

  useEffect(() => {
    if (auth.isAdmin) refreshAdminData();
  }, [auth.isAdmin, refreshAdminData]);

  const uploadNewsletter = async (event) => {
    event.preventDefault();
    setNewsletterError('');

    if (!newsletterDraft.title.trim() || !newsletterDraft.issueDate || !newsletterFile) {
      setNewsletterError('Title, issue date, and a PDF file are all required.');
      return;
    }

    setUploadingNewsletter(true);
    try {
      const body = new FormData();
      body.append('title', newsletterDraft.title);
      body.append('issueDate', newsletterDraft.issueDate);
      body.append('newsletter', newsletterFile);

      const res = await fetch('/api/newsletters', { method: 'POST', body });
      if (!res.ok) throw new Error(await readError(res, 'Unable to upload the newsletter.'));

      setNewsletterDraft({ title: '', issueDate: '' });
      setNewsletterFile(null);
      await refreshAdminData();
    } catch (uploadError) {
      setNewsletterError(uploadError.message);
    } finally {
      setUploadingNewsletter(false);
    }
  };

  const removeNewsletter = async (newsletter) => {
    if (!window.confirm(`Delete "${newsletter.title}"? This removes the PDF permanently.`)) return;
    await fetch('/api/newsletters', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: newsletter.id }),
    });
    await refreshAdminData();
  };

  return (
    <AdminShell title="Newsletters" subtitle="Upload and manage PDF issues">
      <>

      <div className="card p-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Newspaper className="w-6 h-6 text-field-green" />
          <div>
            <h3 className="font-display font-bold text-xl">Newsletters</h3>
            <p className="text-sm text-ink-muted">
              Upload a PDF issue. It appears immediately on the Media page, newest first.
            </p>
          </div>
        </div>

        <form onSubmit={uploadNewsletter} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end mb-6">
          <label className="block lg:col-span-2">
            <span className="text-sm font-medium text-ink">Title</span>
            <input
              value={newsletterDraft.title}
              onChange={(event) => setNewsletterDraft({ ...newsletterDraft, title: event.target.value })}
              placeholder="August 2026 Newsletter"
              className={`mt-2 ${memberInputClass}`}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-ink">Issue date</span>
            <input
              type="date"
              value={newsletterDraft.issueDate}
              onChange={(event) => setNewsletterDraft({ ...newsletterDraft, issueDate: event.target.value })}
              className={`mt-2 ${memberInputClass}`}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-ink">PDF file</span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => {
                setNewsletterError('');
                setNewsletterFile(event.target.files?.[0] ?? null);
              }}
              className="mt-2 w-full text-sm text-ink-muted file:mr-3 file:rounded-full file:border-0 file:bg-field-green/10 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-field-green hover:file:bg-field-green/20"
            />
          </label>
          <button
            type="submit"
            disabled={uploadingNewsletter}
            className="btn-primary justify-center py-3 lg:col-start-4 disabled:opacity-60"
          >
            {uploadingNewsletter ? 'Uploading...' : 'Upload Issue'}
          </button>
        </form>

        {newsletterError ? <p className="mb-4 text-sm text-red-600">{newsletterError}</p> : null}

        <div className="space-y-2">
          {newsletters.length === 0 ? (
            <div className="rounded-3xl bg-surface-muted p-6 text-center text-sm text-ink-muted">
              No newsletters uploaded yet.
            </div>
          ) : (
            newsletters.map((newsletter, index) => (
              <div
                key={newsletter.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-black/10 bg-surface-card p-4"
              >
                <div className="min-w-0">
                  <p className="font-display font-semibold text-ink">
                    {newsletter.title}
                    {index === 0 ? (
                      <span className="ml-2 rounded-full bg-field-green/10 px-2 py-0.5 text-[10px] font-semibold text-field-green">
                        latest
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-ink-muted mt-1">
                    {formatIssueMonth(newsletter.issueDate)} · {formatFileSize(newsletter.byteSize)} · uploaded by{' '}
                    {newsletter.uploadedBy}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <a
                    href={`/api/newsletters/file/${encodeURIComponent(newsletter.id)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary text-xs"
                  >
                    <Eye className="w-3.5 h-3.5" /> View
                  </a>
                  <button
                    type="button"
                    onClick={() => removeNewsletter(newsletter)}
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
