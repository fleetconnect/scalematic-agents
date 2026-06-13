# ScaleMatic Autonomous Agent System

## Project Overview
A coordinated multi-agent operating system for ScaleMatic's outbound, content, sales, CRM, operations, and governance workflows. Nine specialized Claude-powered agents handle distinct responsibilities. All outbound-facing outputs (messaging, content) require human approval before delivery. Agents share a common knowledge base loaded from the `/scalematic-brain/` folder tree.

**API**: `http://localhost:3100/api`
**Deployment**: Local (future: Railway or EC2 alongside ScaleMatic backend)
**Parent platform**: ScaleMatic — ec2-18-217-216-214.us-east-2.compute.amazonaws.com

---

## IMPORTANT RULES

### 1. Task completion
A task is NEVER complete until the TypeScript compiler passes (`npx tsc --noEmit`), the server starts clean, and the relevant API endpoint returns the expected shape. Verify with curl before declaring done.

### 2. No emojis
Do not use emojis in code, comments, commit messages, logs, or API responses. Use plain text status labels instead.

### 3. Read before write
Before changing a file, read it fully. Before adding an agent or workflow, check `src/agents/` and `src/workflows/` for existing patterns. Mirror the same structure — do not invent new conventions.

### 4. Minimal diff
Touch only the files necessary for the task. Do not refactor surrounding code or reformat files. List cleanup opportunities separately.

### 5. No fallbacks for impossible cases
Trust internal code. Only validate at API boundaries (incoming HTTP requests, external API responses). Do not swallow errors — surface them clearly with `logger.error`.

### 6. No comments unless they explain WHY
Default to no comments. Add one only when a non-obvious constraint or workaround exists. Never comment WHAT.

---

## Tech Stack

### Backend
- **Runtime**: Node.js 20 + TypeScript 5
- **Framework**: Express 4
- **AI**: Anthropic SDK (`claude-sonnet-4-6`) — streaming, structured JSON output via `json` code blocks
- **Database**: SQLite via `better-sqlite3` (synchronous, WAL mode) — file at `data/scalematic.db`
- **Validation**: Zod (API boundaries only)
- **HTTP client**: axios (for GHL, Unipile integrations)

### Integrations (wired)
- **GoHighLevel**: `src/integrations/goHighLevel.ts` — contacts, opportunities, pipelines, tasks
- **Unipile (LinkedIn)**: `src/integrations/unipile.ts` — chats, messages

### Integrations (stubbed — fill in credentials)
- **Gmail**: `src/integrations/gmail.ts` — needs Google OAuth
- **Google Calendar**: `src/integrations/googleCalendar.ts` — needs Google OAuth
- **Slack**: `src/integrations/slack.ts` — needs `SLACK_BOT_TOKEN`

---

## Conventions
- **Naming**: camelCase functions, PascalCase interfaces/types, kebab-case file names
- **Agent output**: every agent returns structured JSON parsed from Claude's response; always define `outputFormat` in the agent definition
- **Approval gate**: set `approvalRequired: true` on any agent whose output goes to an external channel
- **Workflow steps**: `inputMapper` must be a pure function — no side effects, no async
- **Memory**: drop `.md` or `.txt` files in `scalematic-brain/<category>/` — they auto-load on startup
- **Commits**: imperative mood, explain why not what

## Commands
- Dev: `./start.sh` or `npx ts-node-dev --respawn --transpile-only src/index.ts`
- Typecheck: `npx tsc --noEmit`
- Build: `npx tsc`
- Health check: `curl http://localhost:3100/api/health`

---

