export type AgentId =
  | 'strategy'
  | 'research'
  | 'messaging'
  | 'content'
  | 'sales'
  | 'crm'
  | 'ops'
  | 'metrics'
  | 'governance'
  | 'interpreter'
  | 'opportunity_synthesizer';

export interface AgentDefinition {
  id: AgentId;
  name: string;
  role: string;
  systemPrompt: string;
  toolsAllowed: string[];
  approvalRequired: boolean;
  outputFormat: string;
}
