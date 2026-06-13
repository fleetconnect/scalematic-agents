# ScaleMatic Agent Operations Center — Phase A Delivery + Phase B Architecture

Read-only command console for the Commercial Opportunity OS, plus three governed write
paths. Built this week (Phase A). Phase B is specified here on paper and intentionally not
built. Honesty constraints from the build addendum are treated as non-negotiable throughout:
no rendered agent dialogue, no fake liveness, fields that do not exist in the data do not
appear in the UI.

---

## 0. Stack decision (and why it differs from the base prompt)

The base prompt named Next.js + React Flow + Framer Motion + Recharts. The addendum then
simplified the mandate: SSE over WebSockets, SQLite (no Postgres), React Flow reserved for
the lineage chain and the Phase-B map, Phase-A screens as lists/panels. Given that, and that
the operator already runs a **Vite + React 18 + react-router-dom 6 + Tailwind 3** frontend
(`agent-dashboard/frontend`), Phase A is built on that same stack to stay consistent and
avoid a heavy Next.js install for what are fundamentally list/panel screens. No animation or
charting library was pulled in for Phase A; none is needed yet. React Flow / Recharts /
Framer Motion are deferred to Phase B where they actually earn their weight (system map, flow
animation, learning charts). This is a documented, reversible fork — not a silent deviation.

**Placement:** `scalematic-agents/ops-center` (co-located with the Express backend it serves).
Dev server on `:5181`, proxying `/api` to the backend on `:3100`.

---

## 1. UI architecture

```
ops-center/
  index.html
  vite.config.js          # :5181, proxy /api -> :3100
  tailwind.config.js       # dark console theme (ink/panel/edge/muted)
  src/
    main.jsx               # BrowserRouter root
    App.jsx                # header (live status, LIVE_SENDS, judgment) + nav + routes
    api.js                 # REST client; surfaces backend error bodies verbatim
    useEventStream.js      # SSE hook (EventSource) -> newest-first capped buffer
    components/ui.jsx       # Panel, Badge, StatusDot, Field, EmptyState, Mono
    pages/
      ApprovalCenter.jsx    # the one screen that matters: queue + review + 3 verdicts
      Opportunities.jsx     # list + detail + thesis-status control (write path 2)
      EventStream.jsx       # reverse-chron SSE feed, clickable lineage IDs
      Lineage.jsx           # vertical chain (not a graph engine)
      Metrics.jsx           # verdicts-this-week (largest) + ratify_pending list
```

Data flows one direction: backend event log -> SSE -> `useEventStream` (App level) ->
screens. REST is used for point reads (review-context, opportunities, weekly-review) and for
the three writes. The event stream is the single live signal; an idle backend renders an idle
UI, never a faked one.

## 2. Database / backend requirements (all already in SQLite; no Postgres)

Phase A added **no new tables**. It reads the existing spine: `signals`, `interpretations`,
`opportunities` (+`thesis_status`,`prediction`), `approvals`, `verdicts`, `sends`,
`opportunity_events` (append-only), `evaluation_sets`. New backend surface:

| Endpoint | Purpose |
|---|---|
| `GET /api/events/stream` | SSE. Replays last N events (`backfill`, default 25) then streams live. Heartbeat comment every 25s. |
| `GET /api/approvals/:id/review-context` | Composite: `{approval, draft, opportunity, governance, evidence[], verdict}` — one round trip per verdict. |
| `GET /api/system/status` | Read-only runtime posture: `liveSends`, `instantlyConfigured`, judgment load/missing, `ratifyPendingInUse`. |

Live push is implemented by an in-process `EventEmitter` (`src/opportunity/eventBus.ts`):
`emitEvent` persists to SQLite first (source of truth) then `publishEvent` to the bus. SSE
subscribers receive the same object. A dropped frame is always recoverable from `GET /events`.

## 3. Event schema (unchanged; consumed, not extended)

`OpportunityEvent { id, type, entityRef?, subjectId, parentIds[], payload, createdAt }`.
`parentIds` is what makes lineage a join rather than an inference; the UI renders those IDs as
clickable links into the explorer. Event types consumed: `signal.detected`,
`interpretation.created`, `opportunity.minted`, `message.drafted`,
`message.submitted_for_approval`, `message.approved|edited|rejected`, `message.sent`,
`reply.received`, `conversation.started`, `thesis_status.changed`, `opportunity.closed`.

## 4. Component hierarchy (Phase A)

```
App
├── Header (StatusDot live, Badge LIVE_SENDS, Badge judgment)
├── Nav
└── Routes
    ├── ApprovalCenter(stream)
    │   ├── PendingQueue (list, refreshes on approval/verdict events)
    │   └── ReviewPanel(approvalId)
    │       ├── DraftMessage
    │       ├── VerdictBar  ── APPROVE | EDIT | REJECT (reason req. on EDIT/REJECT)
    │       ├── OpportunitySummary (thesis, score, ICP fit, ES-3 prediction)
    │       ├── GovernanceGate (status, score, risk flags)
    │       └── Evidence (source signals)
    ├── Opportunities → Detail → ThesisControl (confirmed|partial|refuted + evidence note)
    ├── EventStream(stream) → IdLink → Lineage
    ├── Lineage(:id) → vertical Node chain
    └── Metrics(system) → big verdict number + ratify_pending list
```

## 5. SSE architecture (chosen over WebSockets)

Single operator, low event rate. SSE is one GET endpoint, auto-reconnects in the browser, and
needs zero connection bookkeeping on the server beyond a per-request unsubscribe on `close`.
Frame types: `replay` (backfill on connect), `ready` (replay complete), `append` (live),
plus `: heartbeat` comments. WebSockets would add a handshake, framing, and lifecycle
management for no benefit at this scale.

