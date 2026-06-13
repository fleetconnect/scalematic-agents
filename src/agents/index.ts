import { AgentDefinition, AgentId } from '../types/agent';
import { strategyAgent } from './strategyAgent';
import { researchAgent } from './researchAgent';
import { messagingAgent } from './messagingAgent';
import { contentAgent } from './contentAgent';
import { salesAgent } from './salesAgent';
import { crmAgent } from './crmAgent';
import { opsAgent } from './opsAgent';
import { metricsAgent } from './metricsAgent';
import { governanceAgent } from './governanceAgent';
import { interpreterAgent } from './interpreterAgent';
import { opportunitySynthesizerAgent } from './opportunitySynthesizerAgent';

export const AGENTS: Record<AgentId, AgentDefinition> = {
  strategy: strategyAgent,
  research: researchAgent,
  messaging: messagingAgent,
  content: contentAgent,
  sales: salesAgent,
  crm: crmAgent,
  ops: opsAgent,
  metrics: metricsAgent,
  governance: governanceAgent,
  interpreter: interpreterAgent,
  opportunity_synthesizer: opportunitySynthesizerAgent,
};

export function getAgent(id: AgentId): AgentDefinition {
  const agent = AGENTS[id];
  if (!agent) throw new Error(`Agent not found: ${id}`);
  return agent;
}

export function listAgents(): AgentDefinition[] {
  return Object.values(AGENTS);
}
