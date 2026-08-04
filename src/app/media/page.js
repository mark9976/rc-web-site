import PageShell from '@/components/PageShell';
import PhotoGallery from '@/components/PhotoGallery';
import { Camera, Newspaper, Youtube, Upload, FileText } from 'lucide-react';
import { getRecentPhotos, getNewsletters } from '@/lib/photoStorage';
import { parseDateString } from '@/lib/dateUtils';

export const metadata = { title: 'Media' };

// Rendered per request so newly approved photos and newsletters appear without
// a rebuild.
export const dynamic = 'force-dynamic';

/** A newsletter belongs to a month, so render it that way. */
function formatIssueDate(issueDate) {
  const parsed = parseDateString(issueDate);
  return parsed
    ? parsed.toLocaleDateString('default', { month: 'long', year: 'numeric' })
    : issueDate || '';
}

function formatSize(bytes) {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function MediaPage() {
  const newsletters = getNewsletters();
  const [latest, ...archive] = newsletters;

  const galleryItems = getRecentPhotos().map((photo) => ({
    id: photo.id,
    caption: photo.caption,
    date: photo.date,
    src: `/api/photos/files/${encodeURIComponent(photo.id)}`,
  }));

  return (
    <PageShell title="Media" subtitle="Photos, newsletters, and videos from LHMAC">

      {/* Photo Gallery */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="section-heading flex items-center gap-2">
            <Camera className="w-6 h-6 text-field-green" />
            Photo Gallery
          </h2>
          <span className="text-sm text-ink-muted">
            {galleryItems.length} {galleryItems.length === 1 ? 'photo' : 'photos'}
          </span>
        </div>

        {/* Grid plus in-page viewer. A client component so tapping a photo
            opens it here rather than navigating to the raw image file, which
            on a phone leaves no way back. */}
        <PhotoGallery items={galleryItems} />

        {/* Submit photos prompt */}
        <div className="mt-8 bg-field-green/5 border border-field-green/20 rounded-xl p-6 flex flex-col sm:flex-row items-center gap-4">
          <Upload className="w-10 h-10 text-field-green shrink-0" />
          <div>
            <h3 className="font-display font-bold text-lg">Share Your Photos</h3>
            <p className="text-sm text-ink-muted">
              Members can submit photos through the LHMAC app on iPhone or Android.
              Photos are reviewed by an admin before appearing in the gallery.
            </p>
          </div>
        </div>
      </section>

      {/* Newsletters */}
      <section className="mb-12">
        <h2 className="section-heading flex items-center gap-2 mb-6">
          <Newspaper className="w-6 h-6 text-field-green" />
          Newsletters
        </h2>

        <div className="card">
          {newsletters.length === 0 ? (
            <div className="bg-surface-muted rounded-xl p-8 text-center">
              <Newspaper className="w-10 h-10 text-field-green/30 mx-auto mb-3" />
              <p className="font-display font-bold text-lg">No newsletters posted yet</p>
              <p className="text-sm text-ink-muted mt-1">
                Admins can upload issues from the admin dashboard.
              </p>
            </div>
          ) : (
            <>
              <p className="text-ink-muted mb-4">
                Club newsletters are published monthly. The latest issue and archive are below.
              </p>

              {/* Latest issue */}
              <div className="bg-surface-muted rounded-xl p-6 mb-6">
                <p className="text-xs font-display font-bold uppercase tracking-wider text-field-green mb-2">
                  Latest Issue
                </p>
                <h3 className="font-display font-bold text-xl">{latest.title}</h3>
                <p className="text-sm text-ink-muted mt-1">
                  {formatIssueDate(latest.issueDate)} · {formatSize(latest.byteSize)}
                </p>
                <a
                  href={`/api/newsletters/file/${encodeURIComponent(latest.id)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary text-xs mt-4"
                >
                  <FileText className="w-4 h-4" /> Read Newsletter (PDF)
                </a>
              </div>

              {archive.length > 0 ? (
                <>
                  <h3 className="font-display font-bold text-lg mb-3">Archive</h3>
                  <ul className="divide-y divide-black/5">
                    {archive.map((issue) => (
                      <li key={issue.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <p className="font-medium text-ink truncate">{issue.title}</p>
                          <p className="text-xs text-ink-muted">
                            {formatIssueDate(issue.issueDate)} · {formatSize(issue.byteSize)}
                          </p>
                        </div>
                        <a
                          href={`/api/newsletters/file/${encodeURIComponent(issue.id)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary text-xs shrink-0"
                        >
                          <FileText className="w-3.5 h-3.5" /> Read PDF
                        </a>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </>
          )}
        </div>
      </section>

      {/* Videos */}
      <section>
        <h2 className="section-heading flex items-center gap-2 mb-6">
          <Youtube className="w-6 h-6 text-field-green" />
          Videos
        </h2>
        <div className="card">
          <p className="text-ink-muted mb-4">
            Club videos from our YouTube channel will be embedded here.
          </p>
          <a
            href="https://www.youtube.com/user/LHMACRC"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary text-xs"
          >
            Visit YouTube Channel →
          </a>
        </div>
      </section>
    </PageShell>
  );
}
