import type { Agent } from '../types/dashboard'
import AgentStatusCard from './AgentStatusCard'

interface Props {
  agents: Agent[]
  onSelectAgent: (agent: Agent) => void
}

export default function AgentActivityBoard({ agents, onSelectAgent }: Props) {
  const running = agents.filter((a) => a.status === 'running' || a.status === 'waiting_for_approval')
  const rest = agents.filter((a) => a.status !== 'running' && a.status !== 'waiting_for_approval')

  return (
    <section>
      <p className="text-xs text-gray-600 uppercase tracking-widest mb-3">Agent Activity</p>

      {running.length > 0 && (
        <>
          <p className="text-xs text-violet-500 mb-2">Active now</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            {running.map((agent) => (
              <AgentStatusCard key={agent.id} agent={agent} onClick={onSelectAgent} />
            ))}
          </div>
        </>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {rest.map((agent) => (
          <AgentStatusCard key={agent.id} agent={agent} onClick={onSelectAgent} />
        ))}
      </div>
    </section>
  )
}
