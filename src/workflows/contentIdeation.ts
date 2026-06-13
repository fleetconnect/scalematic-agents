import { WorkflowDefinition } from '../types/workflow';

export const contentIdeationWorkflow: WorkflowDefinition = {
  id: 'content-ideation',
  name: 'Content Ideation',
  description: 'Researches a content pillar, extracts angles and belief shifts, then drafts publish-ready content assets. Requires approval before output is delivered.',
  trigger: 'manual',
  steps: [
    {
      stepIndex: 0,
      agentId: 'research',
      taskType: 'research_content_pillar',
      description: 'Synthesize what is known about this pillar — audience pain points, competing framings, hooks that work, and gaps in the market',
      requiresApproval: false,
      inputMapper: (input) => ({
        pillar: input.pillar,
        audience: input.audience ?? 'coaches, consultants, and service-based founders at $10k–$100k/yr',
        goal: input.goal ?? 'generate qualified inbound leads through organic content',
        context: input.context ?? '',
        research_focus: [
          'What specific pain does this pillar address?',
          'What does the audience already believe about this topic?',
          'What belief needs to shift for them to take action?',
          'What are the most credible angles to approach this from?',
          'What makes ScaleMatic\'s take on this different from the generic advice?',
        ],
      }),
    },
    {
      stepIndex: 1,
      agentId: 'strategy',
      taskType: 'extract_content_angles',
      description: 'Extract content angles, positioning opportunities, belief shifts, and hooks from the research',
      requiresApproval: false,
      inputMapper: (input, prev) => ({
        pillar: input.pillar,
        audience: input.audience ?? 'coaches, consultants, and service-based founders at $10k–$100k/yr',
        goal: input.goal ?? 'generate qualified inbound leads through organic content',
        research: prev[0],
        formats: input.formats ?? ['linkedin_posts', 'short_form_scripts', 'newsletter_angles'],
        quantity: input.quantity ?? 5,
      }),
    },
    {
      stepIndex: 2,
      agentId: 'content',
      taskType: 'draft_content_from_angles',
      description: 'Draft content assets from the strategy angles — ready for review and publishing',
      requiresApproval: true,
      inputMapper: (input, prev) => ({
        pillar: input.pillar,
        audience: input.audience ?? 'coaches, consultants, and service-based founders at $10k–$100k/yr',
        goal: input.goal ?? 'generate qualified inbound leads through organic content',
        research: prev[0],
        strategy: prev[1],
        formats: input.formats ?? ['linkedin_posts', 'short_form_scripts', 'newsletter_angles'],
        quantity: input.quantity ?? 5,
        tone_notes: input.tone_notes ?? 'sharp, direct, founder-led — no hype, no generic advice',
      }),
    },
  ],
};
