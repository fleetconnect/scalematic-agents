import { useEffect, useState } from 'react'
import type { Agent, AgentTask } from '../types/dashboard'
import { getAgentActivity, getAgentTasks } from '../services/dashboardService'
import AgentActivityBoard from '../components/AgentActivityBoard'
import AgentDetailDrawer from '../components/AgentDetailDrawer'

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [selectedTasks, setSelectedTasks] = useState<AgentTask[]>([])

  useEffect(() => {
    getAgentActivity().then(setAgents)
  }, [])

  async function handleSelectAgent(agent: Agent) {
    setSelectedAgent(agent)
    const tasks = await getAgentTasks(agent.id)
    setSelectedTasks(tasks)
  }

  const running = agents.filter((a) => ['running', 'waiting_for_approval', 'needs_human_input'].includes(a.status)).length
  const failed = agents.filter((a) => a.status === 'failed').length

  return (
    <div className="p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs text-gray-600 uppercase tracking-widest mb-0.5">Agent Board</p>
          <h2 className="text-lg font-semibold text-white">All Agents</h2>
        </div>
        <div className="flex gap-3 text-xs">
          <span className="text-violet-400">{running} active</span>
          <span className="text-gray-600">·</span>
          {failed > 0
            ? <span className="text-red-400">{failed} failed</span>
            : <span className="text-emerald-400">0 failed</span>
          }
          <span className="text-gray-600">·</span>
          <span className="text-gray-500">{agents.length} total</span>
        </div>
      </div>

      <AgentActivityBoard agents={agents} onSelectAgent={handleSelectAgent} />

      <AgentDetailDrawer
        agent={selectedAgent}
        tasks={selectedTasks}
        onClose={() => setSelectedAgent(null)}
      />
    </div>
  )
}
