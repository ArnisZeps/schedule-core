# ADR 002 — Backend Framework: Express

**Date:** 2026-04-11
**Status:** Accepted

## Context

The API needs HTTP routing, JSON body parsing, and middleware support. Options considered: Express, Fastify, Hono.

## Decision

Use **Express 4.x** with TypeScript (`@types/express`).

- No framework magic or decorator-based routing.
- Routers are plain `express.Router()` instances, co-located by feature under `src/routes/`.
- `tsx watch` for development (no transpile step, fast restarts).
- `tsc` for production builds into `dist/`.

## Consequences

- Large ecosystem; any middleware or auth library will have Express support.
- No built-in schema validation — add `zod` + a thin middleware wrapper when needed.
- `.js` extensions required on all local imports (Node16 module resolution).
