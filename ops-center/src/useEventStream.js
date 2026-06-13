import { useEffect, useRef, useState } from 'react';

// Subscribes to GET /api/events/stream (Server-Sent Events, not WebSockets).
// The backend replays recent events on connect (event: replay) then streams new ones
// (event: append). We keep them newest-first and cap the buffer so a long-lived tab does
// not grow without bound. Connection state is exposed so the UI can show live/offline
// honestly — an idle backend looks idle, it is never faked.
export function useEventStream({ cap = 300 } = {}) {
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState('connecting');
  const sourceRef = useRef(null);

  useEffect(() => {
    const source = new EventSource('/api/events/stream');
    sourceRef.current = source;

    const push = (raw) => {
      try {
        const evt = JSON.parse(raw);
        setEvents((prev) => [evt, ...prev].slice(0, cap));
      } catch {
        // A malformed frame is dropped rather than crashing the feed.
      }
    };

    source.addEventListener('replay', (e) => push(e.data));
    source.addEventListener('append', (e) => push(e.data));
    source.addEventListener('ready', () => setStatus('live'));
    source.onopen = () => setStatus('live');
    source.onerror = () => setStatus('reconnecting');

    return () => {
      source.close();
      sourceRef.current = null;
    };
  }, [cap]);

  return { events, status };
}
