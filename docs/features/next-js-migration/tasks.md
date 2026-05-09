# Tasks: Next.js Migration

<!-- Never delete tasks. Mark done, append new ones. -->

## Phase 1 — Next.js bootstrap

Replace Vite with Next.js. No feature changes — dev/build/test must work at the end of this phase.

- [ ] Update ADR-003 status to "Superseded by ADR-010"; commit ADR-010
- [ ] Install `next`; remove `vite`, `@vitejs/plugin-react`, `@tailwindcss/vite`
- [ ] Add `@tailwindcss/postcss`; create `postcss.config.mjs`
- [ ] Delete `vite.config.ts` and `index.html`
- [ ] Remove `"type": "module"` from `apps/web/package.json`
- [ ] Update `package.json` scripts: `dev: next dev`, `build: next build`, `start: next start`; remove `preview`
- [ ] Update `tsconfig.json` for App Router: `moduleResolution: bundler`, `jsx: preserve`, add `paths` alias for `@/*`
- [ ] Create `next.config.ts` (minimal — no special options needed)
- [ ] Create `app/layout.tsx` — root HTML shell with font import and global CSS
- [ ] Move `src/index.css` to `app/globals.css`; update import in root layout
- [ ] Rename `VITE_API_URL` → `NEXT_PUBLIC_API_URL` in `src/lib/api.ts` and all `.env*` files
- [ ] Update `vitest.config.ts`: add explicit `environment: 'jsdom'`
- [ ] Verify: `pnpm dev` starts, `pnpm build` succeeds, `pnpm test` passes

## Phase 2 — Marketing home page

Deliver the SEO requirement. The home page is the only thing added in this phase.

- [ ] Create `app/(marketing)/layout.tsx` — public layout (no sidebar, no auth)
- [ ] Create `app/(marketing)/page.tsx` as a Server Component with home page content and `export const metadata`
- [ ] Add `openGraph` fields to root layout metadata (title, description, type)
- [ ] Create `app/robots.ts` — allow all crawlers
- [ ] Create `app/sitemap.ts` — home page URL only
- [ ] Verify: `curl http://localhost:3000` returns full HTML with visible text content (not a blank div)
- [ ] Verify: page `<title>` and `<meta name="description">` are present in the HTML source

## Phase 3 — Auth pages

- [ ] Create `providers/AuthProvider.tsx` as Client Component — extract `AuthContext` from current `App.tsx`; replace `useNavigate` with `useRouter` from `next/navigation`
- [ ] Create `providers/QueryProvider.tsx` as Client Component — `QueryClientProvider` wrapper
- [ ] Mount both providers in `app/layout.tsx`
- [ ] Create `app/(auth)/login/page.tsx` as Client Component — migrate `LoginPage.tsx` content
- [ ] Verify: login flow (email + password → JWT stored → redirect to `/services`) works end to end

## Phase 4 — Dashboard shell

- [ ] Create `app/(dashboard)/layout.tsx` as Client Component — auth guard (reads localStorage, redirects to `/login` if token absent or expired) + renders `AppLayout` + `Sidebar`
- [ ] Delete `src/components/RequireAuth.tsx` — guard is now in the layout
- [ ] Verify: unauthenticated visit to `/services` redirects to `/login`
- [ ] Verify: authenticated visit to `/` redirects to `/services`

## Phase 5 — Dashboard routes

Migrate each route one at a time. Test the route manually after each migration.

- [ ] `app/(dashboard)/services/page.tsx` — migrate `ServiceListPage`
- [ ] `app/(dashboard)/services/new/page.tsx` — migrate `ServiceFormPage` (create mode)
- [ ] `app/(dashboard)/services/[serviceId]/page.tsx` — migrate `ServiceFormPage` (edit mode)
- [ ] `app/(dashboard)/services/[serviceId]/availability/page.tsx` — migrate `AvailabilityPage`
- [ ] `app/(dashboard)/appointments/page.tsx` — migrate `AppointmentsPage`
- [ ] `app/(dashboard)/staff/page.tsx` — migrate `StaffListPage`
- [ ] `app/(dashboard)/staff/new/page.tsx` — migrate `StaffCreatePage`
- [ ] `app/(dashboard)/staff/[staffId]/page.tsx` — migrate `StaffDetailPage`
- [ ] Replace all `react-router-dom` imports (`Link`, `useParams`, `useNavigate`) across migrated pages with `next/link` and `next/navigation` equivalents
- [ ] Remove `react-router-dom` from `apps/web/package.json`
- [ ] Update `components.json`: set `"rsc": true`
- [ ] Run full test suite; fix any failures

## Phase 6 — Cleanup and verification

- [ ] Delete `src/App.tsx` and `src/main.tsx` — entry point is now `app/layout.tsx`
- [ ] Delete any remaining Vite-specific files (`vite-env.d.ts`)
- [ ] Confirm no remaining `react-router-dom` or `VITE_` references in `apps/web/src`
- [ ] Run `pnpm typecheck` from monorepo root — zero errors
- [ ] Run `pnpm build` from monorepo root — zero errors
- [ ] Run `pnpm test` — all tests pass
- [ ] Manual smoke test: home page, login, services CRUD, appointments, staff CRUD
