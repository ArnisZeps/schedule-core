# Tasks: M4 — Core API Surface

<!-- Never delete tasks. Mark done, append new ones. -->

## 2026-04-26 Initial implementation

### Preparation
- [x] Read M3 implementation: `apps/api/src/middleware/auth.ts`, `middleware/tenant-context.ts`, `routes/auth.ts` — identify reusable error handling patterns and confirm `req.auth` shape

### Tests (write first — present to user and wait for approval before implementing)
- [x] Integration tests: tenant CRUD (`GET`, `PATCH`, `DELETE`) — incl. slug conflict, has_bookings block, forbidden/not_found → `src/routes/tenants.test.ts`
- [x] Integration tests: service CRUD — incl. has_bookings block, cross-tenant 404 → `src/routes/services.test.ts`
- [x] Integration tests: availability rule CRUD — incl. overlap rejection, `startTime >= endTime` rejection, cross-tenant 404 → `src/routes/availability-rules.test.ts`

### Implementation (after test approval)
- [x] `apps/api/src/routes/tenants.ts` — `GET /tenants/:id`, `PATCH /tenants/:id`, `DELETE /tenants/:id`
- [x] `apps/api/src/routes/services.ts` — full CRUD under `/tenants/:tenantId/services`
- [x] `apps/api/src/routes/availability-rules.ts` — full CRUD under `/tenants/:tenantId/services/:serviceId/availability-rules`; overlap check helper
- [x] Register all routers in `apps/api/src/app.ts`

### Fixes applied during implementation
- [x] `withTenantContext`: replaced `SET LOCAL app.current_tenant_id = $1` (invalid parameterized SET) with `SELECT set_config('app.current_tenant_id', $1, true)`
- [x] `vitest.config.ts`: added `fileParallelism: false` to prevent TRUNCATE collisions between parallel test files
- [x] `auth.test.ts`: replaced `DELETE FROM users/tenants` cleanup with `TRUNCATE ... CASCADE`
- [x] `services.ts` GET /:id: added `AND tenant_id = $2` to WHERE clause for explicit cross-tenant isolation
