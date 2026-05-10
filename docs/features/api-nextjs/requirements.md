# Requirements: api-nextjs-migration

## User stories

- As a developer, I want to run a single `next dev` process in development, so that I don't need to manage two terminals and two ports.
- As a developer, I want to deploy one application to hosting, so that I don't need to coordinate two separate process deployments.
- As a developer, I want to add new API endpoints in the same codebase as the UI pages that consume them, so that I can iterate on M7/M8 features without cross-repo coordination.

## Acceptance criteria

- [ ] All existing API endpoints are available at `/api/*` (e.g. `POST /api/auth/login`, `GET /api/tenants/:id/services`).
- [ ] The public booking endpoint is available at `/api/public/:tenantSlug/*`.
- [ ] All 66 existing web tests continue to pass without modification.
- [ ] `pnpm typecheck` reports zero errors across the monorepo.
- [ ] `pnpm build` in `apps/web` succeeds with no errors.
- [ ] Login, service CRUD, availability CRUD, appointments, and staff CRUD all work end-to-end in the browser.
- [ ] The `apps/api` directory is deleted.
- [ ] No `react-router-dom`, `VITE_`, or Express imports remain in `apps/web/src`.
- [ ] The in-memory rate limiter is removed; a TODO comment marks where Upstash Rate Limit should be added before M7.
- [ ] ADR-011 is written and cross-references ADR-002, ADR-008, and ADR-010.
