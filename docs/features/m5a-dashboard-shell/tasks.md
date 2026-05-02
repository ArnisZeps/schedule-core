# Tasks: m5a-dashboard-shell

<!-- Never delete tasks. Mark done, append new ones. -->

## 2026-04-30 Initial implementation

### Phase 0 — Setup
- [x] Add runtime deps to apps/web: react-router-dom, @tanstack/react-query
- [x] Add devDeps to apps/web: tailwindcss, postcss, autoprefixer
- [x] Create tailwind.config.js, postcss.config.js, src/index.css; import in main.tsx
- [x] Add devDeps to apps/web: vitest, @testing-library/react, @testing-library/user-event, msw, jsdom
- [x] Configure vitest.config.ts for apps/web (jsdom environment, setupFiles)
- [x] Create src/test/setup.ts (MSW server start/reset/stop lifecycle)
- [x] Create src/test/handlers.ts (MSW request handlers for all M4 API endpoints used)

### Phase 1 — Tests first (present to user before implementing)
- [x] src/test/login.test.tsx — login happy path; invalid credentials error
- [x] src/test/auth-guard.test.tsx — redirect to /login without token; redirect back after login
- [x] src/test/resources.test.tsx — create, edit, delete resource; delete-with-bookings error
- [x] src/test/availability.test.tsx — add window; overlap error; delete window

### Phase 2 — Core infrastructure
- [x] lib/api.ts — apiFetch with auth header injection, ApiError, 401 → logout
- [x] lib/queryClient.ts — QueryClient singleton with global onError
- [x] context/AuthContext.tsx — localStorage JWT, decode, login/logout
- [x] hooks/useAuth.ts

### Phase 3 — Shell
- [x] components/RequireAuth.tsx
- [x] components/AppLayout.tsx + Sidebar.tsx (responsive)
- [x] components/ui/Button.tsx, Input.tsx
- [x] App.tsx route tree
- [x] main.tsx providers

### Phase 4 — Login
- [x] pages/LoginPage.tsx

### Phase 5 — Resources
- [x] hooks/useResources.ts, hooks/useResource.ts
- [x] pages/resources/ResourceListPage.tsx (table, empty state, delete, nav)
- [x] pages/resources/ResourceFormPage.tsx (create + edit)

### Phase 6 — Availability
- [x] hooks/useAvailabilityRules.ts
- [x] pages/resources/AvailabilityPage.tsx (weekly grid, inline add form, delete)

### Phase 7 — Verification
- [x] All RTL tests green (`pnpm --filter web test`)
- [x] pnpm typecheck passes
- [x] Manual check: mobile viewport — sidebar toggle, forms, table layout

### Post-implementation fixes
- [x] Install missing @testing-library/jest-dom devDep; import in setup.ts
- [x] availability.test.tsx delete test: move server.use() override to after initial render (test bug — override was before render so 09:00 never appeared)
- [x] tsconfig.json: add types ["vite/client", "vitest/globals"] for import.meta.env and vi global
- [x] Export AuthContextValue from AuthContext.tsx (TypeScript TS4058)
- [x] ResourceListPage: replace Button+as=Link with styled Link element (invalid prop)
