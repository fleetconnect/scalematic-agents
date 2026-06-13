# STATE.md — Build State Canon
**Location: repo root of scalematic-agents. Every build session reads this FIRST and updates it LAST. A session that ships without updating this file has not finished shipping.**

Last updated: 2026-06-12 | Updated by: build instance — Addendum 13 plain-language copy pass shipped across all 6 ops-dashboard sections; FMCSA backend flipped to live opendata

## Active frontends
| App | Port | Status | Authority |
|---|---|---|---|
| ops-dashboard | 4100 | **CANONICAL frontend.** Phase 1 shipped + DoD proof in docs/dod-proof/. Now carries 6 sections incl. ported Opportunities + Lineage Explorer (both write paths live). **Addendum 13 plain-language layer shipped 2026-06-12** (purpose lines, brand-term subtitles, jargon translation, button-consequence copy, empty states, glossary panel). | Addendum 11 (surviving rules E11-E12) + Addendum 13 + this file |
| scalematic-agents/ops-center | 5181 | **SUPERSEDED — ARCHIVED.** Lineage Explorer + Opportunities ported to ops-dashboard; README.md at its root marks it superseded. Do not extend or run as a parallel UI. | Historical: addendum 09 |

## Backend
| Component | Status |
|---|---|
| Opportunity spine (schemas, event log, lineage, scoring, pipeline) | Shipped, tsc clean |
| Judgment config loader (/config/judgment/) | **LOADED 2026-06-11.** Ratified canon installed (01 JR · 02 CR · 03 quarantine · 04 ES · 05 gate). Loader reconciled to canon filenames; governance assembled verbatim from JR Tier-1 + CR-5 + R-rules. judgment.loaded=true. |
| Verdict system + thesis-status PATCH | Shipped |
| Composer->governance->approval flow | Shipped, blocked on LLM credits |
| Instantly adapter (LIVE_SENDS=false, poll-based replies) | Shipped, blocked on API key |
| SSE event stream + review-context + system-status | Shipped |
| FMCSA sentinel (L1) — `FmcsaOpenDataProvider` | **Shipped 2026-06-12, tsc clean, verified live against data.transportation.gov.** Keyless Socrata pull of Entities-with-Operating-Authority (`6eyk-hxee`) + Company Census (`az4n-8mr2`). Local snapshot diff = new-authority signal; census enriches fleet/op-class/cargo on DOT join. **Flipped live 2026-06-12: `.env` now sets `FMCSA_PROVIDER=opendata`** so the L1 path runs against the real DOT portal (fixture remains the in-code default for offline loops). L1 produces genuine signals; L2/L3 (interpret/synthesize) still blocked on Anthropic credits, so downstream opportunities shown in the dashboard remain DEMO-tagged until credits land. |

