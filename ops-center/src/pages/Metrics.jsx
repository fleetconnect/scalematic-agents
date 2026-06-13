import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Panel, EmptyState, Badge, Mono } from '../components/ui.jsx';

// The single number that matters this week is verdicts rendered. It is the largest thing on
// the screen. Beneath it sit the ratify_pending judgment values still in active use — the
// governance debt the weekly review is meant to surface.

function Stat({ label, value, tone }) {
  return (
    <div className="rounded border border-edge bg-panel p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${tone || 'text-slate-100'}`}>{value}</div>
    </div>
  );
}

export default function Metrics({ system }) {
  const [review, setReview] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.weeklyReview(7).then(setReview).catch((e) => setError(String(e.message || e)));
  }, []);

  if (error) return <Panel title="Metrics"><div className="text-sm text-red-400">{error}</div></Panel>;
  if (!review) return <Panel title="Metrics"><div className="text-sm text-muted">Loading…</div></Panel>;

  const v = review.verdicts || {};
  const totalVerdicts = (v.approved || 0) + (v.edited || 0) + (v.rejected || 0);
  const ratify = (system && system.ratifyPendingInUse) || review.ratifyPendingInUse || [];

  return (
    <div className="space-y-4">
      <Panel title={`Verdicts this week (${review.windowDays}-day window)`}>
        <div className="flex flex-col items-start gap-2">
          <div className="text-6xl font-extrabold tracking-tight text-emerald-400">{totalVerdicts}</div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="green">approved {v.approved || 0}</Badge>
            <Badge tone="blue">edited {v.edited || 0}</Badge>
            <Badge tone="red">rejected {v.rejected || 0}</Badge>
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Opportunities created" value={review.opportunities?.created ?? 0} />
        <Stat label="Messages sent" value={review.sends?.sent ?? 0} />
        <Stat label="Replies" value={review.sends?.replied ?? 0} />
        <Stat
          label="Thesis confirmation"
          value={review.thesisConfirmationRate != null ? `${Math.round(review.thesisConfirmationRate * 100)}%` : 'n/a'}
        />
      </div>

      <Panel title="Ratify-pending judgment values in use">
        {ratify.length === 0 ? (
          <EmptyState>No ratify_pending rules in active use (or judgment config not loaded).</EmptyState>
        ) : (
          <ul className="space-y-2">
            {ratify.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded border border-edge bg-ink/40 p-2 text-sm">
                <Badge tone="amber">{r.id}</Badge>
                <span className="text-slate-300">{r.text || r.sourceFile}</span>
                {r.sourceFile && <Mono>{r.sourceFile}</Mono>}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Mono>generated {new Date(review.generatedAt).toLocaleString()}</Mono>
    </div>
  );
}
