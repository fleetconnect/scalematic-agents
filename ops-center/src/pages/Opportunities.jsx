import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { Panel, EmptyState, Badge, Field, Mono } from '../components/ui.jsx';

const THESIS_CHOICES = ['confirmed', 'partial', 'refuted'];

function scoreTone(n) {
  if (n >= 70) return 'green';
  if (n >= 45) return 'amber';
  return 'red';
}

function thesisTone(s) {
  return s === 'confirmed' ? 'green' : s === 'partial' ? 'amber' : s === 'refuted' ? 'red' : 'neutral';
}

// The thesis-status control is one of only three write paths in the UI. Setting confirmed,
// partial, or refuted requires an evidence note and PATCHes the opportunity, which emits a
// thesis_status.changed event into the stream.
function ThesisControl({ opp, onChanged }) {
  const [choice, setChoice] = useState('');
  const [evidence, setEvidence] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    if (!choice) return setError('Pick a status.');
    if (!evidence.trim()) return setError('An evidence note is required.');
    setBusy(true);
    setError(null);
    try {
      await api.setThesisStatus(opp.id, choice, evidence.trim());
      setChoice('');
      setEvidence('');
      onChanged();
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted">current:</span>
        <Badge tone={thesisTone(opp.thesisStatus)}>{opp.thesisStatus}</Badge>
      </div>
      <div className="flex flex-wrap gap-2">
        {THESIS_CHOICES.map((c) => (
          <button
            key={c}
            onClick={() => setChoice(c)}
            className={`rounded border px-3 py-1.5 text-sm ${
              choice === c ? 'border-sky-600 bg-edge text-slate-100' : 'border-edge text-muted hover:text-slate-200'
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      {choice && (
        <input
          value={evidence}
          onChange={(e) => setEvidence(e.target.value)}
          placeholder="Evidence note (required)"
          className="w-full rounded border border-edge bg-ink p-2 text-sm text-slate-100"
        />
      )}
      {error && <div className="text-sm text-red-400">{error}</div>}
      <button
        disabled={busy || !choice}
        onClick={submit}
        className="rounded bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
      >
        Set thesis status
      </button>
    </div>
  );
}

function Detail({ opp, onChanged }) {
  return (
    <div className="space-y-4">
      <Panel
        title={opp.entityRef}
        right={
          <div className="flex items-center gap-2">
            <Badge tone={scoreTone(opp.priorityScore)}>priority {opp.priorityScore}</Badge>
            <Link to={`/lineage/${opp.id}`} className="text-xs text-sky-400 underline">walk lineage</Link>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{opp.play}</Badge>
            <Badge tone={scoreTone(Math.round((opp.icpFit ?? 0) * 100))}>ICP fit {Math.round((opp.icpFit ?? 0) * 100)}%</Badge>
            <Badge tone="neutral">status: {opp.status}</Badge>
            <Badge tone={thesisTone(opp.thesisStatus)}>thesis: {opp.thesisStatus}</Badge>
          </div>
          <Field label="Thesis (falsifiable)">{opp.thesis}</Field>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field label="Why now">{opp.whyNow}</Field>
            <Field label="Why us">{opp.whyUs}</Field>
            <Field label="Why this person">{opp.whyThisPerson}</Field>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Business problem">{opp.businessProblem}</Field>
            <Field label="Desired outcome">{opp.desiredOutcome}</Field>
          </div>
          <Mono>{opp.id}</Mono>
        </div>
      </Panel>

      <Panel title="Thesis status control">
        <ThesisControl opp={opp} onChanged={onChanged} />
      </Panel>
    </div>
  );
}

export default function Opportunities() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    api.opportunities().then(setRows).catch((e) => setError(String(e.message || e)));
  }, []);

  useEffect(() => { load(); }, [load]);

  const selected = id ? rows.find((o) => o.id === id) : rows[0];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[22rem_1fr]">
      <Panel title={`Opportunities (${rows.length})`}>
        {error && <div className="mb-2 text-sm text-red-400">{error}</div>}
        {rows.length === 0 ? (
          <EmptyState>No opportunities minted yet.</EmptyState>
        ) : (
          <ul className="space-y-2">
            {rows.map((o) => (
              <li key={o.id}>
                <button
                  onClick={() => navigate(`/opportunities/${o.id}`)}
                  className={`w-full rounded border p-3 text-left text-sm ${
                    selected && selected.id === o.id ? 'border-sky-600 bg-edge' : 'border-edge hover:bg-edge/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-100">{o.entityRef}</span>
                    <Badge tone={scoreTone(o.priorityScore)}>{o.priorityScore}</Badge>
                  </div>
                  <div className="mt-1 line-clamp-2 text-xs text-muted">{o.thesis}</div>
                  <div className="mt-1"><Badge tone={thesisTone(o.thesisStatus)}>{o.thesisStatus}</Badge></div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div>
        {selected ? <Detail opp={selected} onChanged={load} /> : <EmptyState>Select an opportunity.</EmptyState>}
      </div>
    </div>
  );
}
