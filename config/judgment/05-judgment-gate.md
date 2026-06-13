# Commercial Judgment Gate
**The brain above every agent. Runs before any output leaves any skill. Not a checklist replacement — the tiebreak layer above the checklists.**

---

## Position in the stack

```
Skill produces draft output
        ↓
Skill-local checks (stage logic, voice, format)     ← unchanged
        ↓
Governance Layer (6-layer review, auto-block patterns) ← unchanged, canonical spec
        ↓
COMMERCIAL JUDGMENT GATE (this file)                 ← new: the tiebreak
        ↓
Human approval queue
```

Governance answers: *is this message safe, human, and well-made?*
The Judgment Gate answers: *should this exist at all, given who we are?*

A message can pass every governance check and still fail the gate — e.g., a flawless, personalized, stage-appropriate message sent to a prospect we should disqualify, or in service of an opportunity we shouldn't build.

---

## The five questions

Every output (message, sequence, proposal, content piece, opportunity decision) answers:

1. **Does this create trust?** — Not "avoid destroying" — *create*. Neutral is not the bar. (JR-003)
2. **Does this protect or improve reputation?** — Screenshot test, future-client test, would-we-publish-the-thread test. (JR-001)
3. **Does this help the buyer make a better decision?** — Even if the better decision is "not us, not now." (JR-004, JR-012)
4. **Does this build a real opportunity?** — Is there a falsifiable thesis underneath, or is this activity wearing strategy's clothes? (JR-006)
5. **Would the founder send this himself, today, under his own name?** — The identity check. Not "is it in his voice" (governance covers that) — *is it a thing he would do.* (JR-021)

**Any "no" → revise or kill. Ties between questions resolve by JR-001's order: reputation > revenue > volume.**

---

## What the gate is NOT

- Not a rewrite of governance — governance's six layers and auto-block patterns remain canonical and unchanged.
- Not a per-message tax on speed — for routine in-thread replies that already passed governance, the gate is a 5-second mental pass. Its full weight applies to: new sequences, new campaigns, new offers, opportunity mint/kill decisions, framework imports, and anything an operator flags as "feels off."
- Not delegable to AI alone — an AI runs the questions and *recommends*; the human verdict is the gate for anything outbound. (The AI-run gate exists to make the human decision a 10-second decision, not to replace it.)

---

## Gate output format

```
JUDGMENT GATE
─────────────
Artifact: [message / sequence / proposal / decision]
Q1 Trust: [CREATES / NEUTRAL / RISKS] — [one line]
Q2 Reputation: [PROTECTS / NEUTRAL / EXPOSES] — [one line]
Q3 Buyer's decision: [HELPS / NEUTRAL / DISTORTS] — [one line]
Q4 Real opportunity: [THESIS EXISTS / ACTIVITY ONLY] — [the thesis, one line]
Q5 Founder test: [WOULD / WOULD NOT] — [one line]
Verdict: PASS / REVISE (what) / KILL (why — logged to quarantine reasons or Decision Log)
```

Every KILL and every REVISE-with-reason flows to the verdict stream — this gate is also a label factory for the eval sets.

---

## Escalation triggers (gate output that pages the human immediately)

- Q2 EXPOSES on anything client-facing
- Q4 ACTIVITY ONLY on anything about to consume >1 hour of execution
- Any conflict between two CANON registry entries (means the registry needs an amendment, not a workaround)
- Any artifact from an IMPORTED-class framework reaching the gate (routing failure — should have been caught at quarantine)
