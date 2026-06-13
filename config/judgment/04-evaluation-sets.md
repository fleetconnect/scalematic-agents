# Evaluation Sets
**Six sets. Built in priority order against the real constraint: founder labeling hours, not model capability.**

Two set types:
- **Retrospective** (label historical data — costs founder hours now)
- **Prospective** (logging habits — cost ~nothing now, compound forever)

Priority order: ES-1 → ES-6 → ES-3 → ES-4 → ES-2 → ES-5. Rationale per set below. **Do not run all six at once.**

Universal rules:
- Double-label everything: `outcome` (what happened) + `verdict` (would we send/do this again today, knowing what we know — yes/no + one-line reason).
- **The disagreement cells are the gold:** worked-but-wouldn't-repeat and failed-but-would-defend. Mine those for rubric refinements.
- Small-N honesty: 25–30 clean exemplars per set beats 100 sorted by vibes. If history doesn't contain 50 booked-call conversations, label what exists and let prospective logging fill the gap.
- Regression rule: all scoring of system changes runs on the **production model**.

---

## ES-1 — LinkedIn Conversation Quality  ·  Retrospective  ·  PRIORITY 1

**Why first:** richest judgment density per labeled item; feeds the rubric, the manual extraction (Phase 6), and trust-threshold calibration (JR-008) simultaneously.

**Collect (targets, not requirements):** up to 50 booked, 50 replied-but-stalled, 50 never-replied threads. Sources: LinkedIn exports, client campaign archives, Quantum Peak / Daniel Sharpe / Ramsden / Verdun campaign histories.

**Label schema (per thread):**
```
thread_id · client/account · industry · icp_segment · channel
opener_text · opener_type (signal-led / pain-led / observation-led / event-led)
prospect_first_response (verbatim)
stage_reached (1–5) · exchanges_count
outcome: BOOKED / ADVANCED / STALLED / LOST
stall_stage (if stalled) · objections_raised (types)
predicted_trust_threshold (if interpretation was run) · actual_touches_to_CTA
verdict: SEND_AGAIN / WOULD_NOT + reason
```

**Scoring rubric — canonical 5 dimensions, 0–2 each (10 max):**
1. Evidence-grounded personalization
2. Stage discipline (one job, earned ask)
3. Voice fidelity (founder-at-8am test)
4. Diagnostic posture (their articulation, not ours)
5. Trust economics (pressure matched to earned trust)

*Note on the 1–10-per-dimension alternative:* deliberately rejected. Five dimensions × 3 points each produces far higher label consistency across raters and across months than five × 10 — and inter-label consistency is what makes an eval set usable. Granularity that can't be applied consistently is noise wearing precision's clothes.

**What ES-1 answers:** which opener types earn substantive replies by segment · where conversations actually stall (tests the adjustment framework) · whether predicted trust thresholds match reality · which rubric scores predict booking (validates the rubric itself).

---

## ES-6 — Founder Judgment Log  ·  Prospective  ·  PRIORITY 2 (start immediately)

**Why second despite being "set six":** ten minutes a week, zero backlog, and it's the primary feedstock for the Operating Manual. Every week not logged is judgment permanently lost.

**Weekly entries (3–7 per week), schema:**
```
date · decision (one line) · category (client / prospect / pricing / content / partner / internal)
options_considered · chosen · why (2–3 lines, honest, not performed)
gut_vs_analysis: GUT / ANALYSIS / BOTH
outcome (filled in later — 30/60/90-day check)
registry_link (if this decision used or revealed a JR entry)
```

**Seed examples (format reference):**
- *Passed on client X · category: client · why: operating profile mismatch — wanted execution without engagement · outcome (60d): peer agency took them, churned in 7 weeks · registry: JR-012, JR-020.*
- *Declined urgency framing in campaign Y despite operator request · why: scarcity claim wasn't true · outcome: pending · registry: JR-002.*

**Quarterly:** run the inference protocol (file 06) over the quarter's entries. Decisions the registry can't explain → new JR candidates.

---

## ES-3 — Opportunity Prediction  ·  Prospective  ·  PRIORITY 3

**Why:** directly tests JR-009 (timing > fit) — the most consequential unvalidated belief in the system — and it's nearly free: it's a prediction column added to existing workflow.

