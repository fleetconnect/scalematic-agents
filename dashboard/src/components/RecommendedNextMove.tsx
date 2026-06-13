interface Props {
  recommendation: string
}

export default function RecommendedNextMove({ recommendation }: Props) {
  return (
    <div className="bg-violet-950/40 border border-violet-800/50 rounded-xl p-4 flex items-start gap-3">
      <div className="w-2 h-2 rounded-full bg-violet-400 mt-1.5 flex-shrink-0 animate-pulse" />
      <div>
        <p className="text-xs text-violet-400 uppercase tracking-widest mb-1 font-medium">Recommended Next Move</p>
        <p className="text-white text-sm font-medium">{recommendation}</p>
      </div>
    </div>
  )
}
