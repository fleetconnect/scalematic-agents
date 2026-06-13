import { AgentId } from '../types/agent';
import { MemoryCategory } from '../types/memory';
import { searchMemory } from './vectorStore';

const AGENT_CATEGORIES: Record<AgentId, MemoryCategory[]> = {
  strategy: [
    'company-overview',
    'offers-and-pricing',
    'icp-and-buyer-psychology',
    'transcripts-and-call-notes',
  ],
  research: [
    'icp-and-buyer-psychology',
    'case-studies-and-proof',
    'company-overview',
  ],
  messaging: [
    'dm-frameworks',
    'content-voice-and-examples',
    'sales-scripts-and-objections',
    'governance-rules',
  ],
  content: [
    'content-voice-and-examples',
    'transcripts-and-call-notes',
    'case-studies-and-proof',
  ],
  sales: [
    'sales-scripts-and-objections',
    'proposals-and-growth-plans',
    'transcripts-and-call-notes',
  ],
  crm: ['icp-and-buyer-psychology', 'sales-scripts-and-objections'],
  ops: ['client-delivery-sops', 'tool-stack-and-workflows'],
  metrics: ['metrics-and-reports', 'company-overview'],
  governance: ['governance-rules', 'content-voice-and-examples'],
  interpreter: [
    'icp-and-buyer-psychology',
    'company-overview',
    'case-studies-and-proof',
  ],
  opportunity_synthesizer: [
    'icp-and-buyer-psychology',
    'offers-and-pricing',
    'company-overview',
  ],
};

export function getContextForAgent(
  agentId: AgentId,
  query: string,
  maxChars = 2500
): string {
  const preferred = AGENT_CATEGORIES[agentId] ?? [];

  const categoryHits = preferred.flatMap((cat) => searchMemory(query, 2, cat));
  const generalHits = searchMemory(query, 5);

  const seen = new Set<string>();
  const ranked = [...categoryHits, ...generalHits]
    .filter((r) => {
      if (r.score === 0 || seen.has(r.document.id)) return false;
      seen.add(r.document.id);
      return true;
    })
    .slice(0, 6);

  if (!ranked.length) return '';

  return ranked
    .map(
      (r) =>
        `[${r.document.category}] ${r.document.title}:\n${r.document.content.slice(0, 500)}`
    )
    .join('\n\n---\n\n')
    .slice(0, maxChars);
}
