import { AgentId } from '../types/agent';

// Routes a free-text task description to the most appropriate agent
const ROUTING_KEYWORDS: Record<AgentId, string[]> = {
  strategy: ['strategy', 'analyze', 'positioning', 'offer', 'icp', 'thesis', 'direction', 'diagnosis'],
  research: ['research', 'prospect', 'company', 'linkedin', 'context', 'background', 'who is', 'find out'],
  messaging: ['message', 'dm', 'outreach', 'cold email', 'reply', 'follow-up', 'linkedin message', 'revive'],
  content: ['content', 'post', 'linkedin post', 'newsletter', 'script', 'carousel', 'ad copy', 'write', 'transcript to'],
  sales: ['call', 'proposal', 'close', 'discovery', 'follow up', 'prep', 'brief', 'deal'],
  crm: ['crm', 'pipeline', 'lead', 'stage', 'task', 'contact', 'stalled', 'score'],
  ops: ['sop', 'workflow', 'process', 'checklist', 'onboarding', 'implementation', 'n8n', 'automation map'],
  metrics: ['metrics', 'numbers', 'performance', 'analytics', 'funnel', 'conversion', 'leaking', 'data'],
  governance: ['review', 'approve', 'check', 'brand safe', 'governance', 'reject', 'risky', 'tone'],
  interpreter: ['interpret', 'signal meaning', 'commercial mode', 'buying motion'],
  opportunity_synthesizer: ['synthesize opportunity', 'mint opportunity', 'falsifiable thesis', 'opportunity thesis'],
};

export function routeTask(description: string): AgentId {
  const lower = description.toLowerCase();
  const scores: Record<AgentId, number> = {
    strategy: 0, research: 0, messaging: 0, content: 0, sales: 0,
    crm: 0, ops: 0, metrics: 0, governance: 0,
    interpreter: 0, opportunity_synthesizer: 0,
  };

  for (const [agentId, keywords] of Object.entries(ROUTING_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) scores[agentId as AgentId]++;
    }
  }

  const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);
  return sorted[0][0] as AgentId;
}
