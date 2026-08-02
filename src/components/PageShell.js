export default function PageShell({ title, subtitle, children }) {
  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      {title && (
        <div className="mb-8">
          <h1 className="font-display text-4xl font-bold text-ink tracking-tight">{title}</h1>
          {subtitle && <p className="mt-2 text-ink-muted text-lg">{subtitle}</p>}
          <div className="mt-4 w-16 h-1 bg-field-green rounded-full" />
        </div>
      )}
      {children}
    </div>
  );
}
