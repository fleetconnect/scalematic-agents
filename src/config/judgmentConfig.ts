import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

// The judgment OS lives in source-of-truth markdown. This loader PARSES those files
// into typed config. It never authors values: if a required value is absent, code that
// asks for it throws (fail loud), and the weekly review surfaces what is still RATIFY.

export const JUDGMENT_DIR = path.join(__dirname, '../../config/judgment');

export type Provenance = 'canon' | 'ratify_pending' | 'prior' | 'imported';

// The ratified canon (handoff manifest, file 10) — the rule-bearing files the loader parses
// into config. Missing files are reported, not invented. The earlier ADDENDUM-A1 names
// (02-governance-registry / 03-tiebreak-registry / 05-commercial-reasoning / 06-tacit-policy /
// 07-constraint-rules) were a speculative scheme the ratified package did not follow:
// constraints consolidated into 02, the tiebreak hierarchy is JR-001 inside 01, governance
// hard-blocks come from CR-5 (02) + R-rules (03) + the gate (05).
export const EXPECTED_FILES = [
  '01-judgment-registry.md',
  '02-constraint-registry.md',
  '03-framework-quarantine.md',
  '04-evaluation-sets.md',
  '05-judgment-gate.md',
];

// Reference and build-process docs ship in the same package but carry no parseable rules;
// the manifest marks them "do not parse." Excluded from the rule parse, kept in the dir.
const REFERENCE_FILES = new Set([
  'readme.md',
  '00-readme.md',
  '06-founder-operating-manual.md',
  '08-build-brief-addendum.md',
  '10-handoff-manifest.md',
]);

export interface JudgmentRule {
  id: string; // e.g. JR-001, CR-1, Q-004
  sourceFile: string;
  provenance: Provenance;
  text: string;
}

export interface JudgmentConfig {
  loaded: boolean;
  presentFiles: string[];
  missingFiles: string[];
  rules: JudgmentRule[];
  rulesById: Record<string, JudgmentRule>;
}

const RULE_ID_RE = /^\s*#*\s*((?:JR|CR|Q|R|ES|TB)-?\d+[A-Za-z]?)\b/;

function detectProvenance(block: string): Provenance {
  const upper = block.toUpperCase();
  if (/PROVENANCE:\s*RATIFY_PENDING/.test(upper) || /\bRATIFY\b/.test(upper)) return 'ratify_pending';
  if (/PROVENANCE:\s*PRIOR/.test(upper) || /\bPRIOR\b/.test(upper)) return 'prior';
  if (/PROVENANCE:\s*IMPORTED/.test(upper) || /\bIMPORTED\b/.test(upper)) return 'imported';
  return 'canon';
}

function parseFile(file: string, content: string): JudgmentRule[] {
  const lines = content.split('\n');
  const rules: JudgmentRule[] = [];
  let currentId: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (currentId) {
      const text = buffer.join('\n').trim();
      rules.push({ id: currentId, sourceFile: file, provenance: detectProvenance(text), text });
    }
    buffer = [];
  };

  for (const line of lines) {
    const m = line.match(RULE_ID_RE);
    if (m) {
      flush();
      currentId = m[1].toUpperCase();
    }
    if (currentId) buffer.push(line);
  }
  flush();
  return rules;
}

let _cache: JudgmentConfig | null = null;

export function loadJudgmentConfig(): JudgmentConfig {
  const presentFiles: string[] = [];
  const rules: JudgmentRule[] = [];

  if (fs.existsSync(JUDGMENT_DIR)) {
    const files = fs
      .readdirSync(JUDGMENT_DIR)
      .filter((f) => f.endsWith('.md') && !REFERENCE_FILES.has(f.toLowerCase()));
    for (const f of files) {
      presentFiles.push(f);
      const content = fs.readFileSync(path.join(JUDGMENT_DIR, f), 'utf-8');
      rules.push(...parseFile(f, content));
    }
  }

  const missingFiles = EXPECTED_FILES.filter((f) => !presentFiles.includes(f));
  const rulesById: Record<string, JudgmentRule> = {};
  for (const r of rules) rulesById[r.id] = r;

  _cache = {
    loaded: rules.length > 0,
    presentFiles,
    missingFiles,
    rules,
    rulesById,
  };

  if (!_cache.loaded) {
    logger.info(
      `Judgment config: NO source files parsed. Drop the seven judgment-os/*.md files into ${JUDGMENT_DIR}. Missing: ${missingFiles.join(', ')}`
    );
  } else {
    logger.info(
      `Judgment config: parsed ${rules.length} rules from ${presentFiles.length} file(s). Missing: ${missingFiles.join(', ') || 'none'}`
    );
  }
  return _cache;
}

