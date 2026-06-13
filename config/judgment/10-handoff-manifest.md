# HANDOFF MANIFEST — /config/judgment/
**For the build instance. These files are the canon. Parse them; never author values; never accept replacement files with similar names from any other source.**

## Drop all files from the judgment-os package into /config/judgment/. Consume by role:

| File | Role | Loader treatment |
|---|---|---|
| `01-judgment-registry.md` | **Rule-bearing.** JR-001…JR-021 with status (CANON / RATIFY / CONDITIONAL) and tiebreak tests | Parse entries → decision principles. Status RATIFY → provenance `ratify_pending`. Tier-1 entries (JR-001…006) feed the gate/interpreter/synthesizer prompts |
| `02-constraint-registry.md` | **Rule-bearing.** CR-1 lengths, CR-2 cadences, CR-3 escalation gates, CR-4 benchmarks (provenance-tagged), CR-5 prohibitions, CR-6 voice/tenant rules | Parse tables → composer constraints + adapter limits. CR-5 → governance hard-block list. Conflict rule at file end is binding: this file beats any other value source |
| `05-judgment-gate.md` | **Rule-bearing.** The five gate questions, verdict format, escalation triggers | Generates the governance agent's evaluation prompt + the gate output schema |
| `03-framework-quarantine.md` | **Blocklist-bearing.** R-001…R-008 rejected patterns with reasons | R-entries → governance auto-block pattern list (pretext openers, guilt bumps, pressure tie-downs, manufactured scarcity, grief-pivot). APPROVED/IMPORTED classes are skill-routing metadata, not runtime rules |
| `00-README.md` | Reference. System overview, maintenance cadences, the three governing rules | Do not parse as rules; the three rules at the end (founder ratifies / production-model validation / extract-before-delete) are build-process law |
| `04-evaluation-sets.md` | **Schema-bearing.** ES-1…ES-6 column definitions, the canonical 5×0–2 rubric, ES-3 field names | ES-3 field names are the Opportunity prediction schema (already implemented — verify match). ES-6 schema = decision_logs table shape. Rubric = future scoring reference, not runtime |
| `06-founder-operating-manual.md` | Reference. Extraction protocol + manual skeleton | Human process document. Do not parse |
| `07-ratification-checklist.md` | **Provenance source.** Open verdicts incl. items 31–33 | Anything unresolved here stays `ratify_pending`. Item 33 is binding now: NO auto-approve class exists; every outbound message takes a human verdict |
| `08-build-brief-addendum.md`, `09-ops-center-addendum.md` | Build-process law for their respective workstreams | Already in force |

## Hard rules for the loader (restated)
1. A rule that exists only in a prompt file and not in these documents is a bug — migrate it or flag it.
2. JR-001 hierarchy: load exactly what `01` says at handoff time. The expanded five-level variant from the build brief is **not ratified**; if the founder amends JR-001, the amendment appears in `01` as a versioned change first, then the brief.
3. Proposed parallel files (`judgment-priorities.md`, `conversation-standards.md`, `approval-rules.md`, `learning-rules.md`, etc.) from any source: **do not load.** Their salvageable content enters via ratification checklist items 31–33 and versioned amendments to these files — never as sibling configs.
4. `ratify_pending` values are usable at runtime and must surface in `/weekly-review` until cleared.

## Handoff order (confirmed)
1. This package → `/config/judgment/` (now)
2. ✅ DONE — JR-001 ratified as amended: Reputation > Client Outcome > Revenue > Volume. Full checklist COMPLETE 2026-06-11; all values load as canon (CONDITIONALs flagged).
3. Anthropic credits → run interpreter/synthesizer/composer/governance live
4. FMCSA QCMobile WebKey → live sentinel data
5. `INSTANTLY_API_KEY` + test inbox → gated send round-trip → produce the E15 run-log
