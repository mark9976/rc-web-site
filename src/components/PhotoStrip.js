'use client';

import { useEffect, useState } from 'react';
import { Camera, ChevronLeft, ChevronRight } from 'lucide-react';

export default function PhotoStrip() {
  const [photos, setPhotos] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const loadPhotos = async () => {
      try {
        const res = await fetch('/api/photos/recent');
        if (!res.ok) throw new Error('Unable to load recent photos.');
        const data = await res.json();
        const recentPhotos = Array.isArray(data) ? data : data?.recent || [];
        if (!isMounted) return;

        setPhotos(
          recentPhotos.map((photo) => ({
            ...photo,
            src: `/api/photos/files/${encodeURIComponent(photo.id)}`,
          }))
        );
        setCurrentIndex(0);
      } catch {
        if (!isMounted) return;
        setPhotos([]);
      }
    };

    loadPhotos();
    return () => {
      isMounted = false;
    };
  }, []);

  const items = photos.slice(0, 10);
  const activePhoto = items[currentIndex] || items[0];

  const selectPrevious = () => {
    setCurrentIndex((value) => (value - 1 + items.length) % items.length);
  };

  const selectNext = () => {
    setCurrentIndex((value) => (value + 1) % items.length);
  };

  useEffect(() => {
    if (items.length <= 1) return;
    const interval = window.setInterval(() => {
      setCurrentIndex((value) => (value + 1) % items.length);
    }, 5000);
    return () => window.clearInterval(interval);
  }, [items.length]);

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="section-heading flex items-center gap-2">
          <Camera className="w-6 h-6 text-field-green" />
          Recent Activity
        </h2>
        <a href="/media/" className="text-sm font-display font-semibold text-field-green hover:text-field-darkgreen uppercase tracking-wider">
          View All →
        </a>
      </div>

      {items.length === 0 ? (
        <div className="aspect-[4/3] rounded-xl bg-surface-muted border border-black/5 flex flex-col items-center justify-center text-center px-6">
          <Camera className="w-12 h-12 text-field-green/30 mb-3" />
          <p className="font-display font-bold">No photos yet</p>
          <p className="text-sm text-ink-muted mt-1">Approved member photos will show up here.</p>
        </div>
      ) : (
      <div className="relative">
        <div className="aspect-[4/3] rounded-xl overflow-hidden bg-surface-muted border border-black/5">
          <img
            src={activePhoto.src}
            alt={activePhoto.caption}
            className="w-full h-full object-cover"
          />
          <button
            type="button"
            onClick={selectPrevious}
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/20 hover:bg-black/30 text-white p-2"
            aria-label="Previous photo"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={selectNext}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/20 hover:bg-black/30 text-white p-2"
            aria-label="Next photo"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-4">
          <div>
            <p className="text-sm font-medium text-ink">{activePhoto.caption}</p>
            <p className="text-xs text-ink-muted">{activePhoto.date} · {activePhoto.photographer}</p>
          </div>
          <div className="flex items-center gap-2">
            {items.map((photo, index) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => setCurrentIndex(index)}
                className={`h-2 w-2 rounded-full transition ${index === currentIndex ? 'bg-field-green' : 'bg-ink-light/40 hover:bg-field-green/60'}`}
                aria-label={`Show photo ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
      )}
    </section>
  );
}
