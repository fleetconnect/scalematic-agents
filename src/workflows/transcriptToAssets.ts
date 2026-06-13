import { WorkflowDefinition } from '../types/workflow';

export const transcriptToAssetsWorkflow: WorkflowDefinition = {
  id: 'transcript-to-assets',
  name: 'Transcript to Assets',
  description: 'Turns a call transcript or notes into strategy, content, sales assets, ops tasks, and governance-reviewed messaging.',
  trigger: 'manual | call_recording',
  steps: [
    {
      stepIndex: 0,
      agentId: 'strategy',
      taskType: 'extract_strategy_from_transcript',
      description: 'Extract core thesis, pain points, objections, and buying triggers',
      requiresApproval: false,
      inputMapper: (input) => ({
        transcript: input.transcript,
        call_type: input.call_type ?? 'sales_call',
        context: input.context ?? '',
      }),
    },
    {
      stepIndex: 1,
      agentId: 'content',
      taskType: 'generate_content_from_transcript',
      description: 'Generate LinkedIn posts, newsletter angles, and short-form scripts',
      requiresApproval: true,
      inputMapper: (input, prev) => ({
        transcript: input.transcript,
        strategy: prev[0],
        content_goals: input.content_goals ?? ['linkedin_posts', 'newsletter_angles'],
      }),
    },
    {
      stepIndex: 2,
      agentId: 'sales',
      taskType: 'create_sales_assets_from_transcript',
      description: 'Create call summary, follow-up email, and proposal outline',
      requiresApproval: false,
      inputMapper: (input, prev) => ({
        transcript: input.transcript,
        strategy: prev[0],
        contact_name: input.contact_name ?? '',
        company: input.company ?? '',
      }),
    },
    {
      stepIndex: 3,
      agentId: 'ops',
      taskType: 'extract_ops_from_transcript',
      description: 'Extract tasks, SOP opportunities, and workflow ideas',
      requiresApproval: false,
      inputMapper: (input, prev) => ({
        transcript: input.transcript,
        strategy: prev[0],
        sales_assets: prev[2],
      }),
    },
    {
      stepIndex: 4,
      agentId: 'governance',
      taskType: 'review_transcript_outputs',
      description: 'Review all outputs for brand safety before delivery',
      requiresApproval: false,
      inputMapper: (_input, prev) => ({
        content_to_review: prev[1],
        sales_assets: prev[2],
        review_type: 'transcript_outputs',
      }),
    },
  ],
};
