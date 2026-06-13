import type { DailyAgentReport } from '../types/dashboard'

interface Props {
  report: DailyAgentReport | null
  onRunScan: () => void
}

function Section({ title, items, color = 'gray' }: { title: string; items: string[]; color?: string }) {
  const dot: Record<string, string> = {
    gray:    'bg-gray-600',
    amber:   'bg-amber-500',
    red:     'bg-red-500',
    emerald: 'bg-emerald-500',
    violet:  'bg-violet-500',
  }
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">{title}</p>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
            <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${dot[color] ?? dot.gray}`} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function DailyReportPanel({ report, onRunScan }: Props) {
  if (!report) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex flex-col items-center justify-center text-center gap-3 min-h-[200px]">
        <p className="text-sm text-gray-500">No daily report generated yet.</p>
        <button
          onClick={onRunScan}
          className="px-4 py-2 text-xs font-medium text-violet-300 bg-violet-900/40 border border-violet-800/50 rounded-lg hover:bg-violet-900/60 transition-colors"
        >
          Run Daily Light Scan
        </button>
      </div>
    )
  }

  const ts = new Date(report.generatedAt).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs text-gray-600 uppercase tracking-widest">Daily Agent Summary</p>
          <p className="text-xs text-gray-600 mt-0.5">Generated {ts}</p>
        </div>
      </div>

      <div className="space-y-5">
        <Section title="What changed" items={report.whatChanged} />
        <Section title="Actions prepared" items={report.actionsPrepared} color="emerald" />
        <Section title="Needs approval" items={report.needsApproval} color="amber" />
        {report.needsHumanAttention.length > 0 && (
          <Section title="Needs human attention" items={report.needsHumanAttention} color="red" />
        )}
        <Section title="Skipped to save cost" items={report.skippedToSaveCost} color="violet" />

        <div className="pt-2 border-t border-gray-800">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Recommended next move</p>
          <p className="text-sm text-white font-medium">{report.recommendedNextMove}</p>
        </div>
      </div>
    </div>
  )
}
