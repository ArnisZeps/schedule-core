# Tasks: api-nextjs-migration

<!-- Never delete tasks. Mark done, append new ones. -->

## Phase 1 — ADR and server utilities

- [x] Write `docs/adr/011-api-nextjs-route-handlers.md` (supersedes ADR-002, amends ADR-008 and ADR-010)
- [x] Add `bcryptjs`, `jsonwebtoken`, `@types/bcryptjs`, `@types/jsonwebtoken` to `apps/web/package.json`; run `pnpm install`
- [x] Create `apps/web/src/lib/server/` directory
- [x] Move `apps/api/src/lib/jwt.ts` → `apps/web/src/lib/server/jwt.ts`
- [x] Move `apps/api/src/lib/password.ts` → `apps/web/src/lib/server/password.ts`
- [x] Move `apps/api/src/lib/availability.ts` → `apps/web/src/lib/server/availability.ts`
- [x] Move `apps/api/src/middleware/tenant-context.ts` → `apps/web/src/lib/server/withTenantContext.ts`
- [x] Create `apps/web/src/lib/server/db.ts` — module-level Neon Pool singleton
- [x] Create `apps/web/src/lib/server/withAuth.ts` — extracts and verifies Bearer token from `Request`; returns `{ userId, tenantId }` or `null`

## Phase 2 — Route Handlers

Migrate one route group at a time. Run `pnpm typecheck` after each group.

- [x] `app/api/health/route.ts` — `GET /api/health`
- [x] `app/api/auth/signup/route.ts` and `app/api/auth/login/route.ts`
- [x] `app/api/tenants/route.ts` and `app/api/tenants/[tenantId]/route.ts`
- [x] `app/api/tenants/[tenantId]/services/**` — list, create, get, update, delete, slots
- [x] `app/api/tenants/[tenantId]/services/[serviceId]/availability-rules/**`
- [x] `app/api/tenants/[tenantId]/bookings/**` — list, create, patch
- [x] `app/api/tenants/[tenantId]/staff/**` — list, create, get, update, delete, services, schedules, overrides
- [x] `app/api/public/[tenantSlug]/**` — slots GET, bookings POST; remove in-memory rate limiter; add `// TODO: add Upstash Rate Limit before M7`

## Phase 3 — Client wiring

- [x] Update `NEXT_PUBLIC_API_URL` to `/api` in `.env.local` (and any `.env.example`)
- [x] Remove CORS env var `ALLOWED_ORIGINS` from all env files
- [x] Verify `apps/web/src/lib/api.ts` works with the new base URL (no code change expected)

## Phase 4 — Cleanup and verification

- [x] Delete `apps/api`
- [x] Remove `@schedule-core/api` from monorepo `pnpm-workspace.yaml` if listed
- [x] Run `pnpm test` — all 66 tests must pass
- [x] Run `pnpm typecheck` across the monorepo — zero errors
- [x] Run `pnpm build` in `apps/web` — zero errors
- [ ] Manual smoke test: health check, login, service CRUD, availability rules, appointments calendar, staff CRUD, public slots endpoint
