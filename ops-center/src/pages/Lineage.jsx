import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api.js';
import { Panel, EmptyState, Badge, Mono } from '../components/ui.jsx';

// Vertical lineage chain (not a graph engine). Lineage is opportunity-rooted: a clicked ID
// that is a signal or interpretation resolves up to its owning opportunity, then we render
// the full chain Signal -> Interpretation -> Opportunity -> downstream events in order.

function Node({ kind, tone, title, body, id, highlight, meta }) {
  return (
    <div className="relative pl-6">
      <span className={`absolute left-0 top-2 h-3 w-3 rounded-full ${highlight ? 'ring-2 ring-sky-400' : ''} ${tone}`} />
      <div className={`rounded border p-3 ${highlight ? 'border-sky-600 bg-edge' : 'border-edge bg-panel'}`}>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{kind}</Badge>
          {meta}
          {id && <Mono>{id.slice(0, 8)}</Mono>}
        </div>
        {title && <div className="text-sm font-medium text-slate-100">{title}</div>}
        {body && <div className="mt-1 text-sm text-slate-300">{body}</div>}
      </div>
    </div>
  );
}

async function resolveLineage(id) {
  try {
    return { data: await api.lineage(id), clicked: id };
  } catch (e) {
    if (!String(e.message || e).includes('Not found')) throw e;
  }
  // Clicked ID was not an opportunity — find the opportunity that owns it.
  const opps = await api.opportunities(200);
  const owner = opps.find(
    (o) => o.id === id || (o.signalIds || []).includes(id) || (o.interpretationIds || []).includes(id)
  );
  if (!owner) return { data: null, clicked: id };
  return { data: await api.lineage(owner.id), clicked: id };
}

export default function Lineage() {
  const { id } = useParams();
  const [state, setState] = useState({ loading: true });

  const load = useCallback(() => {
    setState({ loading: true });
    resolveLineage(id)
      .then(({ data, clicked }) => setState({ loading: false, data, clicked }))
      .catch((e) => setState({ loading: false, error: String(e.message || e) }));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (state.loading) return <Panel title="Lineage"><div className="text-sm text-muted">Resolving…</div></Panel>;
  if (state.error) return <Panel title="Lineage"><div className="text-sm text-red-400">{state.error}</div></Panel>;
  if (!state.data)
    return (
      <Panel title="Lineage">
        <EmptyState>
          <div>
            <Mono>{id}</Mono> is not an opportunity and no opportunity references it. Lineage is
            opportunity-rooted; click an opportunity or one of its signal/interpretation IDs.
          </div>
        </EmptyState>
      </Panel>
    );

  const { opportunity, interpretations, signals, events } = state.data;
  const clicked = state.clicked;
  const ordered = [...(events || [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return (
    <Panel
      title="Lineage chain"
      right={<Link to={`/opportunities/${opportunity.id}`} className="text-xs text-sky-400 underline">open opportunity</Link>}
    >
      <div className="space-y-3">
        {signals.map((s) => (
          <Node
            key={s.id}
            kind="signal"
            tone="bg-sky-500"
            id={s.id}
            highlight={clicked === s.id}
            meta={<Badge tone="blue">{s.source} · {s.signalType}</Badge>}
            body={s.rawEvidence}
          />
        ))}
        {interpretations.map((it) => (
          <Node
            key={it.id}
            kind="interpretation"
            tone="bg-violet-500"
            id={it.id}
            highlight={clicked === it.id}
            meta={<Badge tone="violet">{it.commercialMode}</Badge>}
            title={it.likelyProblem}
            body={it.reasoningTrace}
          />
        ))}
        <Node
          kind="opportunity"
          tone="bg-emerald-500"
          id={opportunity.id}
          highlight={clicked === opportunity.id}
          meta={<Badge tone="green">priority {opportunity.priorityScore} · thesis {opportunity.thesisStatus}</Badge>}
          title={opportunity.thesis}
          body={opportunity.whyNow}
        />
        {ordered.map((e) => (
          <Node
            key={e.id}
            kind={e.type}
            tone="bg-slate-500"
            id={e.id}
            meta={<Mono>{new Date(e.createdAt).toLocaleString()}</Mono>}
            body={Object.keys(e.payload || {}).length ? JSON.stringify(e.payload) : null}
          />
        ))}
      </div>
    </Panel>
  );
}
