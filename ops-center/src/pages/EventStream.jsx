import { Link } from 'react-router-dom';
import { Panel, Badge, Mono, StatusDot } from '../components/ui.jsx';

// Reverse-chron live feed of the append-only event log over SSE. Lineage IDs (subject and
// parents) are clickable and jump to the lineage explorer. This renders only real events;
// an idle system shows an empty, honest feed.

const TYPE_TONE = {
  'signal.detected': 'blue',
  'interpretation.created': 'violet',
  'opportunity.minted': 'green',
  'message.drafted': 'neutral',
  'message.submitted_for_approval': 'amber',
  'message.approved': 'green',
  'message.edited': 'blue',
  'message.rejected': 'red',
  'message.sent': 'green',
  'reply.received': 'violet',
  'conversation.started': 'violet',
  'thesis_status.changed': 'amber',
  'opportunity.closed': 'red',
  'opportunity.killed': 'red',
  'outcome.recorded': 'neutral',
};

function IdLink({ id }) {
  if (!id) return null;
  return (
    <Link to={`/lineage/${id}`} className="font-mono text-xs text-sky-400 hover:underline">
      {id.slice(0, 8)}
    </Link>
  );
}

export default function EventStream({ stream }) {
  return (
    <Panel
      title="Event stream"
      right={
        <StatusDot
          ok={stream.status === 'live' ? null : false}
          label={`${stream.status} · ${stream.events.length} events`}
        />
      }
    >
      {stream.events.length === 0 ? (
        <div className="text-sm text-muted">No events yet. The stream is connected and idle.</div>
      ) : (
        <ul className="divide-y divide-edge">
          {stream.events.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
              <Mono>{new Date(e.createdAt).toLocaleTimeString()}</Mono>
              <Badge tone={TYPE_TONE[e.type] || 'neutral'}>{e.type}</Badge>
              {e.entityRef && <span className="text-slate-300">{e.entityRef}</span>}
              <span className="text-muted">subject</span>
              <IdLink id={e.subjectId} />
              {e.parentIds && e.parentIds.length > 0 && (
                <>
                  <span className="text-muted">parents</span>
                  {e.parentIds.slice(0, 4).map((p) => (
                    <IdLink key={p} id={p} />
                  ))}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
