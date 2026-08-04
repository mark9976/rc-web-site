'use client';

import { useCallback, useEffect, useState } from 'react';
import { Camera, X, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Gallery grid with an in-page viewer.
 *
 * Photos used to open as a bare image in a new tab, which on a phone is a dead
 * end: no page around it and no history to go back to. The viewer here always
 * offers a way out — a close button, the backdrop, Escape, and the phone's own
 * back gesture.
 */
export default function PhotoGallery({ items }) {
  const [index, setIndex] = useState(null);
  const open = index !== null;
  const current = open ? items[index] : null;

  const close = useCallback(() => setIndex(null), []);
  const show = useCallback(
    (next) => setIndex((prev) => (prev === null ? prev : (next + items.length) % items.length)),
    [items.length]
  );

  // Keyboard: Escape closes, arrows page through.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') close();
      if (event.key === 'ArrowRight') show(index + 1);
      if (event.key === 'ArrowLeft') show(index - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, index, close, show]);

  // The phone's back button/gesture closes the viewer instead of leaving the
  // page. Opening pushes a history entry; going back pops it and closes.
  useEffect(() => {
    if (!open) return undefined;
    window.history.pushState({ lightbox: true }, '');
    const onPop = () => setIndex(null);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [open]);

  // Stop the page behind the overlay from scrolling.
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const closeAndTidyHistory = () => {
    // Undo the entry pushed on open so Back does not need pressing twice.
    if (window.history.state?.lightbox) window.history.back();
    else close();
  };

  if (items.length === 0) {
    return (
      <div className="card text-center py-12">
        <Camera className="w-12 h-12 text-field-green/30 mx-auto mb-3" />
        <p className="font-display font-bold text-lg">No photos in the gallery yet</p>
        <p className="text-sm text-ink-muted mt-1">
          Approved member submissions appear here. Admins can add the first ones from the dashboard.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map((item, i) => (
          <button key={item.id} type="button" onClick={() => setIndex(i)} className="group text-left">
            <div className="aspect-square rounded-xl overflow-hidden bg-surface-muted border border-black/5 relative">
              <img src={item.src} alt={item.caption} loading="lazy" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
            </div>
            <p className="text-xs text-ink-muted mt-1.5 truncate">{item.caption}</p>
            <p className="text-[11px] text-ink-light">{item.date}</p>
          </button>
        ))}
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-label={current.caption || 'Photo'}
          onClick={closeAndTidyHistory}
        >
          {/* Bar kept clear of the notch, with a large close target. */}
          <div
            className="flex items-center justify-between gap-4 p-4 pt-[calc(1rem+env(safe-area-inset-top))] text-white/90 shrink-0"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="text-sm tabular-nums">{index + 1} of {items.length}</span>
            <button
              type="button"
              onClick={closeAndTidyHistory}
              aria-label="Close"
              className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20 active:bg-white/30"
            >
              <X className="w-5 h-5" /> Close
            </button>
          </div>

          <div className="flex-1 min-h-0 flex items-center justify-center px-2">
            <img
              src={current.src}
              alt={current.caption}
              className="max-h-full max-w-full object-contain"
              onClick={(event) => event.stopPropagation()}
            />
          </div>

          <div
            className="shrink-0 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
            onClick={(event) => event.stopPropagation()}
          >
            {current.caption ? (
              <p className="text-center text-sm text-white/80 mb-3 truncate">{current.caption}</p>
            ) : null}
            {items.length > 1 ? (
              <div className="flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => show(index - 1)}
                  aria-label="Previous photo"
                  className="rounded-full bg-white/10 p-3 text-white hover:bg-white/20 active:bg-white/30"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  onClick={() => show(index + 1)}
                  aria-label="Next photo"
                  className="rounded-full bg-white/10 p-3 text-white hover:bg-white/20 active:bg-white/30"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