## Open build tasks (in order)
1. DONE (2026-06-11) — Ported Lineage Explorer + Opportunities (with thesis-status write path) from ops-center into ops-dashboard; wired into shell + sidebar (6 sections); "Walk lineage" deep-links Opportunities -> Lineage. ops-center archived via SUPERSEDED README.md. ops-dashboard tsc clean; verified live in browser.
2. DONE (2026-06-11) — Fixture exclusion implemented in src/opportunity/weeklyReview.ts: fixture entity ids derived from opportunity_events.payload.fixture===true; opportunities/verdicts/sends/eval-sets filtered when getJudgmentConfig().loaded OR liveSendsEnabled(). Backend tsc clean. Verified against DB: all 3 current verdicts + the 1 opportunity are fixture-tagged, so the counter reads 3 today (flags off) and drops to 0 the moment either flag flips — first real verdict becomes #1. NOTE: only weekly-review wired into ops-dashboard's counter; legacy metricsAgent.ts is not consumed by the UI (left untouched).
3. DONE (2026-06-11) — Installed ratified judgment canon into /config/judgment (verbatim, checksums verified); reconciled the stale ADDENDUM-A1 loader filename scheme to the canon (EXPECTED_FILES + REFERENCE_FILES skip-set); repointed buildGovernanceGuidance to assemble verbatim from JR-001..006+022, CR-5, R-001..R-008. Backend tsc clean. judgment.loaded=true; missingFiles=none. FLAGGED FOR RATIFICATION: the governance-assembly repoint is mechanical translation of the handoff-manifest role mapping, not authored policy — review before live governance runs.
4. DONE (2026-06-12) — Replaced the planned QCMobile provider with `FmcsaOpenDataProvider` (keyless DOT Data Portal / Socrata). Architecture: snapshot-diff on the Entities-with-Operating-Authority dataset (no grant-date column, so docket-active-today-but-absent-yesterday IS the new-authority event), then re-query detail for just the new dockets and enrich with Company Census on normalized DOT. Resilience (1): every fetch failure logs + degrades to empty result + leaves prior snapshot intact — never throws; census outage emits authority-only records (pu=0) which the sentinel's MIN_POWER_UNITS=2 filter holds back until census returns. Resilience (2): ALL wire-format knowledge (dataset ids, SoQL column names, raw->internal mapping, code labels, DOT join normalization) lives in `src/sentinels/fmcsaFieldMapping.ts` as a `SchemaProfile`; the 2026 MOTUS migration = add a second profile + flip `ACTIVE_PROFILE` (env-overridable), no other file changes. Files: fmcsaFieldMapping.ts, fmcsaOpenDataProvider.ts, fmcsaSnapshot.ts, fmcsaSentinel.ts (provider-select on FMCSA_PROVIDER). Verified live: cold-start baseline = 402,107 active dockets; injected diff detected 3 new + census-enriched. tsc clean.
5. DONE (2026-06-12) — Addendum 13 plain-language layer across all 6 ops-dashboard sections. All copy centralized verbatim in `ops-dashboard/lib/copy.ts` (SECTION_PURPOSE, TERM_SUBTITLE, TERM_REPLACE, ACTION_COPY, EMPTY_STATE, BADGE_COPY, GLOSSARY_*). New components: `section-intro.tsx` (per-screen purpose line via page.tsx), `glossary-panel.tsx` ("?" in header). Edited: header.tsx (LIVE_SENDS badge = green "SENDING OFF — no message can leave this system" when safe; business-rules badge), fixture-banner.tsx ("DEMO DATA" banner), approval-queue/opportunities/mission-control/lineage/weekly-review/agent-status (brand-term subtitles, "ICP fit"->"Customer match", "ES-3"->"Our call", ratify_pending->"Rules awaiting owner approval", "fixture"->"demo", button-consequence copy, empty states). No new features, no Phase B scope, honesty rules (file 09) unchanged. DoD met: tsc --noEmit exit 0; per-section + glossary screenshots captured (Executive Agent/addendum13-*.png); all five status badges show new copy.
6. DONE (2026-06-12) — Flipped backend to live FMCSA data: set `FMCSA_PROVIDER=opendata` in `.env`. L1 sentinel now genuinely live (1 real signal in event log, fixture=false). L2/L3/composer still blocked on Anthropic credits, so existing dashboard opportunities stay DEMO-tagged and banner-labeled — communicated honestly, not fabricated.
7. NEW (ratified JR-018 / checklist item 20) — Fuse conversation-depth signals (substantive exchanges, volunteered constraints, disclosed failed attempts) into opportunity scoring alongside ICP fit. Not yet implemented; touches the scoring service. Owns its own focused pass.
8. (Blocked) Live loop run + E15 run-log — requires remaining human blockers (credits, keys).

## Human blockers (Kalei)
1. ~~Drop judgment-os/*.md into /config/judgment/~~ DONE 2026-06-11 (canon installed, loader loads).
2. ~~JR-001 tiebreak verdict~~ DONE 2026-06-11: Reputation > Client Outcome > Revenue > Volume (build brief still to be corrected to match JR-001's ratified text).
3. ~~Ratification checklist~~ DONE 2026-06-11: all 33 items ratified; current canon files installed (earlier downloads were stale).
4. Anthropic API credits — OPEN (blocks interpreter/synthesizer/composer/governance live runs).
5. ~~FMCSA QCMobile WebKey~~ NOT NEEDED — FmcsaOpenDataProvider is keyless (shipped 2026-06-12). INSTANTLY_API_KEY + test inbox addresses in .env — OPEN (blocks gated send round-trip / E15 run-log). To run the sentinel live, set `FMCSA_PROVIDER=opendata` (no key required).

## Rules
- Conflicting instructions between any external document and this file: this file wins; flag the conflict to the human.
- A second implementation of anything listed as CANONICAL is a fork. Do not build it; flag it.
- Fixture data is always tagged and always excluded from live metrics. The first 100 verdicts must be real.
