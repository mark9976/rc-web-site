'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { useAuth } from '@/components/AuthProvider';
import { Tag, Search, Plus, Camera, Trash2, ImagePlus, X, Phone, Clock } from 'lucide-react';
import { CLASSIFIED_LIFETIME_DAYS } from '@/lib/clubConstants';
import { readError } from '@/lib/apiClient';

const TYPES = ['For Sale', 'Wanted'];
const CATEGORIES = ['Airframes', 'Radios', 'Engines', 'Batteries', 'Field Equipment', 'Other'];

const emptyDraft = { title: '', price: '', phone: '', type: TYPES[0], category: CATEGORIES[0], description: '' };

function formatPosted(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  const days = Math.floor((Date.now() - parsed.getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return parsed.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** How much life the listing has left, given the fixed lifetime. */
function formatExpiry(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';

  const daysLeft = CLASSIFIED_LIFETIME_DAYS - Math.floor((Date.now() - parsed.getTime()) / 86400000);
  if (daysLeft <= 0) return 'expires today';
  if (daysLeft === 1) return 'expires tomorrow';
  return `expires in ${daysLeft} days`;
}

export default function ClassifiedsPage() {
  const auth = useAuth();
  const [listings, setListings] = useState([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All Types');
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');

  // Object URLs must be revoked or the blob stays alive for the page's lifetime.
  useEffect(() => {
    if (!photo) {
      setPhotoPreview('');
      return undefined;
    }
    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const clearPhoto = () => setPhoto(null);

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file.');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError('Images must be 25 MB or smaller.');
      return;
    }
    setError('');
    setPhoto(file);
  };

  const loadListings = async () => {
    try {
      const res = await fetch('/api/classifieds', { cache: 'no-store' });
      if (!res.ok) throw new Error('Unable to load classifieds.');
      const data = await res.json();
      setListings(data.classifieds || []);
    } catch {
      setListings([]);
    }
  };

  useEffect(() => {
    loadListings();
  }, []);

  const visibleListings = useMemo(() => {
    const term = search.trim().toLowerCase();
    return listings.filter((listing) => {
      if (typeFilter !== 'All Types' && listing.type !== typeFilter) return false;
      if (!term) return true;
      return [listing.title, listing.description, listing.category]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(term));
    });
  }, [listings, search, typeFilter]);

  const handlePost = async (event) => {
    event.preventDefault();
    setError('');

    if (!draft.title.trim()) {
      setError('Give your listing a title.');
      return;
    }

    if (!draft.phone.trim()) {
      setError('Add a contact phone number so buyers can reach you.');
      return;
    }

    setPosting(true);
    try {
      const body = new FormData();
      Object.entries(draft).forEach(([key, value]) => body.append(key, value));
      if (photo) body.append('photo', photo);

      // No Content-Type header: the browser sets the multipart boundary itself.
      const res = await fetch('/api/classifieds', { method: 'POST', body });
      if (!res.ok) throw new Error(await readError(res, 'Unable to post listing.'));
      setDraft(emptyDraft);
      setPhoto(null);
      setFormOpen(false);
      await loadListings();
    } catch (postError) {
      setError(postError.message);
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this listing?')) return;
    await fetch('/api/classifieds', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    await loadListings();
  };

  const canRemove = (listing) =>
    auth.isAdmin || Boolean(auth.currentUser && listing.ownerId === auth.currentUser.id);

  const inputClass =
    'w-full px-4 py-3 rounded-lg border border-black/10 bg-surface-card text-sm focus:outline-none focus:ring-2 focus:ring-field-green/30';

  return (
    <PageShell title="Classifieds" subtitle="Buy, sell, and trade RC equipment with fellow members">

      {/* Expiry notice — enforced server-side, not just displayed */}
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-flyday-maybe/30 bg-flyday-maybe/5 p-4 text-sm text-ink">
        <Clock className="w-5 h-5 text-flyday-maybe shrink-0 mt-0.5" />
        <p>
          <strong>Listings expire automatically after {CLASSIFIED_LIFETIME_DAYS} days.</strong>{' '}
          <span className="text-ink-muted">
            Once a listing ages out it drops off this page on its own. Still have the item? Just post it again.
          </span>
        </p>
      </div>

      {/* Action bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="flex-1 relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-ink-light" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search classifieds..."
            className="w-full pl-10 pr-4 py-3 rounded-lg border border-black/10 bg-surface-card text-sm focus:outline-none focus:ring-2 focus:ring-field-green/30 focus:border-field-green"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="px-4 py-3 rounded-lg border border-black/10 bg-surface-card text-sm text-ink-muted focus:outline-none focus:ring-2 focus:ring-field-green/30"
          >
            <option>All Types</option>
            {TYPES.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
          {auth.isAuthenticated ? (
            <button type="button" onClick={() => setFormOpen((open) => !open)} className="btn-primary text-xs">
              <Plus className="w-4 h-4" /> {formOpen ? 'Cancel' : 'Post Listing'}
            </button>
          ) : (
            <Link href="/login/" className="btn-secondary text-xs">
              Sign in to post
            </Link>
          )}
        </div>
      </div>

      {/* Post form */}
      {formOpen && auth.isAuthenticated ? (
        <form onSubmit={handlePost} className="card p-6 mb-8 space-y-4">
          <h2 className="font-display font-bold text-lg">New Listing</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-ink">Title</span>
              <input
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                placeholder="E-flite Apprentice STS 1.5m"
                className={`mt-2 ${inputClass}`}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink">Price (optional)</span>
              <input
                value={draft.price}
                onChange={(event) => setDraft({ ...draft, price: event.target.value })}
                placeholder="$180"
                className={`mt-2 ${inputClass}`}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink">Contact phone</span>
              <input
                type="tel"
                value={draft.phone}
                onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
                placeholder="(724) 555-0100"
                className={`mt-2 ${inputClass}`}
              />
              <span className="text-xs text-ink-light mt-1 block">
                Shown publicly on your listing so buyers can call you.
              </span>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink">Type</span>
              <select
                value={draft.type}
                onChange={(event) => setDraft({ ...draft, type: event.target.value })}
                className={`mt-2 ${inputClass}`}
              >
                {TYPES.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink">Category</span>
              <select
                value={draft.category}
                onChange={(event) => setDraft({ ...draft, category: event.target.value })}
                className={`mt-2 ${inputClass}`}
              >
                {CATEGORIES.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-medium text-ink">Description</span>
            <textarea
              rows={4}
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              placeholder="Condition, what's included, and how to reach you."
              className={`mt-2 ${inputClass} resize-y`}
            />
          </label>
          <div className="block">
            <span className="text-sm font-medium text-ink">Photo (optional)</span>
            {photoPreview ? (
              <div className="mt-2 flex items-center gap-4">
                <img
                  src={photoPreview}
                  alt="Listing preview"
                  className="w-28 h-28 rounded-lg object-cover border border-black/10"
                />
                <div className="text-sm text-ink-muted">
                  <p className="truncate max-w-[240px]">{photo?.name}</p>
                  <button type="button" onClick={clearPhoto} className="btn-secondary text-xs mt-2">
                    <X className="w-3.5 h-3.5" /> Remove photo
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-2 rounded-3xl border border-dashed border-black/10 bg-surface-card p-5 text-center">
                <input
                  id="listing-photo"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
                <label htmlFor="listing-photo" className="cursor-pointer flex flex-col items-center gap-2">
                  <ImagePlus className="w-6 h-6 text-field-green" />
                  <span className="font-display font-semibold text-sm">Add a photo of the item</span>
                  <span className="text-xs text-ink-muted">JPEG, PNG, GIF, or WebP up to 25 MB</span>
                </label>
              </div>
            )}
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button type="submit" disabled={posting} className="btn-primary text-sm disabled:opacity-60">
            {posting ? 'Posting...' : 'Post Listing'}
          </button>
        </form>
      ) : null}

      {/* Listings */}
      <div className="space-y-4">
        {visibleListings.length === 0 ? (
          <div className="card text-center py-12">
            <Tag className="w-12 h-12 text-field-green/30 mx-auto mb-3" />
            <p className="font-display font-bold text-lg">
              {listings.length === 0 ? 'No listings yet' : 'No listings match your search'}
            </p>
            <p className="text-sm text-ink-muted mt-1">
              {listings.length === 0
                ? 'Signed-in members can post the first one.'
                : 'Try a different search term or type filter.'}
            </p>
          </div>
        ) : (
          visibleListings.map((listing) => (
            <div key={listing.id} className="card hover:shadow-md transition-shadow group">
              <div className="flex gap-4">
                {listing.hasPhoto ? (
                  <a
                    href={`/api/classifieds/photo/${encodeURIComponent(listing.id)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0"
                  >
                    <img
                      src={`/api/classifieds/photo/${encodeURIComponent(listing.id)}`}
                      alt={listing.title}
                      className="w-24 h-24 rounded-lg object-cover border border-black/10"
                    />
                  </a>
                ) : (
                  <div className="w-24 h-24 bg-surface-muted rounded-lg shrink-0 flex items-center justify-center">
                    <Camera className="w-8 h-8 text-ink-light/20" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <span className={`inline-block text-xs font-display font-bold uppercase tracking-wider px-2 py-0.5 rounded mb-1 ${
                        listing.type === 'For Sale' ? 'bg-field-green/10 text-field-green' : 'bg-sky/10 text-sky-deep'
                      }`}>
                        {listing.type}
                      </span>
                      <h3 className="font-display font-bold text-lg text-ink group-hover:text-field-green transition-colors truncate">
                        {listing.title}
                      </h3>
                    </div>
                    {listing.price && (
                      <p className="font-display font-bold text-xl text-field-green shrink-0">{listing.price}</p>
                    )}
                  </div>
                  {listing.description ? (
                    <p className="text-sm text-ink-muted mt-2 whitespace-pre-wrap">{listing.description}</p>
                  ) : null}
                  {listing.phone ? (
                    <a
                      href={`tel:${listing.phone.replace(/[^\d+]/g, '')}`}
                      className="mt-3 inline-flex items-center gap-2 rounded-full bg-field-green/10 px-3 py-1.5 text-sm font-semibold text-field-green hover:bg-field-green/20"
                    >
                      <Phone className="w-4 h-4" /> {listing.phone}
                    </a>
                  ) : null}
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-ink-muted items-center">
                    <span className="flex items-center gap-1"><Tag className="w-3 h-3" /> {listing.category}</span>
                    {listing.ownerName ? <span>By {listing.ownerName}</span> : null}
                    <span>Posted {formatPosted(listing.createdAt || listing.posted)}</span>
                    <span className="text-ink-light">{formatExpiry(listing.createdAt || listing.posted)}</span>
                    {canRemove(listing) ? (
                      <button
                        type="button"
                        onClick={() => handleDelete(listing.id)}
                        className="inline-flex items-center gap-1 rounded-full bg-flyday-nogo/10 px-3 py-1 font-semibold text-flyday-nogo hover:bg-flyday-nogo/20"
                      >
                        <Trash2 className="w-3 h-3" /> Remove
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-8 text-center text-sm text-ink-muted">
        <p>Members must be signed in to post. Call the seller using the number on the listing.</p>
      </div>
    </PageShell>
  );
}
