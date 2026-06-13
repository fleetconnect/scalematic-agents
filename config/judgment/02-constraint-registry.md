# Constraint Registry
**Single source of truth for every number in the system. Local constraints in skills become pointers to this file.**

Provenance tags: `measured` (our data) · `prior` (industry assumption) · `imported` (third-party source, unverified) · `decision` (founder ruling, no data claim)

**RATIFICATION COMPLETE 2026-06-11.** All values below are canon except those marked CONDITIONAL or prior/imported (pending measurement). This file wins every conflict.

---

## CR-1 — Message length (resolves the 50 / 35–75 / 100 / 150 contradiction)

The underlying judgment (JR-013-adjacent): conversational density — founders text peers, they don't write copy. These are the model-facing encodings of that judgment:

| Context | Ideal | Acceptable range | Hard max | Provenance |
|---|---|---|---|---|
| LinkedIn connection request | 20–35 words | — | 300 chars (platform) | decision — CANON 2026-06-11 |
| Cold DM (first message after connect) | 50 words | 35–75 | 100 | decision — CANON 2026-06-11 (reconciles DM standards 35–75, Hook-Starter <100, agent prompt <50) |
| In-thread DM reply | under 50 words | — | 100 | decision — CANON 2026-06-11 |
| Any DM, absolute ceiling | — | — | 150 (auto-revise above) | decision — CANON 2026-06-11 (governance layer's number, repositioned as the outer wall) |
| Cold email — Instantly co-pilot first touch | 40–60 words | — | 60 | imported-reconciled (Aaron's Brain) — CANON 2026-06-11 |
| Cold email — Instantly follow-up (Poke-the-Bear) | 60–90 words | — | 90 | imported-reconciled — CANON 2026-06-11 |
| Instantly subject line | ≤4 words, boring/internal register | — | — | imported-reconciled — CANON 2026-06-11 |
| Instantly CTA | binary, ≤7 words ("Should I send it?") | — | — | imported-reconciled — CANON 2026-06-11 |
| Cold email — general (non-co-pilot) | under 150 words | — | 200 | decision — CANON 2026-06-11 (reconciles Fazio <150 lens with case-study-email <200) |
| Email paragraph | 1–3 sentences | — | — | CANON (writing governance) |
| Questions per message | 1 | — | 1 | CANON |
| Asks per message | 1 | — | 1 | CANON |

**Personalization encoding is channel-specific (one judgment, two encodings):** personalization must be proven by work, never claimed. **Email:** implied only — the specificity of the insight proves the research; never "I saw your post / noticed you raised." **LinkedIn DM:** explicit observation required — cite the real observed evidence. Neither encoding crosses channels. (Source: Aaron's Brain Rule 02 reconciled with ScaleMatic DM standards.)

**Stronger-model note:** models that hold voice reliably may be governed by the principle + hard max only; weaker models get the full table. Same judgment, model-appropriate encoding.

## CR-2 — Follow-up arithmetic (resolves deghosting 4 vs. followup-strategist 5+)

The two artifacts were describing **two different situations**. Canonical split:

| Situation | Max touches | Spacing | Close behavior | Provenance |
|---|---|---|---|---|
| Cold, never replied — LinkedIn/DM | 5 total attempts (opener + 4 follow-ups) | day 4–5, day 7–10, then weekly-ish | Close-the-loop message, tag, no guilt | decision — CANON 2026-06-11 |
| Cold email — Instantly co-pilot sequence | 2 touches (short-offer → Poke-the-Bear) | 3–5 business days | Second touch must offer a *different* asset, never repeat | imported-reconciled (Aaron's Brain) — CANON 2026-06-11 |
| Engaged, then went silent (deghosting) | 4 touches | 72h minimum | Scripted close (master prompt protocol), thread parked | CANON |
| Said "not now" | Timing-anchor at implied date, else 3–4 weeks | — | Nurture track | CANON |
| Revival of closed thread | 1 attempt per cycle | 30–90 days post-close | New material only; never reference the gap | CANON |
| Disqualify entirely | — | — | Explicit DNC, true disqualifier, competitor signed, or 5+ touches zero engagement of any form | CANON |

Cadence by temperature (followup-strategist table) remains valid *within* these caps. Until Eval Set 4 produces measured revival curves, all spacing values are `prior`.

## CR-3 — Escalation conditions

| Gate | Condition | Provenance |
|---|---|---|
| Meeting CTA permitted | All five present: trust, relevance, tension, urgency, consequence | CANON |
| Minimum conversation evidence | 3+ substantive exchanges AND operational pain surfaced AND buying curiosity AND some urgency | CANON |
| Pressure levels | 0–5 scale; never skip levels | CANON |
| CTA strength by stage | Stage 1–2: NONE · Stage 3: SOFT · Stage 4: MID · Stage 5: DIRECT | CANON |

## CR-4 — Channel benchmarks (provenance-tagged; the honest table)

| Metric | Value | Provenance | Action |
|---|---|---|---|
| Email open rate | 35%+ | prior (stated KPI) | Validate against Instantly actuals → `measured` |
| Email reply rate | 2%+ | prior | Validate |
| Email bounce | <3% | prior | Validate |
| LinkedIn connection acceptance | 20% floor / 25% target | decision — CANON 2026-06-11 | Validate against actuals |
| LinkedIn reply rate | 15%+ | measured-adjacent (Quantum Peak: 28.8% accept / 20.2% reply) | Promote with campaign citations |
| Qualified conversations | 10–15/mo | prior | Validate |
| Booked calls | 2–4/mo | prior | Validate |
| Newsletter open | 41–42% | **measured** (Growth Codex) | Canon — the only fully measured value in the system |
| Strip-line "cold-to-close 10–40%" | — | **imported, implausible** | **Removed from canon.** Retain in quarantine notes only. |
| Nurture email opens/clicks (25% / 4–5%) | — | imported/prior | Demote to "generic priors" label in skill |

## CR-5 — Prohibitions (the philosophy as hard constraints)

No manipulation · no fake urgency (JR-002 truth-condition governs all scarcity language) · no pressure before earn (CR-3 gates) · no bait-and-switch · no false personalization (every personalization cites observed evidence) · no guilt in any follow-up or close · no auto-send, ever · no regeneration after rejection without visible material change (JR-014) · no em dashes / current-generation AI tells (maintained list, reviewed quarterly) · banned-language list per writing governance (leverage, synergy, optimize, revolutionary, game-changer, touch base, hope you're well, just following up, circle back, value-add).

## CR-6 — Voice and tenant isolation

One voice profile per founder · profiles never blended · recalibrate at 30 days, on 2+ "doesn't sound like me" flags, or on public voice shift · white-label boundary: client-facing materials carry operator brand only (e.g., AI Synergy Group — no ScaleMatic mention) · cross-tenant learning on anonymized patterns only, never raw data.

---

## Conflict rule

If any skill, SOP, prompt, or agent states a value that conflicts with this registry, **this registry wins** and the conflicting artifact gets a correction ticket. Agents resolve ambiguity by citing the CR-section, not by choosing among local values.
