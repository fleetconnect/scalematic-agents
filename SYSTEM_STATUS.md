# System Status

This file freezes the architectural status of the directories in this repository
as of the Control Center v1 — Phase 1 milestone (tag `control-center-v1-phase1`).
It exists so no contributor accidentally extends or runs an archived or legacy
surface as if it were current.

## Canonical

- `src/` — canonical backend and runtime service layer (Control Center v1).
- `test/` — backend test suite for the canonical service layer.
- `scalematic-brain/` — agent knowledge base loaded at startup.
- `../ops-dashboard/` — canonical Control Center UI (separate repository).

## Archived

- `ops-center/` — archived interface. Retained for history and migration
  reference only. Do not extend it or run it as a parallel control surface.

## Legacy

- `dashboard/` — legacy Vite prototype, retained for reference. Not a source of
  current product behavior. Do not build new features here.

## Data planes

- Plane A (operational state): SQLite via `better-sqlite3` (`data/`, git-ignored).
- Plane B (durable knowledge): Obsidian vault, accessed read-only in Phase 1.
- Plane-B writes are disabled and deferred to Phase 2A.

## Status summary

Phase 1 is the verified read-only foundation: canonical backend service layer,
read-only vault adapter, honest capability-state reporting, and safe path
enforcement. No write capability into the vault exists yet.
