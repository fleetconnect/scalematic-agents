import { useState } from 'react'
import type { ApprovalItem, ApprovalStatus } from '../types/dashboard'
import StatusBadge from './StatusBadge'
import { approveItem, rejectItem, requestRevision } from '../services/dashboardService'

interface Props {
  items: ApprovalItem[]
  onStatusChange: (id: string, status: ApprovalStatus) => void
}

const typeLabels: Record<string, string> = {
  email: 'Email',
  sms: 'SMS',
  linkedin_dm: 'LinkedIn DM',
  proposal: 'Proposal',
  content_post: 'Content Post',
  crm_update: 'CRM Update',
  opportunity_update: 'Opportunity',
  calendar_invite: 'Calendar',
  workflow_trigger: 'Workflow',
}

const agentLabels: Record<string, string> = {
  messaging: 'Messaging',
  content: 'Content',
  crm: 'CRM',
  sales: 'Sales',
  governance: 'Governance',
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  if (h > 23) return `${Math.floor(h / 24)}d ago`
  if (h > 0) return `${h}h ago`
  return `${m}m ago`
}

function DraftModal({ item, onClose }: { item: ApprovalItem; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-lg w-full p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-medium text-white">Full Draft — {item.contactName}</p>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg leading-none">×</button>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 text-sm text-gray-300 whitespace-pre-wrap leading-relaxed mb-4">
          {item.fullDraft ?? 'No draft content available.'}
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-gray-400 bg-gray-800 rounded hover:bg-gray-700">Close</button>
        </div>
      </div>
    </div>
  )
}

export default function ApprovalQueueTable({ items, onStatusChange }: Props) {
  const [draftItem, setDraftItem] = useState<ApprovalItem | null>(null)
  const [loading, setLoading] = useState<string | null>(null)

  async function handleAction(id: string, action: 'approve' | 'reject' | 'revision') {
    setLoading(id)
    if (action === 'approve') {
      await approveItem(id)
      onStatusChange(id, 'approved')
    } else if (action === 'reject') {
      await rejectItem(id, 'Rejected from dashboard')
      onStatusChange(id, 'rejected')
    } else {
      await requestRevision(id, 'Needs revision — review comments required')
      onStatusChange(id, 'needs_revision')
    }
    setLoading(null)
  }

  if (items.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
        <p className="text-sm text-gray-500">No pending approvals.</p>
      </div>
    )
  }

  return (
    <>
      {draftItem && <DraftModal item={draftItem} onClose={() => setDraftItem(null)} />}

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                {['Type', 'Contact', 'Agent', 'Created', 'Risk', 'Summary', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-widest font-medium whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const isPending = item.status === 'pending'
                const isLoading = loading === item.id
                return (
                  <tr key={item.id} className="border-b border-gray-800/60 last:border-0 hover:bg-gray-800/20 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-gray-400">{typeLabels[item.type] ?? item.type}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-white font-medium">{item.contactName}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-gray-500">{agentLabels[item.agentId] ?? item.agentId}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-gray-600">{timeAgo(item.createdAt)}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={item.riskLevel} />
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="text-xs text-gray-400 line-clamp-2">{item.summary}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {item.fullDraft && (
                          <button
                            onClick={() => setDraftItem(item)}
                            className="px-2 py-1 text-xs text-gray-400 bg-gray-800 hover:bg-gray-700 rounded transition-colors"
                          >
                            View
                          </button>
                        )}
                        {isPending && (
                          <>
                            <button
                              onClick={() => handleAction(item.id, 'approve')}
                              disabled={isLoading}
                              className="px-2 py-1 text-xs text-emerald-300 bg-emerald-900/40 hover:bg-emerald-900/60 rounded transition-colors disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleAction(item.id, 'revision')}
                              disabled={isLoading}
                              className="px-2 py-1 text-xs text-amber-300 bg-amber-900/30 hover:bg-amber-900/50 rounded transition-colors disabled:opacity-50"
                            >
                              Revise
                            </button>
                            <button
                              onClick={() => handleAction(item.id, 'reject')}
                              disabled={isLoading}
                              className="px-2 py-1 text-xs text-red-300 bg-red-900/30 hover:bg-red-900/50 rounded transition-colors disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
