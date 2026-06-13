// Small shared primitives so every screen reads as one console. No external UI kit —
// Tailwind classes only, matching the existing agent-dashboard convention.

export function Panel({ title, right, children, className = '' }) {
  return (
    <section className={`rounded-lg border border-edge bg-panel ${className}`}>
      {(title || right) && (
        <header className="flex items-center justify-between border-b border-edge px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
          {right}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function EmptyState({ children }) {
  return (
    <div className="flex min-h-[120px] items-center justify-center rounded border border-dashed border-edge px-4 py-8 text-center text-sm text-muted">
      {children}
    </div>
  );
}

const BADGE_TONES = {
  neutral: 'bg-edge text-slate-200',
  green: 'bg-emerald-900/50 text-emerald-300 border border-emerald-700/50',
  amber: 'bg-amber-900/40 text-amber-300 border border-amber-700/50',
  red: 'bg-red-900/40 text-red-300 border border-red-700/50',
  blue: 'bg-sky-900/40 text-sky-300 border border-sky-700/50',
  violet: 'bg-violet-900/40 text-violet-300 border border-violet-700/50',
};

export function Badge({ tone = 'neutral', children }) {
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${BADGE_TONES[tone] || BADGE_TONES.neutral}`}>
      {children}
    </span>
  );
}

export function StatusDot({ ok, label }) {
  const tone = ok === true ? 'bg-emerald-400' : ok === false ? 'bg-red-400' : 'bg-amber-400';
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted">
      <span className={`h-2 w-2 rounded-full ${tone} ${ok === null ? 'animate-pulse' : ''}`} />
      {label}
    </span>
  );
}

export function Field({ label, children }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="text-sm text-slate-200">{children}</div>
    </div>
  );
}

export function Mono({ children }) {
  return <span className="font-mono text-xs text-slate-400">{children}</span>;
}