**Protocol:** for the next 100 prospects entering outreach, record *before first touch:*
```
prospect_id · icp_fit_score (1–10, existing engine) · signal_intensity (Low/Mod/High/Critical, opportunity-radar)
prediction: HIGH / MEDIUM / LOW opportunity · predicted_thesis (one line — what we think is true)
confidence (0.0–1.0)
```
Then track: replied / stage 3 reached / meeting / closed, and **thesis_confirmed: YES / PARTIAL / NO** (did their own words validate the thesis?).

**What it answers:** prediction calibration (do 0.8s hit 80%?) · fit-vs-timing decomposition (the JR-009 verdict) · thesis confirmation rate — the single best measure of whether the interpretation layer is real. Healthy target band: 50–85%. Below = interpreting noise; above = too conservative, under-minting opportunities.

---

## ES-4 — Follow-Up Intelligence  ·  Prospective  ·  PRIORITY 4

**Why:** replaces CR-2's `prior` cadence values with measured curves. Pure logging.

**Log every follow-up:** `thread_id · touch_number · type (light re-engage / new angle / callback / insight / timing anchor / pattern interrupt / close loop / revival) · days_since_last · response: NONE / REPLY / REVIVED / DNC`.

**What it answers:** revival rate by type and timing · the real optimal touch caps (today's 4/5 are opinions) · where the "money in the follow-up" actually sits by temperature.

---

## ES-2 — Sales Call Quality  ·  Retrospective  ·  PRIORITY 5

**Why fifth:** highest value per item but requires transcripts (Fathom/Zoom pulls) and the most founder review time per artifact. Start once ES-1 labeling is moving.

**Collect:** up to 20 won, 20 lost calls (label what exists).

**Available corpus — Bulletproof call recordings (98 calls, Dialpad links): use with two corrections.**
(1) *The label problem:* the sheet shows 45 Won / 53 Open / **1 Lost** — as labeled, there is no won/lost contrast to learn from. Fix: the 53 "Open" deals from a past pipeline are almost certainly dead; retrospectively relabel them LOST (with a stale-open flag) and the contrast set appears for free. (2) *The domain problem:* these are Bulletproof calls — different offer, different ICP, different philosophy (setter-era). They are a **craft corpus, not a deal-quality corpus**: valid for studying conversation mechanics that transfer (acknowledgment handling, question sequencing, where calls turned), invalid as ground truth for ScaleMatic offer/ICP/positioning evals. Tag every label from this corpus `domain: bulletproof` and never mix it into ScaleMatic deal benchmarks. ScaleMatic-native calls (Fathom/Zoom pulls) remain the real ES-2; this corpus is the warm-up that calibrates the scoring rubric before the native data exists.
**Score 0–2 each:** pain discovery depth · opportunity construction (was a thesis built and tested live?) · commercial reasoning (clarity created vs. persuasion attempted) · risk reduction (their fears addressed at root, JR-011) · urgency reality (grounded vs. manufactured, JR-002) · decision clarity (do they leave knowing exactly what happens next?).
**Plus per call:** MEDDIC gap snapshot (sales-call-intelligence already does this — log its output, that's the point) · emotional-shift moments (what triggered lean-in / pull-back) · `verdict: RUN_AGAIN / WOULD_CHANGE + what`.

---

## ES-5 — Offer Positioning  ·  Retrospective + Prospective  ·  PRIORITY 6

**Why last:** blocked by the proof-pipeline gap (audit Finding 3) — win/loss capture doesn't exist yet. Build the capture habit now; the set fills as deals close.

**Per offer/proposal:** `offer_name · vertical · tier · outcome: WON / LOST / STALLED · stated_reason · real_reason (founder read) · score 0–2: problem clarity / ICP fit / commercial value evidence / urgency reality / differentiation` · which of the five lenses (Hormozi/Brunson/Kennedy/Whiting/Gatari) the loss pattern maps to.

**Immediate candidates:** the Bespoke/insurance proposal (live), recent vertical-suite proposals, AI Executive Boardroom page conversions.

---

## Storage and tooling

One spreadsheet per set is sufficient to start (xlsx or Sheets; schema = columns above). Resist building software before 100 labels exist — the schemas will change after the first disagreement-mining pass, and cheap tools change easier. Graduate to structured storage when the eval sets start gating skill changes (the regression harness moment).
