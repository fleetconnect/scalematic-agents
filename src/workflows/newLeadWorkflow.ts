import { WorkflowDefinition } from '../types/workflow';

export const newLeadWorkflow: WorkflowDefinition = {
  id: 'new-lead',
  name: 'New Lead Workflow',
  description: 'Runs when a new lead enters the CRM. Researches, scores, drafts first message, routes to approval.',
  trigger: 'crm_new_lead | manual',
  steps: [
    {
      stepIndex: 0,
      agentId: 'research',
      taskType: 'research_lead',
      description: 'Research the prospect: background, company, pain points, hooks',
      requiresApproval: false,
      inputMapper: (input) => ({
        person_name: input.person_name ?? '',
        company: input.company ?? '',
        role: input.role ?? '',
        linkedin_url: input.linkedin_url ?? '',
        email: input.email ?? '',
        lead_source: input.lead_source ?? '',
        notes: input.notes ?? '',
      }),
    },
    {
      stepIndex: 1,
      agentId: 'strategy',
      taskType: 'identify_lead_angle',
      description: 'Identify best offer angle, likely pain, and positioning',
      requiresApproval: false,
      inputMapper: (input, prev) => ({
        research: prev[0],
        offer: input.offer ?? 'AI-powered outbound sales automation',
        icp_notes: input.icp_notes ?? '',
      }),
    },
    {
      stepIndex: 2,
      agentId: 'crm',
      taskType: 'score_lead',
      description: 'Score the lead and recommend pipeline stage',
      requiresApproval: false,
      inputMapper: (input, prev) => ({
        research: prev[0],
        strategy: prev[1],
        person_name: input.person_name ?? '',
        company: input.company ?? '',
        lead_source: input.lead_source ?? '',
      }),
    },
    {
      stepIndex: 3,
      agentId: 'messaging',
      taskType: 'draft_first_message',
      description: 'Draft 2-3 first-touch message variants',
      requiresApproval: true,
      inputMapper: (input, prev) => ({
        research: prev[0],
        strategy: prev[1],
        lead_score: prev[2],
        channel: input.preferred_channel ?? 'linkedin',
        your_name: input.your_name ?? '',
        your_company: input.your_company ?? 'ScaleMatic',
      }),
    },
    {
      stepIndex: 4,
      agentId: 'governance',
      taskType: 'review_outbound_message',
      description: 'Governance review of message variants before approval queue',
      requiresApproval: false,
      inputMapper: (_input, prev) => ({
        content_to_review: prev[3],
        review_type: 'outbound_message',
        channel: _input.preferred_channel ?? 'linkedin',
      }),
    },
  ],
};
