'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { inputClass, apiJson } from './emailUi';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Address field with search-as-you-type against email_contacts.
 * A raw address that isn't in contacts is accepted as typed.
 */
export default function ContactAutocomplete({ label, value = [], onChange, placeholder }) {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    if (query.trim().length < 2) { setMatches([]); return undefined; }
    // Debounced so a fast typist doesn't fire a request per keystroke.
    const timer = setTimeout(async () => {
      try {
        const data = await apiJson(`/api/email/contacts?search=${encodeURIComponent(query.trim())}`);
        setMatches((data.contacts || []).slice(0, 8));
        setOpen(true);
      } catch { setMatches([]); }
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const onDocClick = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const add = (address) => {
    const clean = String(address).trim().toLowerCase();
    if (!clean) return;
    if (!value.some((v) => v.toLowerCase() === clean)) onChange([...value, clean]);
    setQuery('');
    setMatches([]);
    setOpen(false);
  };

  const remove = (address) => onChange(value.filter((v) => v !== address));

  const handleKeyDown = (e) => {
    if (['Enter', ',', ';', 'Tab'].includes(e.key) && query.trim()) {
      e.preventDefault();
      add(query);
    } else if (e.key === 'Backspace' && !query && value.length) {
      remove(value[value.length - 1]);
    }
  };

  const invalid = useMemo(() => value.filter((v) => !EMAIL_RE.test(v)), [value]);

  return (
    <div ref={boxRef} className="relative">
      <span className="text-sm font-medium text-ink">{label}</span>
      <div className={`mt-2 flex flex-wrap gap-2 ${inputClass} min-h-[46px] items-center`}>
        {value.map((address) => (
          <span
            key={address}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
              EMAIL_RE.test(address) ? 'bg-field-green/10 text-field-green' : 'bg-flyday-nogo/10 text-flyday-nogo'
            }`}
          >
            {address}
            <button type="button" onClick={() => remove(address)} aria-label={`Remove ${address}`}>
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => matches.length && setOpen(true)}
          placeholder={value.length ? '' : placeholder}
          className="flex-1 min-w-[10rem] bg-transparent text-sm outline-none"
        />
      </div>

      {invalid.length > 0 ? (
        <p className="mt-1 text-xs text-flyday-nogo">Not a valid address: {invalid.join(', ')}</p>
      ) : null}

      {open && matches.length > 0 ? (
        <ul className="absolute z-30 mt-1 w-full max-h-64 overflow-auto rounded-2xl border border-black/10 bg-white shadow-xl">
          {matches.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => add(c.email)}
                className="w-full px-4 py-2 text-left text-sm hover:bg-surface-muted"
              >
                <span className="font-medium text-ink">
                  {[c.first_name, c.last_name].filter(Boolean).join(' ') || c.email}
                </span>
                <span className="ml-2 text-ink-muted">{c.email}</span>
                {c.contact_type === 'internal' ? (
                  <span className="ml-2 rounded-full bg-sky/10 px-2 py-0.5 text-[10px] font-semibold text-sky-deep">member</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
