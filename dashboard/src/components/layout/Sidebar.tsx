import { NavLink } from 'react-router-dom'

const nav = [
  { to: '/dashboard', label: 'Command Center', end: true },
  { to: '/dashboard/agents', label: 'Agent Board' },
  { to: '/dashboard/approvals', label: 'Approval Queue' },
  { to: '/dashboard/reports', label: 'Reports' },
]

export default function Sidebar() {
  return (
    <aside className="w-52 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="px-4 py-5 border-b border-gray-800">
        <p className="text-xs text-gray-600 uppercase tracking-widest mb-0.5">ScaleMatic</p>
        <h1 className="text-sm font-semibold text-violet-400 leading-tight">Command Center</h1>
      </div>

      <nav className="flex-1 py-3 space-y-0.5">
        {nav.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-4 py-2 text-sm transition-colors ${
                isActive
                  ? 'text-white bg-gray-800 border-r-2 border-violet-500'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-gray-800">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-gray-600">System online</span>
        </div>
        <p className="text-xs text-gray-700 mt-1">API: localhost:3100</p>
      </div>
    </aside>
  )
}
