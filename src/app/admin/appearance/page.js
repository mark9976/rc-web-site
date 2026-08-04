'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import AdminShell from '@/components/admin/AdminShell';
import { useAuth } from '@/components/AuthProvider';
import { readError } from '@/lib/apiClient';
import { Image as ImageIcon, Upload, Trash2 } from 'lucide-react';

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
  const [heroImage, setHeroImage] = useState(null);
  const [logoImage, setLogoImage] = useState(null);
  const [heroError, setHeroError] = useState('');
  const [uploadingHero, setUploadingHero] = useState(false);

  const refreshAdminData = useCallback(async () => {
    const res = await fetch('/api/site-images', { cache: 'no-store' });
    if (res.ok) {
      const images = (await res.json()).images ?? {};
      setHeroImage(images.hero ?? null);
      setLogoImage(images.logo ?? null);
    }
  }, []);

  useEffect(() => {
    if (auth.isAdmin) refreshAdminData();
  }, [auth.isAdmin, refreshAdminData]);

  const uploadSiteImage = async (slot, file) => {
    if (!file) return;
    setHeroError('');

    if (!file.type.startsWith('image/')) {
      setHeroError('Choose an image file.');
      return;
    }

    setUploadingHero(true);
    try {
      const body = new FormData();
      body.append('slot', slot);
      body.append('image', file);

      const res = await fetch('/api/site-images', { method: 'POST', body });
      if (!res.ok) throw new Error(await readError(res, 'Unable to upload the image.'));
      await refreshAdminData();
    } catch (error) {
      setHeroError(error.message);
    } finally {
      setUploadingHero(false);
    }
  };

  const removeSiteImage = async (slot, confirmMessage) => {
    if (!window.confirm(confirmMessage)) return;
    await fetch('/api/site-images', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot }),
    });
    await refreshAdminData();
  };

  // The hero section's JSX calls these slot-specific wrappers.
  const uploadHeroImage = (file) => uploadSiteImage('hero', file);
  const removeHeroImage = () => removeSiteImage('hero', 'Remove the homepage header image?');

  return (
    <AdminShell title="Logo & Images" subtitle="Club logo and the homepage header image">
      <>

      <div className="card p-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <ImageIcon className="w-6 h-6 text-field-green" />
          <div>
            <h3 className="font-display font-bold text-xl">Club Logo</h3>
            <p className="text-sm text-ink-muted">
              The crest in the site header. The phone app reads the same image, so replacing it here
              updates both.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          {/* Previewed on the dark green it actually sits on, so a logo with the
              wrong background shows up here rather than in production. */}
          <div className="shrink-0 rounded-2xl bg-field-darkgreen p-4 flex items-center justify-center w-32 h-32">
            {logoImage ? (
              <img
                src={`/api/site-images/logo?v=${encodeURIComponent(logoImage.updatedAt)}`}
                alt="Club logo"
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <ImageIcon className="w-8 h-8 text-white/30" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            {logoImage ? (
              <p className="text-xs text-ink-muted mb-3">
                {formatFileSize(logoImage.byteSize)} · set by {logoImage.updatedBy} on{' '}
                {formatTimestamp(logoImage.updatedAt)}
              </p>
            ) : (
              <p className="text-xs text-ink-muted mb-3">No logo set — the header and the app will both show nothing.</p>
            )}
            <div className="flex flex-wrap gap-3">
              <label className="btn-secondary text-xs cursor-pointer">
                <Upload className="w-3.5 h-3.5" /> {logoImage ? 'Replace logo' : 'Upload logo'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => uploadSiteImage('logo', event.target.files?.[0])}
                />
              </label>
              {logoImage ? (
                <button
                  type="button"
                  onClick={() => removeSiteImage('logo', 'Remove the club logo? The site header and the phone app will both lose it.')}
                  className="inline-flex items-center gap-1 rounded-full bg-flyday-nogo/10 px-3 py-1 text-xs font-semibold text-flyday-nogo hover:bg-flyday-nogo/20"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Remove
                </button>
              ) : null}
            </div>
            <p className="text-xs text-ink-light mt-3">
              A PNG with a transparent background works best. Served to both the site and the app at{' '}
              <code className="rounded bg-surface-muted px-1">/api/site-images/logo</code>.
            </p>
          </div>
        </div>
        {heroError ? <p className="mt-4 text-sm text-red-600">{heroError}</p> : null}
      </div>

      <div className="card p-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <ImageIcon className="w-6 h-6 text-field-green" />
          <div>
            <h3 className="font-display font-bold text-xl">Homepage Header Image</h3>
            <p className="text-sm text-ink-muted">
              Shown at the top of the homepage, just above &ldquo;Come, Fly with Us!&rdquo;. A wide photo works best.
            </p>
          </div>
        </div>

        {heroImage ? (
          <div className="space-y-4">
            <img
              src={`/api/site-images/hero?v=${encodeURIComponent(heroImage.updatedAt)}`}
              alt="Current homepage header"
              className="w-full max-w-2xl rounded-xl border border-black/10"
            />
            <p className="text-xs text-ink-muted">
              {formatFileSize(heroImage.byteSize)} · set by {heroImage.updatedBy} on{' '}
              {formatTimestamp(heroImage.updatedAt)}
            </p>
            <div className="flex flex-wrap gap-3 items-center">
              <label className="btn-secondary text-xs cursor-pointer">
                <Upload className="w-3.5 h-3.5" /> {uploadingHero ? 'Uploading...' : 'Replace image'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => uploadHeroImage(event.target.files?.[0])}
                />
              </label>
              <button
                type="button"
                onClick={removeHeroImage}
                className="inline-flex items-center gap-1 rounded-full bg-flyday-nogo/10 px-3 py-1 text-xs font-semibold text-flyday-nogo hover:bg-flyday-nogo/20"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remove
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-black/10 bg-surface-card p-8 text-center">
            <input
              id="hero-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => uploadHeroImage(event.target.files?.[0])}
            />
            <label htmlFor="hero-upload" className="cursor-pointer flex flex-col items-center gap-2">
              <ImageIcon className="w-8 h-8 text-field-green" />
              <span className="font-display font-semibold">
                {uploadingHero ? 'Uploading...' : 'Choose a header image'}
              </span>
              <span className="text-xs text-ink-muted">
                JPEG, PNG, GIF, or WebP up to 25 MB. Until one is set, the homepage shows the plane icon.
              </span>
            </label>
          </div>
        )}

        {heroError ? <p className="mt-4 text-sm text-red-600">{heroError}</p> : null}
      </div>
      </>
    </AdminShell>
  );
}
