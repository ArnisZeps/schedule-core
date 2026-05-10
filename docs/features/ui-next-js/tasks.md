# Tasks: Next.js Migration

<!-- Never delete tasks. Mark done, append new ones. -->

## Phase 1 — Next.js bootstrap

Replace Vite with Next.js. No feature changes — dev/build/test must work at the end of this phase.

- [x] Update ADR-003 status to "Superseded by ADR-010"; commit ADR-010
- [x] Install `next`; remove `vite`, `@vitejs/plugin-react`, `@tailwindcss/vite`
- [x] Add `@tailwindcss/postcss`; create `postcss.config.mjs`
- [x] Delete `vite.config.ts` and `index.html`
- [x] Remove `"type": "module"` from `apps/web/package.json`
- [x] Update `package.json` scripts: `dev: next dev`, `build: next build`, `start: next start`; remove `preview`
- [x] Update `tsconfig.json` for App Router: `moduleResolution: bundler`, `jsx: preserve`, add `paths` alias for `@/*`
- [x] Create `next.config.ts` (minimal — no special options needed)
- [x] Create `app/layout.tsx` — root HTML shell with font import and global CSS
- [x] Move `src/index.css` to `app/globals.css`; update import in root layout
- [x] Rename `VITE_API_URL` → `NEXT_PUBLIC_API_URL` in `src/lib/api.ts` and all `.env*` files
- [x] Update `vitest.config.ts`: add explicit `environment: 'jsdom'`
- [x] Verify: `pnpm dev` starts, `pnpm build` succeeds, `pnpm test` passes

## Phase 2 — Marketing home page

Deliver the SEO requirement. The home page is the only thing added in this phase.

- [x] Create `app/(marketing)/layout.tsx` — public layout (no sidebar, no auth)
- [x] Create `app/(marketing)/page.tsx` as a Server Component with home page content and `export const metadata`
- [x] Add `openGraph` fields to root layout metadata (title, description, type)
- [x] Create `app/robots.ts` — allow all crawlers
- [x] Create `app/sitemap.ts` — home page URL only
- [x] Verify: `curl http://localhost:3000` returns full HTML with visible text content (not a blank div)
- [x] Verify: page `<title>` and `<meta name="description">` are present in the HTML source

## Phase 3 — Auth pages

- [x] Create `providers/AuthProvider.tsx` as Client Component — extract `AuthContext` from current `App.tsx`; replace `useNavigate` with `useRouter` from `next/navigation`
- [x] Create `providers/QueryProvider.tsx` as Client Component — `QueryClientProvider` wrapper
- [x] Mount both providers in `app/layout.tsx`
- [x] Create `app/(auth)/login/page.tsx` as Client Component — migrate `LoginPage.tsx` content
- [x] Verify: login flow (email + password → JWT stored → redirect to `/services`) works end to end

## Phase 4 — Dashboard shell

- [x] Create `app/(dashboard)/layout.tsx` as Client Component — auth guard (reads localStorage, redirects to `/login` if token absent or expired) + renders `AppLayout` + `Sidebar`
- [x] Delete `src/components/RequireAuth.tsx` — guard is now in the layout
- [x] Verify: unauthenticated visit to `/services` redirects to `/login`
- [x] Verify: authenticated visit to `/` redirects to `/services`

## Phase 5 — Dashboard routes

Migrate each route one at a time. Test the route manually after each migration.

- [x] `app/(dashboard)/services/page.tsx` — migrate `ServiceListPage`
- [x] `app/(dashboard)/services/new/page.tsx` — migrate `ServiceFormPage` (create mode)
- [x] `app/(dashboard)/services/[serviceId]/page.tsx` — migrate `ServiceFormPage` (edit mode)
- [x] `app/(dashboard)/services/[serviceId]/availability/page.tsx` — migrate `AvailabilityPage`
- [x] `app/(dashboard)/appointments/page.tsx` — migrate `AppointmentsPage`
- [x] `app/(dashboard)/staff/page.tsx` — migrate `StaffListPage`
- [x] `app/(dashboard)/staff/new/page.tsx` — migrate `StaffCreatePage`
- [x] `app/(dashboard)/staff/[staffId]/page.tsx` — migrate `StaffDetailPage`
- [x] Replace all `react-router-dom` imports (`Link`, `useParams`, `useNavigate`) across migrated pages with `next/link` and `next/navigation` equivalents
- [x] Remove `react-router-dom` from `apps/web/package.json`
- [x] Update `components.json`: set `"rsc": true`
- [x] Run full test suite; fix any failures

## Phase 6 — Cleanup and verification

- [x] Delete `src/App.tsx` and `src/main.tsx` — entry point is now `app/layout.tsx`
- [x] Delete any remaining Vite-specific files (`vite-env.d.ts`)
- [x] Confirm no remaining `react-router-dom` or `VITE_` references in `apps/web/src`
- [x] Run `pnpm typecheck` from monorepo root — zero errors
- [x] Run `pnpm build` from monorepo root — zero errors
- [x] Run `pnpm test` — all tests pass
- [ ] Manual smoke test: home page, login, services CRUD, appointments, staff CRUD
