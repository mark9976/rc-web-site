'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import AdminShell from '@/components/admin/AdminShell';
import { useAuth } from '@/components/AuthProvider';
import { readError } from '@/lib/apiClient';
import { Camera, Check, X, Eye, Upload, Trash2, Image as ImageIcon } from 'lucide-react';

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
  const [photoQueue, setPhotoQueue] = useState([]);
  const [recentPhotos, setRecentPhotos] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const refreshAdminData = useCallback(async () => {
    const [queueRes, recentRes] = await Promise.all([
      fetch('/api/photos/queue', { cache: 'no-store' }),
      fetch('/api/photos/recent', { cache: 'no-store' }),
    ]);
    if (queueRes.ok) setPhotoQueue(await queueRes.json());
    if (recentRes.ok) setRecentPhotos(await recentRes.json());
  }, []);

  // The lifted handlers call refreshPhotos(); keep that name.
  const refreshPhotos = refreshAdminData;

  useEffect(() => {
    if (auth.isAdmin) refreshAdminData();
  }, [auth.isAdmin, refreshAdminData]);

  const handleFiles = async (files) => {
    setUploadError('');
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) {
          throw new Error('Only image files are allowed.');
        }

        const formData = new FormData();
        formData.append('photo', file);
        formData.append('caption', file.name);

        const response = await fetch('/api/photos/upload', { method: 'POST', body: formData });
        if (!response.ok) {
          throw new Error(await readError(response, 'Upload failed.'));
        }
      }
      await refreshPhotos();
    } catch (error) {
      setUploadError(error.message || 'Upload failed.');
    }
  };

  const handleDrop = async (event) => {
    event.preventDefault();
    setDragActive(false);
    if (event.dataTransfer.files.length > 0) {
      await handleFiles(event.dataTransfer.files);
    }
  };

  const handleApprove = async (photoId) => {
    setUploadError('');
    try {
      const response = await fetch('/api/photos/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: photoId }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Approve failed.');
      }

      await refreshPhotos();
    } catch (error) {
      setUploadError(error.message || 'Approve failed.');
    }
  };

  const handleReject = async (photoId) => {
    setUploadError('');
    try {
      const response = await fetch('/api/photos/queue', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: photoId }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Reject failed.');
      }

      await refreshPhotos();
    } catch (error) {
      setUploadError(error.message || 'Reject failed.');
    }
  };

  const handleFileInput = async (event) => {
    if (event.target.files.length > 0) {
      await handleFiles(event.target.files);
      event.target.value = null;
    }
  };

  const handleRemoveFromGallery = async (photo) => {
    const label = photo.caption || photo.filename;
    if (!window.confirm(`Remove "${label}" from the public gallery? This cannot be undone.`)) return;

    setUploadError('');
    try {
      const response = await fetch('/api/photos/recent', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: photo.id }),
      });
      if (!response.ok) throw new Error(await readError(response, 'Could not remove the photo.'));
      await refreshPhotos();
    } catch (error) {
      setUploadError(error.message);
    }
  };

  return (
    <AdminShell title="Photos" subtitle="Approve submissions and manage the public gallery">
      <>
      <div className="grid gap-6 lg:grid-cols-2">

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-xl flex items-center gap-2">
              <Camera className="w-5 h-5 text-flyday-maybe" />
              Photo Approval Queue
            </h2>
            <span className="text-xs font-display font-bold bg-flyday-maybe/10 text-flyday-maybe px-2 py-1 rounded-full shrink-0">
              {photoQueue.length} pending
            </span>
          </div>

          <div
            className={`mb-4 rounded-3xl border border-dashed p-6 text-center transition ${dragActive ? 'border-field-green bg-field-green/5' : 'border-black/10 bg-surface-card'}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
          >
            <input id="photo-upload" type="file" accept="image/*" multiple className="hidden" onChange={handleFileInput} />
            <label htmlFor="photo-upload" className="cursor-pointer">
              <div className="flex flex-col items-center justify-center gap-3">
                <Upload className="w-6 h-6 text-field-green" />
                <p className="font-display font-semibold">Drag &amp; drop images here</p>
                <p className="text-xs text-ink-muted">or click to choose files. Uploads join the approval queue.</p>
              </div>
            </label>
          </div>

          <div className="space-y-3">
            {photoQueue.length === 0 ? (
              <div className="rounded-3xl bg-surface-muted p-6 text-center text-sm text-ink-muted">
                Nothing waiting for review.
              </div>
            ) : (
              photoQueue.map((photo) => (
                <div key={photo.id} className="flex items-center gap-3 p-3 bg-surface-muted rounded-lg">
                  <div className="w-16 h-16 rounded-lg overflow-hidden border border-black/5 shrink-0">
                    <img
                      src={`/api/photos/files/${encodeURIComponent(photo.id)}`}
                      alt={photo.caption}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{photo.caption || photo.filename}</p>
                    <p className="text-xs text-ink-muted truncate">
                      by {photo.submitter} · {formatTimestamp(photo.submitted)}
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => handleApprove(photo.id)}
                      className="w-8 h-8 rounded-lg bg-flyday-go/10 text-flyday-go hover:bg-flyday-go hover:text-white transition-colors flex items-center justify-center"
                      title="Approve"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <a
                      href={`/api/photos/files/${encodeURIComponent(photo.id)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-8 h-8 rounded-lg bg-sky/10 text-sky-deep hover:bg-sky hover:text-white transition-colors flex items-center justify-center"
                      title="Preview"
                    >
                      <Eye className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => handleReject(photo.id)}
                      className="w-8 h-8 rounded-lg bg-flyday-nogo/10 text-flyday-nogo hover:bg-flyday-nogo hover:text-white transition-colors flex items-center justify-center"
                      title="Reject"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-xl flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-field-green" />
              Photo Gallery
            </h2>
            <span className="text-xs font-display font-bold bg-field-green/10 text-field-green px-2 py-1 rounded-full shrink-0">
              {recentPhotos.length} live
            </span>
          </div>
          <p className="text-sm text-ink-muted mb-4">
            Everything approved and visible on the Media page. Removing a photo here takes it off the
            public site immediately.
          </p>

          {recentPhotos.length === 0 ? (
            <div className="rounded-3xl bg-surface-muted p-6 text-center text-sm text-ink-muted">
              No photos in the gallery yet.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {recentPhotos.map((photo) => (
                <div key={photo.id} className="group relative">
                  <div className="aspect-square rounded-xl overflow-hidden border border-black/5 bg-surface-muted">
                    <img
                      src={`/api/photos/files/${encodeURIComponent(photo.id)}`}
                      alt={photo.caption || photo.filename}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <a
                      href={`/api/photos/files/${encodeURIComponent(photo.id)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-8 h-8 rounded-lg bg-white/90 text-sky-deep hover:bg-white shadow flex items-center justify-center"
                      title="View full size"
                    >
                      <Eye className="w-4 h-4" />
                    </a>
                    <button
                      type="button"
                      onClick={() => handleRemoveFromGallery(photo)}
                      className="w-8 h-8 rounded-lg bg-white/90 text-flyday-nogo hover:bg-flyday-nogo hover:text-white shadow flex items-center justify-center"
                      title="Remove from gallery"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-ink-muted truncate" title={photo.caption || photo.filename}>
                    {photo.caption || photo.filename}
                  </p>
                  <p className="text-[11px] text-ink-light truncate">
                    by {photo.photographer} · {photo.date}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      </>
    </AdminShell>
  );
}
