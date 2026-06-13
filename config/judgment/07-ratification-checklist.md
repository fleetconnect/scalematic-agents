# Ratification Checklist — One Sitting
**STATUS: COMPLETE 2026-06-11. All 33 items ratified. JR-001 amended (Reputation > Client Outcome > Revenue > Volume). JR-022 adopted. Aaron's Brain approved. Imported frameworks reference-only. Auto-approve and turn-count rules rejected. Registries 01/02/03 are now the dated canon — drop the CURRENT versions into /config/judgment/.**
**Every open decision in the Judgment OS, compressed. Mark each: ✔ YES (default stands) · ✎ EDIT (write the change) · ✘ NO (reject, say why).**
**If you do nothing else: Section A unblocks the code port. ~25 decisions total, est. 45–60 min.**

Convention: each item states the default. A bare ✔ means the default becomes canon exactly as written in the registry files.

---

## SECTION A — Blocks the build (the composer/gate port reads these)

### A1. Message length canon (CR-1)
| # | Decision | Default | Verdict |
|---|---|---|---|
| 1 | LinkedIn connection request | 20–35 words | ☐ |
| 2 | Cold DM (first after connect) | ideal 50 · range 35–75 · hard max 100 | ☐ |
| 3 | In-thread DM reply | under 50 · hard max 100 | ☐ |
| 4 | Absolute DM ceiling (auto-revise above) | 150 | ☐ |
| 5 | Instantly first touch | 40–60 words | ☐ |
| 6 | Instantly follow-up (Poke-the-Bear) | 60–90 words | ☐ |
| 7 | Instantly subject | ≤4 words, boring/internal register | ☐ |
| 8 | Instantly CTA | binary, ≤7 words | ☐ |
| 9 | General cold email (non-co-pilot) | under 150 · hard max 200 | ☐ |

### A2. Follow-up canon (CR-2)
| # | Decision | Default | Verdict |
|---|---|---|---|
| 10 | Cold never-replied (LinkedIn/DM) | 5 total attempts, then close-the-loop | ☐ |
| 11 | Instantly sequence | 2 touches, 3–5 business days, second asset must differ | ☐ |
| 12 | Engaged-then-silent (deghosting) | 4 touches, 72h min spacing — *already canon; confirming the split from #10 is right* | ☐ |

### A3. Channel personalization rule (CR-1 note)
| # | Decision | Default | Verdict |
|---|---|---|---|
| 13 | Email = implied personalization only; LinkedIn DM = explicit observed evidence; encodings never cross channels | As written | ☐ |

### A4. The gate's tiebreak (JR Tier 1 — these go into the interpreter/synthesizer/gate prompts)
| # | Decision | Default | Verdict |
|---|---|---|---|
| 14 | **JR-001** Reputation > Revenue > Volume as the stated objective function | As written | ☐ |
| 15 | **JR-002** No false urgency; scarcity only when factually true at send time | As written | ☐ |
| 16 | **JR-003** Conversation beats pitch even when the pitch converts better today | As written | ☐ |
| 17 | **JR-004** Reasoning over persuasion — prospect articulates, we clarify | As written | ☐ |
| 18 | **JR-005** Diagnosis before recommendation, no exceptions | As written | ☐ |
| 19 | **JR-006** Opportunities are built (thesis-bearing), not found | As written | ☐ |

---

## SECTION B — Shapes behavior, doesn't block the port

### B1. Tacit policies (Tier 3 — your verdicts here are the first Operating Manual extraction)
| # | Decision | Default | Verdict |
|---|---|---|---|
| 20 | **JR-018** Conversation depth outranks firmographics in qualification (→ becomes a fusion rule in opportunity scoring) | Confirm | ☐ |
| 21 | **JR-019** Skepticism ("we tried outbound," "AI feels risky") is a buying signal, routed to engagement not disqualification | Confirm | ☐ |
| 22 | **JR-020** Prioritize operator-style engagers over shopper-style — *with the stated enterprise exception* (consciously suspended for committee deals like the insurance pilot) | Confirm incl. exception | ☐ |
| 23 | **JR-021** Identity-consistency outranks message-level optimization (the calm-diagnostician identity is a design constraint, not a habit to fix) | Confirm | ☐ |

### B2. Conditionals (acknowledging these means: treated as true, formally under test)
| # | Decision | Default | Verdict |
|---|---|---|---|
| 24 | **JR-009** Timing > fit — under test via ES-3 prediction tracking; amended if data disagrees | Acknowledge | ☐ |
| 25 | **JR-017** Labor-replacement pricing — canon as positioning, evidence-pending via ES-5 | Acknowledge | ☐ |

### B3. Benchmarks (CR-4)
| # | Decision | Default | Verdict |
|---|---|---|---|
| 26 | LinkedIn acceptance: resolve the 20% vs 25% conflict | 20% floor / 25% target | ☐ |
| 27 | "Cold-to-close 10–40%" struck from canon (imported, implausible) | Confirm strike | ☐ |

### B4. Quarantine verdicts
| # | Decision | Default | Verdict |
|---|---|---|---|
| 28 | **Q-004** Aaron's Brain → APPROVED with attribution + the 4 deltas (channel rule, CR numbers, gift truth-condition, strip the prompt-header artifacts) | Approve | ☐ |
| 29 | **R-005–R-008** (grief play, pretext/bait-and-switch, pressure tie-downs & guilt follow-ups, quota call-theater) | Confirm all four rejections | ☐ |
| 30 | **Q-001/Q-002/Q-003** (conversion-dms, S4, Setter Bible): pick disposition — (a) rewrite through governance this quarter, or (b) relabel reference-only/non-executing indefinitely. *Default: (b) now — costs nothing, removes the routing risk today; rewrite later only if a use case demands it.* | (b) | ☐ |

---

### B5. Proposed amendments surfaced during the build handoff (from the parallel AI's file proposals — none load as canon without your verdict)
| # | Decision | Default | Verdict |
|---|---|---|---|
| 31 | **New entry — JR-022 candidate:** "A false positive (bad send) is more dangerous than a false negative (missed opportunity)" — consistent with JR-001; makes the asymmetry explicit for scoring and gate thresholds | Adopt as JR-022 | ☐ |
| 32 | **Conflict:** proposed "attempt progression after 4–5 meaningful exchanges" vs. JR-007's evidence-based stages (no turn counts). Keep the *meaningful exchange* definition (prospect reveals challenge / goal / belief / criteria) as stage evidence; reject the counter | Reject counter, absorb definition | ☐ |
| 33 | **Violation:** proposed auto-approve class for nurture/follow-up messages vs. CR-5 "no auto-send, ever." Approval tiers, if ever, arrive via the delegated-governance spec as a deliberate decision | Reject; defer tiers to delegated-governance spec | ☐ |

## On completion
1. Send back this file (or just the numbers + verdicts for anything that isn't ✔).
2. Section A verdicts flow directly into the repo port: constraint config + gate prompt ship with canonical values instead of proposals.
3. Section B1 verdicts get logged as Decision Log week-one entries — your first four entries write themselves.
4. Anything marked ✎ EDIT triggers a registry amendment (versioned, per the protocol); anything ✘ NO gets logged with the reason — both are extraction data, arguably more valuable than the confirmations.
