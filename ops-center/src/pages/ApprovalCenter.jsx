import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Panel, EmptyState, Badge, Field, Mono } from '../components/ui.jsx';

// This screen exists to maximize quality verdicts per human-minute. Everything an operator
// needs to judge one draft is on screen at once: the message, the opportunity it came from,
// the governance gate, the risk flags, and the source evidence. Exactly three actions.

function scoreTone(n) {
  if (n >= 70) return 'green';
  if (n >= 45) return 'amber';
  return 'red';
}

function GovernanceGate({ governance }) {
  if (!governance) return <EmptyState>No governance output attached to this draft.</EmptyState>;
  const status = governance.status || 'unknown';
  const tone = status === 'approved' ? 'green' : status === 'rejected' ? 'red' : 'amber';
  const issues = Array.isArray(governance.issues) ? governance.issues : [];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Badge tone={tone}>governance: {status}</Badge>
        {typeof governance.overall_score === 'number' && (
          <Badge tone={scoreTone(governance.overall_score)}>brand-safe {governance.overall_score}/100</Badge>
        )}
        {Array.isArray(governance.approved_for_channels) && governance.approved_for_channels.length > 0 && (
          <span className="text-xs text-muted">channels: {governance.approved_for_channels.join(', ')}</span>
        )}
      </div>
      {governance.reasoning && <p className="text-sm text-slate-300">{governance.reasoning}</p>}
      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
          Risk flags ({issues.length})
        </div>
        {issues.length === 0 ? (
          <div className="text-sm text-muted">None raised.</div>
        ) : (
          <ul className="space-y-2">
            {issues.map((iss, i) => (
              <li key={i} className="rounded border border-edge bg-ink/40 p-2 text-sm">
                <div className="flex items-center gap-2">
                  <Badge tone={iss.severity === 'critical' ? 'red' : iss.severity === 'moderate' ? 'amber' : 'neutral'}>
                    {iss.severity || 'flag'}
                  </Badge>
                  <span className="text-slate-200">{iss.type}</span>
                </div>
                {iss.excerpt && <div className="mt-1 italic text-muted">"{iss.excerpt}"</div>}
                {iss.reason && <div className="mt-1 text-slate-300">{iss.reason}</div>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Evidence({ evidence }) {
  if (!evidence || evidence.length === 0)
    return <EmptyState>No source signals linked to this opportunity.</EmptyState>;
  return (
    <ul className="space-y-2">
      {evidence.map((s) => (
        <li key={s.id} className="rounded border border-edge bg-ink/40 p-3 text-sm">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Badge tone="blue">{s.source}</Badge>
            <Badge tone="violet">{s.signalType}</Badge>
            {typeof s.score === 'number' && <Badge tone={scoreTone(s.score)}>signal {s.score}</Badge>}
            {s.firstParty && <Badge tone="green">first-party</Badge>}
          </div>
          <div className="text-slate-200">{s.rawEvidence}</div>
          {s.evidenceUrl && (
            <a href={s.evidenceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-sky-400 underline">
              source record
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

function OpportunitySummary({ opportunity }) {
  if (!opportunity) return <EmptyState>This draft has no linked opportunity record.</EmptyState>;
  const o = opportunity;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={scoreTone(o.priorityScore)}>priority {o.priorityScore}</Badge>
        <Badge tone={scoreTone(Math.round((o.icpFit ?? 0) * 100))}>ICP fit {Math.round((o.icpFit ?? 0) * 100)}%</Badge>
        <Badge tone="neutral">{o.play}</Badge>
        <Badge tone="neutral">thesis: {o.thesisStatus}</Badge>
        <Link to={`/lineage/${o.id}`} className="text-xs text-sky-400 underline">walk lineage</Link>
      </div>
      <Field label="Thesis (falsifiable)">{o.thesis}</Field>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Field label="Why now">{o.whyNow}</Field>
        <Field label="Why us">{o.whyUs}</Field>
        <Field label="Why this person">{o.whyThisPerson}</Field>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Business problem">{o.businessProblem}</Field>
        <Field label="Desired outcome">{o.desiredOutcome}</Field>
      </div>
      {o.prediction && (
        <Field label="ES-3 prediction">
          {o.prediction.prediction} — {o.prediction.predicted_thesis}{' '}
          <Mono>conf {o.prediction.confidence}</Mono>
        </Field>
      )}
    </div>
  );
}

function VerdictBar({ ctx, onDone }) {
  const [mode, setMode] = useState(null); // null | 'EDIT' | 'REJECT'
  const [reason, setReason] = useState('');
  const [edited, setEdited] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const draftBody = ctx.draft.message || '';

  useEffect(() => {
    setMode(null);
    setReason('');
    setEdited(draftBody);
    setError(null);
  }, [ctx.approval.id, draftBody]);

  if (ctx.verdict) {
    const v = ctx.verdict;
    const tone = v.verdict === 'APPROVED' ? 'green' : v.verdict === 'EDITED' ? 'blue' : 'red';
    return (
      <div className="rounded border border-edge bg-ink/40 p-3">
        <div className="flex items-center gap-2">
          <Badge tone={tone}>verdict recorded: {v.verdict}</Badge>
          <Mono>{new Date(v.createdAt).toLocaleString()}</Mono>
        </div>
        {v.reason && <div className="mt-2 text-sm text-slate-300">Reason: {v.reason}</div>}
        {v.diff && <pre className="mt-2 overflow-x-auto rounded bg-black/40 p-2 text-xs text-slate-300">{v.diff}</pre>}
      </div>
    );
  }

  const submit = async (verdict) => {
    if ((verdict === 'EDITED' || verdict === 'REJECTED') && !reason.trim()) {
      setError('A reason is required for EDIT and REJECT.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = { verdict, reason: reason.trim() || undefined, decided_by: 'operator' };
      if (verdict === 'EDITED') body.after_text = edited;
      await api.recordVerdict(ctx.approval.id, body);
      onDone();
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {mode === 'EDIT' && (
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Edited message (diff captured automatically)</div>
          <textarea
            value={edited}
            onChange={(e) => setEdited(e.target.value)}
            rows={8}
            className="w-full rounded border border-edge bg-ink p-2 text-sm text-slate-100"
          />
        </div>
      )}
      {(mode === 'EDIT' || mode === 'REJECT') && (
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={mode === 'REJECT' ? 'Why is this rejected? (required)' : 'What changed and why? (required)'}
          className="w-full rounded border border-edge bg-ink p-2 text-sm text-slate-100"
        />
      )}
      {error && <div className="text-sm text-red-400">{error}</div>}
      <div className="flex flex-wrap gap-2">
        <button
          disabled={busy}
          onClick={() => submit('APPROVED')}
          className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          Approve
        </button>
        <button
          disabled={busy}
          onClick={() => (mode === 'EDIT' ? submit('EDITED') : setMode('EDIT'))}
          className="rounded bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {mode === 'EDIT' ? 'Submit edit' : 'Edit'}
        </button>
        <button
          disabled={busy}
          onClick={() => (mode === 'REJECT' ? submit('REJECTED') : setMode('REJECT'))}
          className="rounded bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
        >
          {mode === 'REJECT' ? 'Confirm reject' : 'Reject'}
        </button>
        {mode && (
          <button disabled={busy} onClick={() => setMode(null)} className="rounded border border-edge px-4 py-2 text-sm text-muted hover:text-slate-200">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

function ReviewPanel({ approvalId, onVerdict }) {
  const [ctx, setCtx] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setCtx(null);
    setError(null);
    api.reviewContext(approvalId).then(setCtx).catch((e) => setError(String(e.message || e)));
  }, [approvalId]);

  useEffect(() => { load(); }, [load]);

  if (error) return <Panel title="Review"><div className="text-sm text-red-400">{error}</div></Panel>;
  if (!ctx) return <Panel title="Review"><div className="text-sm text-muted">Loading…</div></Panel>;

  return (
    <div className="space-y-4">
      <Panel
        title="Draft message"
        right={<Badge tone="neutral">{ctx.draft.channel || 'channel n/a'}</Badge>}
      >
        {ctx.draft.subject && <div className="mb-2 text-sm font-semibold text-slate-100">Subject: {ctx.draft.subject}</div>}
        <pre className="whitespace-pre-wrap break-words rounded bg-ink/60 p-3 text-sm text-slate-100">{ctx.draft.message || '(no message body)'}</pre>
      </Panel>

      <Panel title="Verdict">
        <VerdictBar ctx={ctx} onDone={() => { onVerdict(); load(); }} />
      </Panel>

      <Panel title="Opportunity">
        <OpportunitySummary opportunity={ctx.opportunity} />
      </Panel>

      <Panel title="Governance gate">
        <GovernanceGate governance={ctx.governance} />
      </Panel>

      <Panel title="Source evidence">
        <Evidence evidence={ctx.evidence} />
      </Panel>
    </div>
  );
}

export default function ApprovalCenter({ stream }) {
  const [pending, setPending] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    api.pendingApprovals()
      .then((rows) => {
        setPending(rows);
        setSelected((cur) => cur || (rows[0] ? rows[0].id : null));
      })
      .catch((e) => setError(String(e.message || e)));
  }, []);

  useEffect(() => { load(); }, [load]);

  // A new submitted-for-approval or verdict event means the queue changed; refresh it.
  useEffect(() => {
    const latest = stream.events[0];
    if (!latest) return;
    if (
      latest.type === 'message.submitted_for_approval' ||
      latest.type === 'message.approved' ||
      latest.type === 'message.edited' ||
      latest.type === 'message.rejected'
    ) {
      load();
    }
  }, [stream.events, load]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[20rem_1fr]">
      <Panel title={`Pending queue (${pending.length})`}>
        {error && <div className="mb-2 text-sm text-red-400">{error}</div>}
        {pending.length === 0 ? (
          <EmptyState>No drafts awaiting a verdict. An idle queue is shown as idle.</EmptyState>
        ) : (
          <ul className="space-y-2">
            {pending.map((a) => (
              <li key={a.id}>
                <button
                  onClick={() => setSelected(a.id)}
                  className={`w-full rounded border p-3 text-left text-sm ${
                    selected === a.id ? 'border-sky-600 bg-edge' : 'border-edge hover:bg-edge/50'
                  }`}
                >
                  <div className="font-medium text-slate-100">{a.output?.entity_ref || a.taskId}</div>
                  <div className="mt-1 line-clamp-2 text-xs text-muted">{a.output?.subject || a.output?.message || a.agentId}</div>
                  <Mono>{new Date(a.createdAt).toLocaleString()}</Mono>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div>
        {selected ? (
          <ReviewPanel approvalId={selected} onVerdict={load} />
        ) : (
          <EmptyState>Select a draft from the queue to review.</EmptyState>
        )}
      </div>
    </div>
  );
}
