# ops-center — SUPERSEDED (archived reference)

> Status: SUPERSEDED as of 2026-06-11. Do not build on this. See `../STATE.md` at repo root.

This Vite + React (JSX) frontend shipped Phase A per addendum 09 on port 5181. It has
been superseded by **ops-dashboard** (Next.js, port 4100), built per addendum 11, which
is now the single canonical frontend for the Commercial Opportunity OS.

ops-dashboard carries the fuller Phase-1 surface and both human write paths
(verdict + thesis-status). Before retiring this app, its two distinct screens were
ported into ops-dashboard:

- **Lineage Explorer** — the click-any-ID vertical-chain page (signals -> interpretations
  -> opportunity -> downstream events). Now at
  `ops-dashboard/components/dashboard/sections/lineage.tsx`.
- **Opportunities list + thesis-status control** — now at
  `ops-dashboard/components/dashboard/sections/opportunities.tsx`.

## Why this is archived, not deleted

This is working reference code. The interaction patterns (review context, lineage
resolution, thesis-status write) informed the canonical build and remain useful to read.

## Do not

- Do not run this against the live backend as a parallel UI. A second implementation of
  a CANONICAL surface is a fork (see the rules in `../STATE.md`).
- Do not port features *out of* ops-dashboard back into here.

## If you need the canonical app

```
cd ../../ops-dashboard
npm run dev   # http://localhost:4100
```

Coordination memory lives in `../STATE.md`. Read it first, update it last.
