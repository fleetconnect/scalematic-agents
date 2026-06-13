import { useState } from 'react'
import { refreshDashboardData } from '../../services/dashboardService'

export default function TopBar() {
  const [refreshing, setRefreshing] = useState(false)

  async function handleRefresh() {
    setRefreshing(true)
    await refreshDashboardData()
    setTimeout(() => setRefreshing(false), 600)
  }

  const now = new Date().toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })

  return (
    <header className="h-12 flex items-center justify-between px-6 bg-gray-900 border-b border-gray-800 flex-shrink-0">
      <p className="text-xs text-gray-600">{now}</p>
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-600 hidden sm:block">Mock data active</span>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors disabled:opacity-50"
        >
          <span className={refreshing ? 'animate-spin inline-block' : ''}>↻</span>
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
    </header>
  )
}
