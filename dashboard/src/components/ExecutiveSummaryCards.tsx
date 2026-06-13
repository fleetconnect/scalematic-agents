import type { ExecutiveSummary, SummaryCard } from '../types/dashboard'

const colorMap: Record<string, string> = {
  green:   'text-emerald-400',
  amber:   'text-amber-400',
  red:     'text-red-400',
  violet:  'text-violet-400',
  default: 'text-gray-100',
}

const borderMap: Record<string, string> = {
  green:   'border-emerald-900/60',
  amber:   'border-amber-900/60',
  red:     'border-red-900/60',
  violet:  'border-violet-900/60',
  default: 'border-gray-800',
}

function Delta({ delta }: { delta: number }) {
  if (delta > 0) return <span className="text-emerald-500 text-xs">+{delta}</span>
  if (delta < 0) return <span className="text-red-500 text-xs">{delta}</span>
  return <span className="text-gray-700 text-xs">—</span>
}

function Card({ card }: { card: SummaryCard }) {
  const color = colorMap[card.statusColor ?? 'default']
  const border = borderMap[card.statusColor ?? 'default']

  return (
    <div className={`bg-gray-900 border ${border} rounded-xl p-4 flex flex-col gap-1`}>
      <p className="text-xs text-gray-500 uppercase tracking-widest leading-none">{card.label}</p>
      <div className="flex items-end justify-between mt-1">
        <span className={`text-2xl font-semibold ${color}`}>{card.value}</span>
        <Delta delta={card.delta} />
      </div>
    </div>
  )
}

interface Props {
  summary: ExecutiveSummary
}

export default function ExecutiveSummaryCards({ summary }: Props) {
  return (
    <section>
      <p className="text-xs text-gray-600 uppercase tracking-widest mb-3">Today at a glance</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {summary.cards.map((card) => (
          <Card key={card.key} card={card} />
        ))}
      </div>
    </section>
  )
}
