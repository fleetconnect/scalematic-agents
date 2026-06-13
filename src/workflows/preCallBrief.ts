import { WorkflowDefinition } from '../types/workflow';

export const preCallBriefWorkflow: WorkflowDefinition = {
  id: 'pre-call-brief',
  name: 'Pre-Call Brief',
  description: 'Fires before an upcoming call. Pulls CRM context, researches prospect, generates a full call prep brief.',
  trigger: 'calendar_event | manual',
  steps: [
    {
      stepIndex: 0,
      agentId: 'crm',
      taskType: 'pull_contact_context',
      description: 'Pull contact notes, lead source, stage, and past touchpoints from CRM',
      requiresApproval: false,
      inputMapper: (input) => ({
        contact_name: input.contact_name ?? '',
        company: input.company ?? '',
        crm_contact_id: input.crm_contact_id ?? '',
        call_time: input.call_time ?? '',
      }),
    },
    {
      stepIndex: 1,
      agentId: 'research',
      taskType: 'research_pre_call',
      description: 'Research company, LinkedIn context, and website for call preparation',
      requiresApproval: false,
      inputMapper: (input, prev) => ({
        contact_name: input.contact_name ?? '',
        company: input.company ?? '',
        linkedin_url: input.linkedin_url ?? '',
        crm_context: prev[0],
        role: input.role ?? '',
      }),
    },
    {
      stepIndex: 2,
      agentId: 'sales',
      taskType: 'create_call_prep_brief',
      description: 'Generate call prep brief with questions, pain points, and offer angle',
      requiresApproval: false,
      inputMapper: (input, prev) => ({
        contact_name: input.contact_name ?? '',
        company: input.company ?? '',
        crm_context: prev[0],
        research: prev[1],
        call_type: input.call_type ?? 'discovery',
        offer: input.offer ?? 'AI-powered outbound sales automation',
      }),
    },
    {
      stepIndex: 3,
      agentId: 'strategy',
      taskType: 'add_positioning_to_brief',
      description: 'Add recommended positioning and decision-maker psychology',
      requiresApproval: false,
      inputMapper: (input, prev) => ({
        contact_name: input.contact_name ?? '',
        company: input.company ?? '',
        research: prev[1],
        call_brief: prev[2],
        offer: input.offer ?? 'AI-powered outbound sales automation',
      }),
    },
  ],
};
