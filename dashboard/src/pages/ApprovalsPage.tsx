import { useEffect, useState } from 'react'
import type { ApprovalItem, ApprovalStatus } from '../types/dashboard'
import { getApprovalQueue } from '../services/dashboardService'
import ApprovalQueueTable from '../components/ApprovalQueueTable'

export default function ApprovalsPage() {
  const [items, setItems] = useState<ApprovalItem[]>([])
  const [filter, setFilter] = useState<ApprovalStatus | 'all'>('all')

  useEffect(() => {
    getApprovalQueue().then(setItems)
  }, [])

  function handleStatusChange(id: string, status: ApprovalStatus) {
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, status } : item))
  }

  const filtered = filter === 'all' ? items : items.filter((i) => i.status === filter)

  const counts = {
    all: items.length,
    pending: items.filter((i) => i.status === 'pending').length,
    approved: items.filter((i) => i.status === 'approved').length,
    rejected: items.filter((i) => i.status === 'rejected').length,
    needs_revision: items.filter((i) => i.status === 'needs_revision').length,
  }

  return (
    <div className="p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs text-gray-600 uppercase tracking-widest mb-0.5">Approval Queue</p>
          <h2 className="text-lg font-semibold text-white">Review Agent Outputs</h2>
        </div>
        <p className="text-xs text-gray-600">No action executes without approval.</p>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {(Object.keys(counts) as Array<keyof typeof counts>).map((key) => (
          <button
            key={key}
            onClick={() => setFilter(key as ApprovalStatus | 'all')}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors capitalize ${
              filter === key
                ? 'bg-violet-900/50 border-violet-700 text-violet-300'
                : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700'
            }`}
          >
            {key.replace('_', ' ')} ({counts[key]})
          </button>
        ))}
      </div>

      <ApprovalQueueTable items={filtered} onStatusChange={handleStatusChange} />
    </div>
  )
}
