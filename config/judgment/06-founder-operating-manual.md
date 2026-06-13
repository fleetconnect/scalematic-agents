# Founder Operating Manual — Skeleton + Extraction Protocol
**Not what we do. How we think. The asset that makes ScaleMatic survivable beyond one head.**

The manual cannot be written by introspection — tacit judgment is tacit precisely because the operator can't articulate it on demand. It is written by **inference and correction**: a model infers the decision policies from real decisions; the founder corrects the inferences; the corrections are the manual.

---

## 1. The Extraction Protocol (run per cycle; first cycle after ES-1 labeling)

**Inputs per cycle (use what exists; don't wait for round numbers):**
- Labeled conversations (ES-1) — especially the disagreement cells
- Pursued vs. ignored prospects (ES-3 predictions + any historical pursue/pass decisions reconstructable from campaign archives)
- Client decisions: taken, declined, fired (Decision Log + memory)
- Won/lost calls when available (ES-2)
- The quarter's Decision Log entries

**The inference prompt (canonical wording):**
> Here are [N] real decisions with context and outcomes. Do not summarize them. Do not explain the outcomes. **Infer the implicit decision policies that produced these choices** — the rules the decision-maker was following whether or not they could state them. For each inferred policy: state it as a falsifiable claim, cite the 3+ decisions that evidence it, state at least one decision that appears to *violate* it (or say none exists), and rate your confidence. Where two policies conflict, name the apparent tiebreak rule.

**The correction pass (the actual extraction):**
For each inferred policy, the founder marks: **CONFIRM** (as written) · **EDIT** (true but misstated — rewrite it) · **REJECT** (false pattern — say what the model misread) · **CONDITIONAL** (true in context X, false in Y — name the boundary).
The edits and the conditionals are the highest-value output. A confirmed policy the model guessed is worth something; a corrected policy is worth ten times more, because the correction encodes the boundary the model couldn't see.

**Output handling:**
- CONFIRMED/EDITED policies → proposed Judgment Registry entries (Tier 3 → Tier 1/2 on ratification)
- CONDITIONALs → registry entries with stated conditions
- REJECTED inferences → logged anyway, with the misread named (these teach future extraction cycles what the data under-represents)
- Manual version bump per cycle

**Cadence:** quarterly, or after any 50-decision accumulation, whichever first.

---

## 2. Manual structure (the skeleton — sections fill via cycles)

### Part I — The Objective Function
JR-001 stated plainly, with the real decisions that prove it. The chapter a new operator, hire, or white-label partner reads first. *(Seeded: audit T1 + founder confirmation. Needs: 5–10 evidencing decisions from the Log.)*

### Part II — How Opportunities Get Built
JR-006 expanded: what a thesis is, what makes one falsifiable, when a lead becomes an opportunity, when an opportunity gets killed. The pursue/pass boundary in worked examples. *(Feeds from ES-3.)*

### Part III — How Prospects Get Read
The interpretation judgments as applied craft: commercial-mode reads, trust-threshold calls, the depth-over-firmographics rule (JR-018) with its enterprise exception (JR-020). Real threads annotated: *here is what was read, here is the call that was made, here is what happened.* *(Feeds from ES-1.)*

### Part IV — How Conversations Get Run
Stage discipline, strip-lining, objection reading, the deghosting ethic — not restated as rules (the skills hold the rules) but as **judgment at the boundaries**: the conversations where the rules conflicted and what won. *(Feeds from ES-1 disagreement cells — the worked-but-wouldn't-repeat threads are this chapter.)*

### Part V — What Gets Declined and Why
The refusals: clients passed on, tactics rejected, revenue declined, frameworks quarantined. Each with the reason and the outcome where known. This chapter is the moat made legible — anyone can copy what ScaleMatic does; this is the record of what it won't do and what that discipline has been worth. *(Feeds from Decision Log + quarantine ledger R-entries.)*

### Part VI — The Identity
JR-021 expanded: the calm-diagnostician identity, why identity-consistency outranks message-level optimization, and the founder-voice principles beneath the voice profiles. The chapter that explains the "irrational" decisions. *(Seeded: audit T5. Needs founder edit most of all six — identity claims should be self-authored after model inference, not model-authored.)*

### Part VII — Amendments
The version history of changed beliefs. What we used to think, what changed it, when. Kept deliberately — the trajectory of corrections is itself judgment data, and it inoculates future readers against treating any current chapter as eternal.

---

## 3. First-cycle plan (concrete)

1. Founder ratifies registry Tier 3 (JR-018–021) — 30 minutes, can happen today. Those four verdicts seed Parts III and VI.
2. ES-1 labeling produces the first 50–100 labeled threads.
3. Run the inference prompt over: labeled threads + every client take/decline/fire decision reconstructable from the last 12 months (memory holds several: client selections, the white-label arrangements, the positioning migration itself — each was a judgment call with a recoverable rationale).
4. Correction pass — budget 2 hours, do it in one sitting (consistency of mood matters for boundary calls).
5. Manual v0.1 assembled from confirmed/edited policies, mapped to the seven parts. Expect Parts I, III, IV, V to have real content; II fills as ES-3 accrues; VI is founder-authored against the inference.

---

## 4. The Weekly Decision Log (ES-6 — the standing feedstock)

The template, kept deliberately light enough to survive busy weeks:

```
WEEK OF: ______

DECISION 1
What: [one line]
Category: client / prospect / pricing / content / partner / internal
Why: [2–3 honest lines — the real reason, not the defensible one]
Gut or analysis: GUT / ANALYSIS / BOTH
Registry link: [JR-### or "none — possible new entry"]
Outcome check date: [+30/60/90d]

DECISION 2 ...
(3–7 per week. If a week produced fewer than 3 loggable decisions, log the
non-decisions: what was deliberately NOT pursued, and why — those count.)
```

**The one rule that makes this work:** log the real reason. "Bad vibe from the call" is a valid entry; the extraction cycles exist to find out what the vibe was detecting. A sanitized log produces a sanitized manual, and a sanitized manual is just marketing.

---

## End state

When the manual reaches v1.0: every future model gets handed the Judgment Registry, the Constraint Registry, the eval sets, and this manual — and can rebuild every workflow, agent, and skill in the system without losing the thing that makes them ScaleMatic's. Workflows become disposable. Judgment becomes infrastructure.