## Project Structure
```
scalematic-agents/
  scalematic-brain/         # Knowledge base — drop .md files here
    company-overview/
    offers-and-pricing/
    icp-and-buyer-psychology/
    sales-scripts-and-objections/
    dm-frameworks/
    client-delivery-sops/
    case-studies-and-proof/
    content-voice-and-examples/
    proposals-and-growth-plans/
    transcripts-and-call-notes/
    metrics-and-reports/
    tool-stack-and-workflows/
    governance-rules/
  src/
    agents/                 # 9 agent definitions (system prompts + output schemas)
    orchestrator/           # agentRunner, agentRouter, workflowRunner
    workflows/              # 5 workflow definitions
    memory/                 # vectorStore (keyword search), documentLoader
    integrations/           # GHL, Unipile, Gmail (stub), Calendar (stub), Slack (stub)
    approvals/              # approvalQueue — create, review, list pending
    db/                     # SQLite schema + client singleton
    api/                    # Express routes
    types/                  # agent, task, workflow, approval, memory
    utils/                  # logger, errors
    index.ts                # Entrypoint — registers workflows, loads brain, starts server
  data/                     # SQLite DB lives here (git-ignored)
```

---

## Agent Reference

| ID | Approval | Primary Output |
|----|----------|----------------|
| `strategy` | No | thesis, pain points, offer angles, next actions |
| `research` | No | prospect background, hooks, buying signals |
| `messaging` | **Yes** | outbound message variants (LinkedIn / email) |
| `content` | **Yes** | LinkedIn posts, newsletter, scripts, carousels |
| `sales` | No | call prep brief, summary, follow-up, proposal outline |
| `crm` | No | pipeline summary, priority contacts, task list |
| `ops` | No | SOPs, workflow maps, task list |
| `metrics` | No | funnel snapshot, constraints, recommendations |
| `governance` | No | approved / needs_revision / rejected + revised copy |

## Workflow Reference

| ID | Trigger | Steps |
|----|---------|-------|
| `transcript-to-assets` | manual / call recording | strategy → content → sales → ops → governance |
| `new-lead` | CRM / manual | research → strategy → crm → messaging → governance |
| `pre-call-brief` | calendar / manual | crm → research → sales → strategy |
| `post-call-follow-up` | manual / recording | sales → strategy → messaging → ops → crm → governance |
| `stalled-lead-revival` | scheduled / manual | crm → strategy → messaging → governance |

---

## What "Done" Means
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] Server starts and `/api/health` returns `{"status":"ok"}`
- [ ] Relevant endpoint returns expected JSON shape (verified with curl or Postman)
- [ ] Any new agent has `approvalRequired` set correctly
- [ ] Any new workflow step has a pure `inputMapper`
- [ ] Committed with a meaningful message

---

## Things to NEVER do
- Send a message via Unipile or GHL without going through the approval queue
- Call `unipile.sendMessage()` from any automated workflow step — it is approval-only
- Add an agent without defining `outputFormat` — Claude will return unstructured text
- Register a workflow without adding it to the `registerWorkflow` calls in `src/index.ts`
- Modify `data/scalematic.db` directly — always go through `getDb()` and the schema
- Invent prospect data, case study results, or client metrics in agent outputs

---

## GHL MCP Safety Rules

The GHL MCP server (`ghl-mcp`) is connected via `.mcp.json` using a Private Integration Token (PIT). The following rules govern all GHL operations:

1. **Read operations are always safe.** `searchContact`, `getContact`, `getRecentConversations`, `getOpportunity`, `searchOpportunities`, `getCalendarEvents` may be called directly from any agent without approval.

2. **No direct writes from agents.** Agents must never call `axios.put`, `axios.post`, or `axios.patch` against GHL write endpoints. All mutations flow through `goHighLevelSafe.ts` proposal functions only.

3. **All write proposals enter the approval queue.** `proposeContactUpdate`, `proposeOpportunityUpdate`, and `proposeMessageDraft` create an `Approval` record and return it. No GHL mutation occurs at proposal time.

4. **`executeGhlProposal` is the only write gate.** It validates `approval.status === 'approved'` before making any GHL API call. It must never be called speculatively or in tests.

5. **The PIT token in `.mcp.json` must stay out of version control.** `.mcp.json` is git-ignored. Never log or surface the token value.

6. **Location scope is fixed.** All calls use `GHL_LOCATION_ID` from env. Never pass a different `locationId` to target another sub-account — that is out of scope.

7. **Message drafts are channel-typed.** `proposeMessageDraft` requires an explicit `channel: 'email' | 'sms'`. Do not infer the channel — the calling agent must declare it.
