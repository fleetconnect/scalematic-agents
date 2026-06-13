# ScaleMatic Commercial Judgment OS
**The model-independent layer. Models come and go; these five assets remain.**

Version 1.0 | June 2026

---

## What this is

The judgment layer above every agent, skill, and workflow. Not another system that does work — the system that defines what good work is, captures why decisions get made, and gives every future model (Sonnet, Opus, Fable, whatever ships next year) the same inherited judgment.

Five core assets:

| File | Asset | What it protects |
|---|---|---|
| `01-judgment-registry.md` | Judgment Registry | The decision policies — what we believe and the tiebreak tests that prove it |
| `02-constraint-registry.md` | Constraint Registry | The single source of truth for every number — word counts, cadences, benchmarks |
| `03-framework-quarantine.md` | Framework Quarantine | Which frameworks execute, which are reference-only, which are rejected and why |
| `04-evaluation-sets.md` | Evaluation Sets | The labeled data and rubrics that make "better" measurable |
| `05-judgment-gate.md` | Commercial Judgment Gate | The pre-output check every agent runs — above governance, below nothing |
| `06-founder-operating-manual.md` | Founder Operating Manual | The extraction protocol and the manual itself — how Kalei thinks, written down |

---

## Build order (sequenced by dependency and founder-hours, not by ambition)

**Week 1 — Ratify and start logging.**
1. Read `01` and `02`. Both are *seeded with proposed content* from the forensic audit — every entry marked `RATIFY` needs a yes/edit/no from Kalei. This is fast (an hour) and unblocks everything.
2. Start the Founder Decision Log (`06`, Section 4). Ten minutes a week, starts compounding immediately.
3. Apply the quarantine labels in `03` to the actual skill files (header tag per skill).

**Weeks 1–3 — Eval Set 1 (conversations).**
Pull historical LinkedIn threads, run the double-label pass per `04`. This is the founder-hours bottleneck; everything in `04` is prioritized around that constraint. Do NOT attempt all six sets at once.

**Weeks 2–4 — Prospective sets go live.**
Eval Set 3 (opportunity prediction) and Eval Set 4 (follow-up logging) are logging habits, not labeling projects. Turn them on and let them accrue.

**Weeks 3–6 — First extraction cycle.**
Run the Phase-6 inference protocol in `06` on the labeled conversation data. Output: Founder Operating Manual v0.1. Correct it. That correction *is* the extraction.

**After that — and only after that —** architecture simplification, scaffolding removal, and agent rebuilds, each validated against the eval sets by the production model.

---

## Maintenance cadence

| Asset | Cadence | Action |
|---|---|---|
| Judgment Registry | Quarterly + on conflict | New entries when a decision reveals an undocumented policy; amend when a tiebreak test fails in practice |
| Constraint Registry | Quarterly | Replace `prior`/`imported` values with `measured` as data accrues |
| Quarantine | On any new framework import | Nothing enters Approved without passing the Judgment Gate review |
| Eval Sets | Monthly append; quarterly re-baseline | New exemplars from the verdict stream; re-score after any system change |
| Decision Log | Weekly, 10 min | Non-negotiable. This is Eval Set 6. |
| Operating Manual | Per extraction cycle | Model infers → founder corrects → version bump |

---

## The three rules that govern this whole package

1. **Models propose; the founder ratifies.** Every registry entry, quarantine verdict, and manual principle carries founder sign-off or it isn't canon.
2. **Production-model validation only.** Any change to skills or architecture is scored against the eval sets by the model that will actually run in production — never by a stronger model grading its own work.
3. **Nothing is deleted before its intent is extracted.** Scaffolding removal requires: intent captured in the Judgment Registry → constraint captured in the Constraint Registry → regression passed on eval sets. In that order.
