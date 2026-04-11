# ADR 001 — Monorepo Tooling: pnpm Workspaces

**Date:** 2026-04-11
**Status:** Accepted

## Context

ScheduleCore has a backend API, a frontend web app, and shared packages (e.g., DB client). These must share TypeScript config, be independently deployable, and have isolated dependency graphs.

## Decision

Use **pnpm workspaces** as the monorepo manager.

- `apps/api` — Express backend
- `apps/web` — React frontend
- `packages/*` — shared libraries

No additional monorepo orchestration tool (Nx, Turborepo) at this stage. Add only if build caching becomes a bottleneck.

## Consequences

- All packages share `tsconfig.base.json` via `extends`.
- Root `package.json` provides top-level `dev`, `build`, `typecheck`, `lint` scripts via `pnpm -r`.
- `shamefully-hoist=false` in `.npmrc` keeps node_modules isolated per package.
