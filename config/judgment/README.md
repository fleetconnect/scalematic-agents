# /config/judgment — Source of Truth (INSTALLED 2026-06-11)

This directory is the parsed source of truth for the Commercial Opportunity OS judgment layer.
The ratified canon was dropped in on 2026-06-11 (ratification checklist COMPLETE, all 33 items).
For the system overview and the three governing rules, read `00-README.md`.

Per the Week 1 ADDENDUM (Section A), the code MUST NOT author any judgment, constraint,
prohibition, or tiebreak value. Those values come ONLY from the canon `.md` files copied here
verbatim. The loader at `src/config/judgmentConfig.ts` parses the rule-bearing markdown present
in this directory at boot.

## STATUS: canon installed; loader parses live

Rule-bearing files the loader parses (`EXPECTED_FILES`):

- 01-judgment-registry.md     (JR-001..JR-022; JR-001 = Reputation > Client Outcome > Revenue > Volume)
- 02-constraint-registry.md   (CR-1 length, CR-2 follow-up, CR-4 benchmarks, CR-5 prohibitions, CR-6 voice)
- 03-framework-quarantine.md  (Q-001..Q-004 dispositions, R-001..R-008 rejected patterns)
- 04-evaluation-sets.md       (ES-1..ES-6; ES-3 = Opportunity prediction schema)
- 05-judgment-gate.md         (the five gate questions + gate output format)

Reference / build-process docs present but NOT parsed as rules (loader `REFERENCE_FILES`):
`00-README.md`, `06-founder-operating-manual.md`, `08-build-brief-addendum.md`, `10-handoff-manifest.md`.

> Note: the earlier ADDENDUM-A1 filename scheme (`02-governance-registry.md`, `03-tiebreak-registry.md`,
> `05-commercial-reasoning.md`, `06-tacit-policy.md`, `07-constraint-rules.md`) was a speculative
> layout the ratified package did not follow. The loader was reconciled to the canon filenames
> above on 2026-06-11; the values themselves are unchanged and unedited.

## Provenance

Each parsed rule carries a provenance: `canon | ratify_pending | prior | imported`.
Rules whose source block contains `RATIFY` load as `ratify_pending` — usable, but the
`/weekly-review` endpoint lists every `ratify_pending` value still in active use (ADDENDUM A2).
As of 2026-06-11 the canon is ratified, so values load as `canon` (CONDITIONALs flagged in-text;
`prior`/`imported` benchmarks await measurement per CR-4).

## Governance assembly

`buildGovernanceGuidance()` assembles the governance agent's guidance verbatim from the canon:
JR Tier-1 tiebreaks (01), CR-5 prohibitions (02), and R-001..R-008 auto-block patterns (03).
It never authors values; absent/unparsed source throws (fail loud).
