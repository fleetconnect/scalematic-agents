import { useEffect, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { api } from './api.js';
import { useEventStream } from './useEventStream.js';
import { StatusDot, Badge } from './components/ui.jsx';
import ApprovalCenter from './pages/ApprovalCenter.jsx';
import Opportunities from './pages/Opportunities.jsx';
import EventStream from './pages/EventStream.jsx';
import Lineage from './pages/Lineage.jsx';
import Metrics from './pages/Metrics.jsx';

const NAV = [
  { to: '/', label: 'Approval Center', end: true },
  { to: '/opportunities', label: 'Opportunities' },
  { to: '/events', label: 'Event Stream' },
  { to: '/metrics', label: 'Metrics' },
];

function Header({ stream, system }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-edge bg-panel px-5 py-3">
      <div className="flex items-center gap-3">
        <span className="text-sm font-bold tracking-wide text-slate-100">SCALEMATIC OPS CENTER</span>
        <Badge tone="neutral">Commercial Opportunity OS</Badge>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <StatusDot
          ok={stream.status === 'live' ? null : false}
          label={stream.status === 'live' ? 'event stream live' : `stream ${stream.status}`}
        />
        {system && (
          <>
            <Badge tone={system.liveSends ? 'red' : 'green'}>
              LIVE_SENDS {system.liveSends ? 'ON' : 'OFF'}
            </Badge>
            <Badge tone={system.judgment.loaded ? 'green' : 'amber'}>
              judgment {system.judgment.loaded ? `${system.judgment.rules} rules` : 'not loaded'}
            </Badge>
          </>
        )}
      </div>
    </header>
  );
}

export default function App() {
  const stream = useEventStream();
  const [system, setSystem] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = () => api.systemStatus().then((s) => alive && setSystem(s)).catch(() => {});
    load();
    const t = setInterval(load, 20000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return (
    <div className="flex h-full flex-col">
      <Header stream={stream} system={system} />
      <div className="flex flex-1 overflow-hidden">
        <nav className="hidden w-48 shrink-0 flex-col gap-1 border-r border-edge bg-panel/60 p-3 sm:flex">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `rounded px-3 py-2 text-sm ${
                  isActive ? 'bg-edge text-slate-100' : 'text-muted hover:bg-edge/50 hover:text-slate-200'
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <main className="flex-1 overflow-y-auto p-5">
          <Routes>
            <Route path="/" element={<ApprovalCenter stream={stream} system={system} />} />
            <Route path="/opportunities" element={<Opportunities />} />
            <Route path="/opportunities/:id" element={<Opportunities />} />
            <Route path="/events" element={<EventStream stream={stream} />} />
            <Route path="/lineage/:id" element={<Lineage />} />
            <Route path="/metrics" element={<Metrics system={system} />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
