import { WorkflowDefinition } from '../types/workflow';

export const postCallFollowUpWorkflow: WorkflowDefinition = {
  id: 'post-call-follow-up',
  name: 'Post-Call Follow-Up',
  description: 'After a call: summarizes, drafts follow-up email, creates proposal outline, updates CRM, runs governance review.',
  trigger: 'manual | call_recording',
  steps: [
    {
      stepIndex: 0,
      agentId: 'sales',
      taskType: 'summarize_call',
      description: 'Summarize call: goals, pain, objections, next steps, fit score',
      requiresApproval: false,
      inputMapper: (input) => ({
        transcript: input.transcript ?? '',
        notes: input.notes ?? '',
        contact_name: input.contact_name ?? '',
        company: input.company ?? '',
      }),
    },
    {
      stepIndex: 1,
      agentId: 'strategy',
      taskType: 'identify_post_call_opportunities',
      description: 'Identify offer fit, urgency, and buying triggers from the call',
      requiresApproval: false,
      inputMapper: (input, prev) => ({
        transcript: input.transcript ?? '',
        call_summary: prev[0],
        contact_name: input.contact_name ?? '',
        company: input.company ?? '',
      }),
    },
    {
      stepIndex: 2,
      agentId: 'messaging',
      taskType: 'draft_follow_up_email',
      description: 'Draft a personalised follow-up email based on call summary',
      requiresApproval: true,
      inputMapper: (input, prev) => ({
        call_summary: prev[0],
        strategy: prev[1],
        contact_name: input.contact_name ?? '',
        company: input.company ?? '',
        your_name: input.your_name ?? '',
        next_steps: (prev[0] as Record<string, unknown>)?.call_summary ?? '',
      }),
    },
    {
      stepIndex: 3,
      agentId: 'ops',
      taskType: 'create_post_call_tasks',
      description: 'Generate implementation plan, internal tasks, and SOP opportunities',
      requiresApproval: false,
      inputMapper: (input, prev) => ({
        call_summary: prev[0],
        strategy: prev[1],
        contact_name: input.contact_name ?? '',
        company: input.company ?? '',
      }),
    },
    {
      stepIndex: 4,
      agentId: 'crm',
      taskType: 'update_crm_post_call',
      description: 'Recommend CRM stage change, tags, and follow-up tasks',
      requiresApproval: false,
      inputMapper: (input, prev) => ({
        call_summary: prev[0],
        strategy: prev[1],
        contact_name: input.contact_name ?? '',
        company: input.company ?? '',
        crm_contact_id: input.crm_contact_id ?? '',
      }),
    },
    {
      stepIndex: 5,
      agentId: 'governance',
      taskType: 'review_post_call_outputs',
      description: 'Review follow-up email and proposal for brand safety',
      requiresApproval: false,
      inputMapper: (_input, prev) => ({
        content_to_review: prev[2],
        review_type: 'follow_up_email',
      }),
    },
  ],
};
