# ADR 010 — Frontend Framework: Next.js App Router

**Date:** 2026-05-09
**Status:** Proposed
**Supersedes:** ADR-003

## Context

ADR-003 chose Vite + React SPA, reasoning that SSR was unnecessary for an authenticated dashboard and would add deployment complexity with no SEO benefit. That reasoning remains valid for the dashboard.

Two new requirements have since emerged:

1. **Marketing SEO** — business owners must find ScheduleCore via Google search. A pure SPA renders a blank `<div id="root">` on first load; crawlers index it poorly.
2. **Public booking pages** — M7/M8 introduce client-facing booking flows at `/book/:tenantSlug`. These are public URLs that benefit from SSR (fast first paint for clients, potential indexability of business booking pages).

Both requirements point to SSR on specific routes, not globally.

Two structural options were evaluated:

**Option A — Separate `apps/marketing`** (Astro alongside existing `apps/web`):
Astro is the better static-site tool (zero JS by default, purpose-built for content pages), but it introduces two frontend codebases, two deployments, and link coordination between them. Because M7/M8 public booking pages live inside `apps/web`, a separate marketing app solves only the home page need and still leaves M7/M8 as a SPA. Doing both would require a Next.js migration anyway — just later and under more pressure.

**Option B — Migrate `apps/web` from Vite to Next.js App Router**:
One app, one deployment. App Router natively supports both SSR (Server Components) and CSR (Client Components) in the same project. Marketing pages and future public booking pages become Server Components. Dashboard pages remain Client Components — identical in behaviour to the current SPA.

## Decision

Replace Vite in `apps/web` with **Next.js 15 App Router**.

Route groups define the rendering boundary:

- `(marketing)` — Server Components. Rendered server-side, fully indexable.
- `(public)` — Server Components. Public booking widget (M7/M8), no auth required.
- `(auth)` — Client Components. Login page; no SSR value.
- `(dashboard)` — Client Components. Behaviour identical to the current SPA.

ADR-003's reasoning for the dashboard holds in full. SSR is applied only where it delivers concrete value.

**Auth strategy (ADR-007) is unchanged.** JWT is stored in `localStorage`, transported as `Authorization: Bearer`. Auth guards are client-side checks inside the dashboard layout. No cookie transport or Next.js middleware auth is introduced — that would contradict ADR-007 and is deferred.

**API and CORS (ADR-008) are unchanged.** Express handles all API traffic. No Next.js API routes are added.

## Rejected alternatives

**Separate `apps/marketing` (Astro)** — solves the home page SEO need but leaves M7/M8 public booking pages as a SPA. Defers the migration problem rather than resolving it.

**Middleware-based auth guards** — requires JWT in a `httpOnly` cookie. Contradicts ADR-007. Deferred to a future ADR.

## Consequences

- `react-router-dom` removed. Routing is file-based. `useNavigate` → `useRouter` (`next/navigation`). `useParams` → `useParams` (`next/navigation`). `Link` → `next/link`.
- `vite`, `@vitejs/plugin-react`, `@tailwindcss/vite` removed. `next`, `@tailwindcss/postcss` added.
- `"type": "module"` removed from `apps/web/package.json` — conflicts with Next.js build system.
- `VITE_API_URL` → `NEXT_PUBLIC_API_URL` in all `apps/web` source files and `.env` files.
- `components.json` updated: `"rsc": true` to enable React Server Component support in shadcn/ui.
- Build output changes from `dist/` to `.next/`. Deployment configuration must be updated when deploying.
- Vitest + RTL + MSW test setup is unchanged. Component tests are framework-agnostic and do not require the Next.js runtime.
- `localStorage` access remains exclusively in Client Components and `useEffect`. The current codebase already satisfies this invariant.
