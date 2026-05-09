# ADR-011 — API Framework: Next.js Route Handlers

**Date:** 2026-05-09
**Status:** Proposed
**Supersedes:** ADR-002 (Express backend framework)
**Amends:** ADR-008 (CORS policy — no longer needed for web→API calls)
**Amends:** ADR-010 — removes the constraint "API and CORS are unchanged; Express handles all API traffic; no Next.js API routes are added"

---

## Context

ADR-002 chose Express 4.x as the backend framework. ADR-010 (Next.js migration for `apps/web`) explicitly held the API unchanged, treating the Express server as a separate deployment unit.

Two factors make consolidation worth reconsidering now:

1. **M7 (public booking widget)** will extend `apps/api/src/routes/public.ts` significantly. Building that work in Express and then serving it from the same Next.js app (M7 is a Server Component page) creates a cross-process dependency that could be eliminated.

2. **Single deployment** — shipping one process instead of two simplifies infra, removes CORS configuration, and reduces operational overhead before any hosted customers exist.

The migration is low-risk because:
- The Neon WebSocket `Pool` works identically in Node.js runtime Route Handlers (`SET LOCAL` transactions are unaffected — ADR-004's constraint is not violated).
- `bcryptjs` and `jsonwebtoken` are Node.js-compatible; no Edge runtime is used.
- `tenant-context.ts` is already a plain utility function — zero changes needed.
- The route transformation is mechanical (Express `req`/`res` → Web `Request`/`Response`).

---

## Decision

Move all Express API endpoints into **Next.js Route Handlers** under `apps/web/app/api/`. Delete `apps/api`.

Route Handlers run in **Node.js runtime** (not Edge). This is required for bcryptjs, jsonwebtoken, and the Neon WebSocket Pool.

All shared API utilities (`jwt.ts`, `password.ts`, `withTenantContext.ts`, `availability.ts`) move to `apps/web/src/lib/server/`. Auth middleware becomes a `withAuth()` helper called at the top of each protected handler.

The `NEXT_PUBLIC_API_URL` env var changes from `http://localhost:3001` to `/api`, keeping all existing `apiFetch('/path', ...)` calls in `apps/web/src/lib/api.ts` unchanged.

### Rate limiter

The in-memory `Map`-based rate limiter in `public.ts` is removed. It does not survive process restarts and cannot scale across instances. Before M7 launches, rate limiting on `/api/public/*` must be replaced with an external-store solution (Upstash Rate Limit is the recommended approach). This is tracked as a task in the feature tasks but is not a blocker for the migration itself — the public endpoint has no live clients until M7.

### CORS

With web and API co-located, browser requests from the dashboard to `/api/*` are same-origin — no CORS headers needed. The `ALLOWED_ORIGINS` env var and the hand-written CORS middleware (ADR-008) are removed from the Express layer.

**CORS for `/api/public/*`:** If external sites (not iframes) need to call the public booking API directly in the future, CORS headers can be added in `apps/web/middleware.ts` scoped to `/api/public/*` routes. This is out of scope for this migration.

---

## Consequences

- `apps/api` directory is deleted. `@schedule-core/api` workspace package ceases to exist.
- `apps/web/package.json` gains: `bcryptjs`, `jsonwebtoken`, `@types/bcryptjs`, `@types/jsonwebtoken`.
- `apps/web/src/lib/server/` created for server-only utilities. Never imported from Client Components.
- `NEXT_PUBLIC_API_URL` in `.env.local` and CI changes from `http://localhost:3001` to `/api`.
- The in-memory rate limiter is removed. An Upstash-based replacement is required before M7.
- `apps/web/next.config.ts` may need `serverExternalPackages: ['bcryptjs', 'jsonwebtoken']` if bundling issues arise.
- ADR-002's Express rationale (large ecosystem, no magic) still applies — Route Handlers provide the same primitives.
- ADR-001 (pnpm workspaces) is unaffected: `apps/web` and `packages/db` remain separate workspace packages.
