# ADDENDUM — PASTE ABOVE THE WEEK 1 BUILD BRIEF
These instructions override anything they conflict with in the brief below.

## A. Source of truth (governs Phase 1)
1. Do NOT author any judgment, constraint, prohibition, or tiebreak values yourself. Copy the seven `judgment-os/*.md` files (provided alongside this brief) into `/config/judgment/` verbatim and parse them into typed config at boot. If a value the code needs is missing from those files, STOP and ask — do not infer it.
2. Every parsed value carries a provenance field: `canon | ratify_pending | prior | imported`. Entries still marked RATIFY in the source files load as `ratify_pending` and are usable, but the weekly-review endpoint must list all `ratify_pending` values still in active use.
3. TIEBREAK HIERARCHY: use exactly what `01-judgment-registry.md` JR-001 states. RESOLVED 2026-06-11: JR-001 amended and ratified as Reputation > Client Outcome > Revenue > Volume. Correct the build brief to match. "Trust" tier rejected as redundant with Reputation.
4. The governance agent's system prompt must be GENERATED from config at boot: CR-5 prohibitions + the five Judgment Gate questions + the JR Tier-1 tiebreaks. The existing hand-written governance prompt is replaced by this generated one. Same rule for the composer: CR-1/CR-2 values injected from config, never written into the prompt file.

## B. Thesis confirmation (extends Phase 2)
5. Add `thesis_status: 'untested' | 'confirmed' | 'partial' | 'refuted'` to Opportunity, default `untested`.
6. Add `PATCH /opportunities/:id/thesis-status` (body: status + optional evidence note). Conversations are human-run for now; this is how the human closes the prediction loop. Every status change writes an event with full lineage.
7. Prediction fields stored at creation must match the ES-3 schema in `04-evaluation-sets.md`: `prediction (HIGH|MEDIUM|LOW)`, `predicted_thesis (text)`, `confidence (0.0–1.0)`. Use these exact names — they are the eval-set columns.

## C. Send safety (governs Phase 6 — non-negotiable)
8. The Instantly adapter may fire ONLY on an APPROVED verdict event. No other code path can trigger a send. Assert this in code, not convention.
9. Config flag `LIVE_SENDS=false` by default. While false, every send routes to the test-inbox list in config (Kalei-owned addresses), regardless of the lead's real email. Flipping to true is a human action, never programmatic.
10. Reply capture: implement POLLING of the Instantly API on an interval (config, default 15 min). Do not build webhook ingestion this week (no stable public URL). Log replies as events with full lineage.
11. EDITED verdicts: the message that sends is the post-edit version; the event log stores before, after, and diff (per Phase 3). An edit then send produces TWO events: MessageEdited, MessageSent.

## D. External dependencies (resolve before claiming success)
12. FMCSA live data: [KALEI — register a free FMCSA QCMobile WebKey at mobile.fmcsa.dot.gov/QCDevsite, or designate the L&I file-drop approach; put the key/path in .env]. Until provided, the sentinel stays on fixtures — and the success criteria CANNOT be marked met on fixtures. Report "blocked on FMCSA credential" rather than passing on fixture data.
13. Instantly API key: [KALEI — add INSTANTLY_API_KEY to .env]. Same rule: no success claim without a real (test-inbox) send round-trip.
14. Anthropic credits: confirmed funded before starting, or stop at Phase 1.

## E. Proof of completion (extends Success Criteria)
15. "Operational" is proven by an artifact, not an assertion: a single markdown run-log containing (a) the live FMCSA record that entered, (b) the interpretation and opportunity JSON with lineage IDs, (c) the draft, the human verdict (with reason), the sent message ID, (d) the reply or polling evidence, (e) the /weekly-review JSON, and (f) `tsc --noEmit` exit 0. Produce this file as the final deliverable.
16. Anything in the brief that conflicts with the philosophy files in `/config/judgment/` resolves in favor of the files — and gets flagged to the human rather than silently resolved.
