import { WorkflowDefinition } from '../types/workflow';

export const stalledLeadRevivalWorkflow: WorkflowDefinition = {
  id: 'stalled-lead-revival',
  name: 'Stalled Lead Revival',
  description: 'Identifies CRM leads with no activity for X days, scores revival priority, drafts messages, runs governance.',
  trigger: 'scheduled | manual',
  steps: [
    {
      stepIndex: 0,
      agentId: 'crm',
      taskType: 'find_stalled_leads',
      description: 'Identify leads with no activity beyond the stale threshold',
      requiresApproval: false,
      inputMapper: (input) => ({
        days_stalled: input.days_stalled ?? 14,
        pipeline_stages: input.pipeline_stages ?? [],
        max_leads: input.max_leads ?? 20,
        crm_data: input.crm_data ?? [],
      }),
    },
    {
      stepIndex: 1,
      agentId: 'strategy',
      taskType: 'prioritize_revival_list',
      description: 'Score and prioritize stalled leads by revival potential',
      requiresApproval: false,
      inputMapper: (input, prev) => ({
        stalled_leads: prev[0],
        offer: input.offer ?? 'AI-powered outbound sales automation',
        current_capacity: input.current_capacity ?? 'unknown',
      }),
    },
    {
      stepIndex: 2,
      agentId: 'messaging',
      taskType: 'draft_revival_messages',
      description: 'Draft personalised revival messages for top-priority leads',
      requiresApproval: true,
      inputMapper: (input, prev) => ({
        priority_leads: (prev[1] as Record<string, unknown>)?.next_actions ?? prev[1],
        stalled_leads: prev[0],
        channel: input.preferred_channel ?? 'linkedin',
        your_name: input.your_name ?? '',
        your_company: input.your_company ?? 'ScaleMatic',
        revival_context: 'stalled_lead_outreach',
      }),
    },
    {
      stepIndex: 3,
      agentId: 'governance',
      taskType: 'review_revival_messages',
      description: 'Governance check on revival messages before human approval',
      requiresApproval: false,
      inputMapper: (_input, prev) => ({
        content_to_review: prev[2],
        review_type: 'revival_outreach',
      }),
    },
  ],
};
