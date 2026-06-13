import { runAgent } from '../orchestrator/agentRunner';
import { createApproval } from '../approvals/approvalQueue';
import { getOpportunity, updateOpportunityStatus } from './store';
import { getInterpretation } from './store';
import { emitEvent } from './eventLog';
import { buildComposerConstraints, buildGovernanceGuidance } from '../config/judgmentConfig';
import { Approval } from '../types/approval';
import { logger } from '../utils/logger';

export interface ComposeResult {
  approval: Approval;
  draft: string;
  governanceStatus: string;
}

interface MessageVariant {
  label?: string;
  channel?: string;
  subject?: string | null;
  body?: string;
}

// Opportunity -> Composer -> Draft -> Governance -> Approval Queue.
// Lineage (opportunity, interpretation, signal IDs) rides on the approval output so no
// message is ever an orphan. CR-1/CR-2 and governance rules come from /config/judgment.
export async function composeFromOpportunity(
  opportunityId: string,
  options: { channel?: 'email' | 'linkedin' } = {}
): Promise<ComposeResult> {
  const opp = getOpportunity(opportunityId);
  if (!opp) throw new Error(`Opportunity not found: ${opportunityId}`);

  const channel = options.channel ?? 'email';

  // Throws here if the judgment source files are absent (fail loud, ADDENDUM A1).
  const constraints = buildComposerConstraints();

  const interp = opp.interpretationIds.map(getInterpretation).find(Boolean) ?? null;

  const { output: composerOut } = await runAgent('messaging', 'compose_from_opportunity', {
    channel,
    entity_ref: opp.entityRef,
    why_now: opp.whyNow,
    why_us: opp.whyUs,
    why_this_person: opp.whyThisPerson,
    business_problem: opp.businessProblem,
    desired_outcome: opp.desiredOutcome,
    thesis: opp.thesis,
    play: opp.play,
    interpretation: interp,
    constraints,
  });

  const variants = (composerOut.variants as MessageVariant[] | undefined) ?? [];
  const recommendedIdx =
    typeof composerOut.recommended === 'number' ? composerOut.recommended : 0;
  const chosen = variants[recommendedIdx] ?? variants[0];
  if (!chosen?.body) throw new Error('Composer returned no usable message variant');

  emitEvent('message.drafted', opp.id, {
    entityRef: opp.entityRef,
    parentIds: [opp.id, ...opp.interpretationIds, ...opp.signalIds],
    payload: { channel, subject: chosen.subject ?? null },
  });

  const governanceGuidance = buildGovernanceGuidance();
  const { output: govOut } = await runAgent('governance', 'review_draft', {
    channel,
    draft: chosen.body,
    subject: chosen.subject ?? null,
    governance_guidance: governanceGuidance,
  });
  const governanceStatus = String(govOut.status ?? 'unknown');

  const finalBody =
    governanceStatus === 'needs_revision' && typeof govOut.revised_output === 'string'
      ? (govOut.revised_output as string)
      : chosen.body;

  const approval = createApproval('opportunity:' + opp.id, 'messaging', {
    message: finalBody,
    subject: chosen.subject ?? null,
    channel,
    entity_ref: opp.entityRef,
    opportunity_id: opp.id,
    interpretation_ids: opp.interpretationIds,
    signal_ids: opp.signalIds,
    governance: govOut,
  });

  emitEvent('message.submitted_for_approval', approval.id, {
    entityRef: opp.entityRef,
    parentIds: [opp.id, ...opp.interpretationIds, ...opp.signalIds],
    payload: { approval_id: approval.id, governance_status: governanceStatus, channel },
  });

  updateOpportunityStatus(opp.id, 'awaiting_approval');

  logger.info(`Composed draft for opportunity ${opp.id} -> approval ${approval.id}`);
  return { approval, draft: finalBody, governanceStatus };
}
