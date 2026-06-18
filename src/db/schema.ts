export const CREATE_TABLES = `
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  input TEXT NOT NULL,
  assigned_agent TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  priority INTEGER NOT NULL DEFAULT 5,
  output TEXT,
  workflow_run_id TEXT,
  workflow_step INTEGER,
  error TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER
);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  input TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  current_step INTEGER NOT NULL DEFAULT 0,
  step_outputs TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  completed_at TEXT,
  error TEXT
);

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  workflow_run_id TEXT,
  agent_id TEXT NOT NULL,
  output TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by TEXT,
  comments TEXT,
  created_at TEXT NOT NULL,
  reviewed_at TEXT
);

CREATE TABLE IF NOT EXISTS memory_documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  source TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cron_state (
  id TEXT PRIMARY KEY,
  last_run_at TEXT NOT NULL,
  processed_contact_ids TEXT NOT NULL DEFAULT '[]',
  processed_opportunity_ids TEXT NOT NULL DEFAULT '[]',
  processed_conversation_ids TEXT NOT NULL DEFAULT '[]',
  processed_calendar_event_ids TEXT NOT NULL DEFAULT '[]',
  processed_transcript_ids TEXT NOT NULL DEFAULT '[]',
  pending_approval_ids TEXT NOT NULL DEFAULT '[]',
  previous_daily_summary TEXT NOT NULL DEFAULT '',
  next_run_focus TEXT NOT NULL DEFAULT '',
  skipped_items TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS opportunity_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  entity_ref TEXT,
  subject_id TEXT NOT NULL,
  parent_ids TEXT NOT NULL DEFAULT '[]',
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS signals (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  entity_refs TEXT NOT NULL DEFAULT '[]',
  raw_evidence TEXT NOT NULL,
  evidence_url TEXT,
  detected_at TEXT NOT NULL,
  freshness_halflife_days INTEGER NOT NULL,
  confidence REAL NOT NULL,
  first_party INTEGER NOT NULL DEFAULT 0,
  score REAL,
  metadata TEXT,
  dedup_key TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS interpretations (
  id TEXT PRIMARY KEY,
  signal_ids TEXT NOT NULL DEFAULT '[]',
  entity_ref TEXT NOT NULL,
  data TEXT NOT NULL,
  confidence REAL NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS opportunities (
  id TEXT PRIMARY KEY,
  entity_ref TEXT NOT NULL,
  interpretation_ids TEXT NOT NULL DEFAULT '[]',
  signal_ids TEXT NOT NULL DEFAULT '[]',
  data TEXT NOT NULL,
  play TEXT NOT NULL,
  icp_fit REAL NOT NULL,
  priority_score REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'minted',
  thesis_status TEXT NOT NULL DEFAULT 'untested',
  prediction TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS outcomes (
  id TEXT PRIMARY KEY,
  opportunity_id TEXT NOT NULL,
  outcome_type TEXT NOT NULL,
  cause TEXT,
  thesis_confirmed INTEGER,
  created_at TEXT NOT NULL
);

-- Human verdict on a governed draft (Phase 3). EDITED stores before/after/diff.
CREATE TABLE IF NOT EXISTS verdicts (
  id TEXT PRIMARY KEY,
  approval_id TEXT NOT NULL,
  opportunity_id TEXT,
  verdict TEXT NOT NULL,
  reason TEXT,
  before_text TEXT,
  after_text TEXT,
  diff TEXT,
  decided_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Outbound sends + reply capture (Phase 6). A send may exist ONLY for an APPROVED/EDITED verdict.
CREATE TABLE IF NOT EXISTS sends (
  id TEXT PRIMARY KEY,
  approval_id TEXT NOT NULL,
  verdict_id TEXT NOT NULL,
  opportunity_id TEXT,
  channel TEXT NOT NULL,
  to_address TEXT NOT NULL,
  routed_to_test_inbox INTEGER NOT NULL DEFAULT 1,
  provider TEXT NOT NULL,
  provider_message_id TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  reply_body TEXT,
  replied_at TEXT,
  created_at TEXT NOT NULL
);

-- Learning layer (Phase 7).
CREATE TABLE IF NOT EXISTS evaluation_sets (
  id TEXT PRIMARY KEY,
  set_name TEXT NOT NULL,
  opportunity_id TEXT,
  prediction TEXT,
  predicted_thesis TEXT,
  confidence REAL,
  actual_outcome TEXT,
  scored INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS decision_logs (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  decision_type TEXT NOT NULL,
  decision TEXT NOT NULL,
  rationale TEXT,
  rules_applied TEXT NOT NULL DEFAULT '[]',
  provenance TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS outcome_labels (
  id TEXT PRIMARY KEY,
  opportunity_id TEXT NOT NULL,
  label TEXT NOT NULL,
  thesis_status TEXT,
  notes TEXT,
  labeled_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Governed Plane-B (vault) write audit (Phase 2A). One row per fileApprovedConversation
-- attempt, including rejected/failed. Stores fingerprint + title + relative path, never the body.
CREATE TABLE IF NOT EXISTS conversation_filings (
  id TEXT PRIMARY KEY,
  command TEXT NOT NULL,
  approval_reference TEXT NOT NULL,
  idempotency_key TEXT,
  content_fingerprint TEXT NOT NULL,
  proposed_title TEXT NOT NULL,
  final_relative_path TEXT,
  duplicate_result TEXT NOT NULL,
  verification TEXT NOT NULL,
  outcome TEXT NOT NULL,
  error TEXT,
  created_at TEXT NOT NULL
);

-- Read-first integration audit (Phase 1+). One row per external connector access. Stores source
-- ids and freshness, never tokens or full sensitive content. approval_reference is set only for
-- future approved writes (Phase 1 is read-only, so it stays null).
CREATE TABLE IF NOT EXISTS integration_access_log (
  id TEXT PRIMARY KEY,
  connector_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  source_ids TEXT NOT NULL DEFAULT '[]',
  result TEXT NOT NULL,
  error TEXT,
  data_freshness TEXT,
  approval_reference TEXT,
  created_at TEXT NOT NULL
);

-- Last sync state per connector (last successful / attempted sync, freshness, last error).
CREATE TABLE IF NOT EXISTS integration_sync_state (
  connector_id TEXT PRIMARY KEY,
  last_successful_sync TEXT,
  last_attempted_sync TEXT,
  last_freshness TEXT,
  last_error TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_agent ON tasks(assigned_agent);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
CREATE INDEX IF NOT EXISTS idx_memory_category ON memory_documents(category);
CREATE INDEX IF NOT EXISTS idx_events_subject ON opportunity_events(subject_id);
CREATE INDEX IF NOT EXISTS idx_events_entity ON opportunity_events(entity_ref);
CREATE INDEX IF NOT EXISTS idx_signals_dedup ON signals(dedup_key);
CREATE INDEX IF NOT EXISTS idx_opps_status ON opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opps_priority ON opportunities(priority_score);
CREATE INDEX IF NOT EXISTS idx_verdicts_approval ON verdicts(approval_id);
CREATE INDEX IF NOT EXISTS idx_verdicts_opp ON verdicts(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_sends_approval ON sends(approval_id);
CREATE INDEX IF NOT EXISTS idx_sends_opp ON sends(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_sends_status ON sends(status);
CREATE INDEX IF NOT EXISTS idx_evalsets_opp ON evaluation_sets(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_declogs_subject ON decision_logs(subject_id);
CREATE INDEX IF NOT EXISTS idx_outlabels_opp ON outcome_labels(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_intlog_connector ON integration_access_log(connector_id);
CREATE INDEX IF NOT EXISTS idx_filings_idem ON conversation_filings(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_filings_fp ON conversation_filings(content_fingerprint);
`;