export function getJudgmentConfig(): JudgmentConfig {
  return _cache ?? loadJudgmentConfig();
}

// Fail-loud accessor. Code that needs a specific rule value uses this; if the value is
// not present in the source files, it throws rather than inventing one (ADDENDUM A1).
export function requireRule(id: string): JudgmentRule {
  const cfg = getJudgmentConfig();
  const rule = cfg.rulesById[id.toUpperCase()];
  if (!rule) {
    throw new Error(
      `Judgment rule ${id} is required by the code but absent from /config/judgment. ` +
        `Provide it in the source markdown — values must not be inferred.`
    );
  }
  return rule;
}

// All ratify_pending rules still in active use — surfaced by the weekly review (ADDENDUM A2).
export function getRatifyPendingInUse(): JudgmentRule[] {
  return getJudgmentConfig().rules.filter((r) => r.provenance === 'ratify_pending');
}

export function rulesFromFile(fileName: string): JudgmentRule[] {
  return getJudgmentConfig().rules.filter((r) => r.sourceFile === fileName);
}

// Composer constraints are INJECTED from config (CR-1 length, CR-2 follow-up), never written
// into the prompt file. Absent values throw — the composer must not infer message rules.
export function buildComposerConstraints(): string {
  const cr1 = requireRule('CR-1');
  const cr2 = requireRule('CR-2');
  return [
    'MESSAGE CONSTRAINTS (from /config/judgment, do not violate):',
    cr1.text,
    cr2.text,
  ].join('\n\n');
}

// Governance guidance is ASSEMBLED VERBATIM from the ratified canon — never authored here.
// Per the handoff manifest's role mapping: JR Tier-1 (01) is the tiebreak hierarchy, CR-5 (02)
// is the prohibition set, and R-001..R-008 (03) are the auto-block patterns. Absent source
// throws rather than falling back to a prompt (fail loud, ADDENDUM A1).
const GOVERNANCE_TIER1_IDS = ['JR-001', 'JR-002', 'JR-003', 'JR-004', 'JR-005', 'JR-006', 'JR-022'];

export function buildGovernanceGuidance(): string {
  const cfg = getJudgmentConfig();
  const tier1 = GOVERNANCE_TIER1_IDS.map((id) => cfg.rulesById[id]).filter(Boolean);
  const cr5 = cfg.rulesById['CR-5'];
  const rejected = cfg.rules.filter((r) => /^R-\d+/.test(r.id));
  if (!tier1.length || !cr5 || !rejected.length) {
    throw new Error(
      'Governance guidance requires the judgment canon in /config/judgment: 01-judgment-registry.md ' +
        '(JR Tier-1 tiebreaks), 02-constraint-registry.md (CR-5 prohibitions), and ' +
        '03-framework-quarantine.md (R-rejected patterns). One or more are absent or unparsed — ' +
        'provide them; governance values must not be inferred.'
    );
  }
  return [
    'GOVERNANCE (assembled verbatim from /config/judgment):',
    '## Tier-1 objective function and tiebreaks',
    ...tier1.map((r) => `${r.id}: ${r.text}`),
    '## Prohibitions (hard constraints)',
    `${cr5.id}: ${cr5.text}`,
    '## Auto-block patterns (rejected frameworks — never produce these)',
    ...rejected.map((r) => `${r.id}: ${r.text}`),
  ].join('\n\n');
}
