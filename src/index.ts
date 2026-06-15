import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { router } from './api/routes';
import { registerWorkflow } from './orchestrator/workflowRunner';
import { transcriptToAssetsWorkflow } from './workflows/transcriptToAssets';
import { newLeadWorkflow } from './workflows/newLeadWorkflow';
import { preCallBriefWorkflow } from './workflows/preCallBrief';
import { postCallFollowUpWorkflow } from './workflows/postCallFollowUp';
import { stalledLeadRevivalWorkflow } from './workflows/stalledLeadRevival';
import { contentIdeationWorkflow } from './workflows/contentIdeation';
import { loadBrainDocuments } from './memory/documentLoader';
import { loadJudgmentConfig } from './config/judgmentConfig';
import { startReplyPolling } from './integrations/instantly';
import { logger } from './utils/logger';

const PORT = parseInt(process.env.PORT ?? '3100', 10);

// ── Register all workflows ─────────────────────────────────────────
[
  transcriptToAssetsWorkflow,
  newLeadWorkflow,
  preCallBriefWorkflow,
  postCallFollowUpWorkflow,
  stalledLeadRevivalWorkflow,
  contentIdeationWorkflow,
].forEach(registerWorkflow);

// ── Load brain documents ───────────────────────────────────────────
const loaded = loadBrainDocuments();
logger.info(`ScaleMatic Brain: ${loaded} documents loaded`);

// ── Load judgment config from /config/judgment (source of truth) ───
const judgment = loadJudgmentConfig();
logger.info(
  `Judgment OS: ${judgment.rules.length} rules from ${judgment.presentFiles.length} file(s)` +
    (judgment.missingFiles.length ? ` (missing: ${judgment.missingFiles.length})` : '')
);

// ── Express server ─────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGIN ?? 'http://localhost:4100')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const app = express();
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '10mb' }));
app.use('/api', router);

app.listen(PORT, () => {
  startReplyPolling();
  logger.info(`ScaleMatic Agent System running on http://localhost:${PORT}`);
  logger.info(`API docs: http://localhost:${PORT}/api/health`);
  logger.info('');
  logger.info('Agents: strategy, research, messaging, content, sales, crm, ops, metrics, governance');
  logger.info('Workflows: transcript-to-assets, new-lead, pre-call-brief, post-call-follow-up, stalled-lead-revival, content-ideation');
});
