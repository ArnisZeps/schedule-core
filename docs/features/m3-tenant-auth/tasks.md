# Tasks: M3 - Tenant Auth

<!-- Never delete tasks. Mark done, append new ones. -->

## 2026-04-15 Initial implementation

### Database

- [x] Write `packages/db/migrations/0002_tenant_auth.sql`:
  - Create `users` table (id, tenant_id FK, email UNIQUE, password_hash, created_at)
  - Create `schedulecore_app` role with minimal grants (SELECT/INSERT/UPDATE/DELETE on all tables; USAGE on sequences)
  - Apply `FORCE ROW LEVEL SECURITY` to `resources`, `availability_rules`, `bookings`
- [x] Run migration against dev Neon branch and verify schema

### API dependencies

- [x] Add `bcryptjs`, `jsonwebtoken`, `zod` to `apps/api` dependencies
- [x] Add `@types/bcryptjs`, `@types/jsonwebtoken` to `apps/api` devDependencies

### Library modules (write tests first)

- [x] Write unit tests for `apps/api/src/lib/password.ts` (`hashPassword`, `verifyPassword`)
- [x] Implement `apps/api/src/lib/password.ts`
- [x] Write unit tests for `apps/api/src/lib/jwt.ts` (`signToken`, `verifyToken`, startup guard for missing `JWT_SECRET`)
- [x] Implement `apps/api/src/lib/jwt.ts`

### Middleware (write tests first)

- [x] Write unit tests for `apps/api/src/middleware/auth.ts` (valid token, expired, malformed, missing header)
- [x] Implement `apps/api/src/middleware/auth.ts`
- [x] Write unit tests for `apps/api/src/middleware/tenant-context.ts` (`withTenantContext` sets `app.current_tenant_id` inside transaction)
- [x] Implement `apps/api/src/middleware/tenant-context.ts`

### Routes (write integration tests first)

- [x] Write integration tests for `POST /auth/signup` (success 201, duplicate email 409, duplicate slug 409, reserved slug 422, validation 422)
- [x] Write integration tests for `POST /auth/login` (success 200, wrong password 401, unknown email 401)
- [x] Implement `apps/api/src/routes/auth.ts`
- [x] Register auth router in `apps/api/src/app.ts` (or equivalent entry point)

### Environment

- [x] Add `JWT_SECRET` to `.env.example` with a placeholder value and a comment
- [x] Update `docs/db/data-model.md` to include the `users` table