## 6. Wireframes (as built — see screenshots in this folder)

- `ops-approval-center.png` — review panel: opportunity, governance gate, source evidence.
- `ops-top2.png` — lineage explorer: signal → interpretation → opportunity → events.

Layout: left rail nav; Approval Center is a two-column grid (queue | review); other screens
are single-column panels. Approval queue is mobile-readable (grid collapses to one column).

## 7. User flows

1. **Verdict (write path 1):** open Approval Center → pick draft → read opportunity +
   governance + evidence → APPROVE, or EDIT (inline edit, diff auto-captured by backend) or
   REJECT (reason required) → verdict POSTed → `message.approved|edited|rejected` event hits
   the stream → queue refreshes.
2. **Thesis status (write path 2):** Opportunities → detail → pick confirmed/partial/refuted +
   evidence note → PATCH → `thesis_status.changed` event.
3. **LIVE_SENDS (write path 3, display only):** header badge shows ON/OFF from
   `/system/status`. The UI never flips it; that stays a `.env` action.
4. **Investigate:** Event Stream → click any lineage ID → Lineage explorer walks the chain.

## 8. Build order (followed)

backend event bus + SSE → review-context + system-status endpoints → frontend scaffold →
API/SSE client → Approval Center → Opportunities/thesis → Event Stream → Lineage → Metrics →
verify (tsc, vite build, curl flow, browser screenshots).

## 9. MVP definition (this is the MVP)

One operator can see every pending draft with full judgment context, render a quality verdict
in three clicks, watch the resulting event appear live, walk the lineage to the source filing,
and set thesis status — all read-only except the three governed writes.

## 10. V2 vision → see Phase B below.

---

## PHASE B — component architecture (ON PAPER, NOT BUILT)

Gate: build only once the event log holds 100+ real (non-fixture) events, so animation and
charts describe reality instead of decorating an empty system.

### B1. System Map (`SystemMap.jsx`, React Flow)
Nodes = the 8 OS layers (sentinels, interpreter, synthesizer, scoring, composer, governance,
approval, execution) + learning. Node state is derived **only** from the event log: a layer is
"active" if it produced an event inside a rolling window, else "idle". Idle renders idle. Edges
are real hops taken (parent→child event transitions counted over the window), edge thickness =
volume. No invented throughput.

### B2. Handoff Feed (`HandoffFeed.jsx`) — the honesty-critical piece
NOT a chat. For each pipeline hop, render the **actual artifact** the producer emitted and the
consumer received: `reasoning_trace`, `thesis`, `confidence`, scores — pulled from the stored
object. Labels are producer/consumer agent IDs. If a field is absent from the object, it is
absent from the card. No utterances are ever synthesized.

### B3. Flow animation (`FlowLayer.jsx`, Framer Motion)
A token animates along an edge **only** when a real event with the matching parent→child
transition arrives on the SSE stream. No idle shimmer, no synthetic packets.

### B4. Learning charts (`LearningCharts.jsx`, Recharts)
Thesis confirmation rate over time, ES-3 prediction accuracy (predicted band vs. actual
outcome label), verdict mix trend. Source: `evaluation_sets` + `outcome_labels` + `verdicts`.
Renders an explicit "insufficient data" state below sample-size thresholds.

### B5. Replay Mode (`Replay.jsx`, Phase A.5 if time permits — not built this week)
Compress any event-log window into animated playback (default: last 7 days in 60s). Pure
client-side scrub over events already fetched from `GET /events`; reuses the SSE rendering
components driven by a virtual clock instead of the live socket.

### B6. Agent handoff theater
The dramatized framing resolves to B1+B2+B3 over real data. There is no separate "theater"
that invents content; the drama is real artifacts moving on real timing.

---

## Definition of Done — status

- [x] `npx tsc --noEmit` exit 0 (backend).
- [x] `vite build` succeeds (frontend, 42 modules).
- [x] Server boots clean; `/api/health` ok; SSE stream emits `replay`/`ready`/`append`.
- [x] One opportunity walked draft → verdict (EDITED, reason "Tightened CTA per brand voice",
      diff auto-captured) → `message.edited` event in stream → full lineage walked in explorer
      → thesis status set to `confirmed` with evidence note. Verified via curl + browser
      screenshots (`ops-approval-center.png`, `ops-top2.png`).

### Item 14 — live-data caveat (stated plainly)
The Week-1 build-brief loop is **not yet operational** end to end. The LLM pipeline
(interpreter → synthesizer → composer → governance) is blocked: Anthropic credits at zero,
the seven `judgment-os/*.md` files are absent (composer/governance fail loud by design),
`INSTANTLY_API_KEY` is absent, and the FMCSA QCMobile WebKey is absent (sentinel on fixtures).
Therefore the opportunity + approval exercised above were produced by a clearly-labeled
**fixture seed** (`scripts/seedOpsFixture.ts`), reusing a **real** FMCSA sentinel signal so the
lineage chain is genuine end to end. The seed authors no Judgment-OS rule values. **The Ops
Center has not yet displayed a live, LLM-generated opportunity.** When the four credentials
above are supplied, the same screens render live data with no code change — the UI reads the
same tables and event types the live pipeline writes.

## Run

```
# backend (note the env shim — the shell's empty ANTHROPIC_API_KEY shadows .env)
cd scalematic-agents && env -u ANTHROPIC_API_KEY npx ts-node-dev --respawn --transpile-only src/index.ts
# seed demo data (optional, until the live loop is operational)
env -u ANTHROPIC_API_KEY npx ts-node scripts/seedOpsFixture.ts
# frontend
cd ops-center && npm install && npm run dev   # http://localhost:5181
```
