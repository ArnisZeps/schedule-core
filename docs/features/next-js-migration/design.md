# Design: Next.js Migration

## Problem

`apps/web` is a Vite SPA. The marketing home page needs to be server-rendered for Google indexability. Future public booking pages (M7/M8) share the same requirement. Next.js App Router supports SSR and CSR in the same app via Server Components and Client Components — no special configuration per route. See ADR-010 for the structural decision.

## App Router structure

```
apps/web/
  app/
    layout.tsx                          # Root layout — fonts, global CSS, providers
    (marketing)/
      layout.tsx                        # Public layout — no auth, no sidebar
      page.tsx                          # Home page — Server Component, SSR
    (auth)/
      login/
        page.tsx                        # Login page — Client Component
    (dashboard)/
      layout.tsx                        # Dashboard layout — client auth guard + AppLayout
      services/
        page.tsx                        # ServiceListPage
        new/
          page.tsx                      # ServiceFormPage (create)
        [serviceId]/
          page.tsx                      # ServiceFormPage (edit)
          availability/
            page.tsx                    # AvailabilityPage
      appointments/
        page.tsx                        # AppointmentsPage
      staff/
        page.tsx                        # StaffListPage
        new/
          page.tsx                      # StaffCreatePage
        [staffId]/
          page.tsx                      # StaffDetailPage
  providers/
    AuthProvider.tsx                    # "use client" — AuthContext + localStorage JWT
    QueryProvider.tsx                   # "use client" — QueryClientProvider wrapper
  src/
    components/                         # Unchanged — all become Client Components
    hooks/                              # Unchanged
    lib/                                # Unchanged (NEXT_PUBLIC_API_URL replaces VITE_API_URL)
```

## Components

| File | Responsibility |
|------|----------------|
| `app/layout.tsx` | Root HTML shell, global CSS import, font, provider tree |
| `app/(marketing)/page.tsx` | Home page — Server Component, `next/metadata`, static content |
| `app/(auth)/login/page.tsx` | Login form — thin wrapper around existing `LoginPage` content |
| `app/(dashboard)/layout.tsx` | Client Component — reads JWT from localStorage, redirects to `/login` if absent or expired; renders `AppLayout` |
| `providers/AuthProvider.tsx` | `AuthContext` extracted from `AuthLayout` in `App.tsx`; `useRouter` replaces `useNavigate` |
| `providers/QueryProvider.tsx` | `QueryClientProvider` wrapper; must be a Client Component |
| `app/robots.txt` | Static file or `app/robots.ts` dynamic route |
| `app/sitemap.ts` | Dynamic sitemap — home page only for now |

All existing components under `src/components/`, `src/hooks/`, and `src/lib/` are unchanged. They operate as Client Components implicitly (dashboard layout marks everything below it as client).

## Auth guard pattern

`(dashboard)/layout.tsx` is a Client Component:

```
"use client"
// reads localStorage on mount
// if no valid token → router.replace('/login')
// renders children only when authenticated
```

This is the same logic as the current `RequireAuth` component, lifted into the layout. No changes to ADR-007 — no cookies, no middleware.

`AuthProvider` wraps the dashboard layout and provides `AuthContext`. `useNavigate` → `useRouter` from `next/navigation`.

## Key mechanical changes

| Before | After |
|--------|-------|
| `react-router-dom` `Link` | `next/link` `Link` |
| `useNavigate()` | `useRouter()` from `next/navigation` |
| `useParams()` from react-router-dom | `useParams()` from `next/navigation` |
| `vite.config.ts` | `next.config.ts` |
| `@tailwindcss/vite` | `@tailwindcss/postcss` in `postcss.config.mjs` |
| `VITE_API_URL` | `NEXT_PUBLIC_API_URL` |
| `"type": "module"` in package.json | removed |
| `scripts.dev: vite` | `scripts.dev: next dev` |
| `scripts.build: tsc && vite build` | `scripts.build: next build` |
| `scripts.preview` | `scripts.start: next start` |

## SEO surface (home page)

The `(marketing)/page.tsx` Server Component exports `metadata` via `next/metadata`:

- `title` — product name + tagline
- `description` — one-sentence pitch
- `openGraph.title`, `openGraph.description`, `openGraph.type: website`

`app/sitemap.ts` returns the home page URL. `app/robots.ts` allows all crawlers.

No dynamic metadata, no structured data (JSON-LD) in this milestone — that is Phase 7.

## Tailwind v4 with Next.js

`apps/web` uses Tailwind v4 (`@tailwindcss/vite: ^4.2.4`). With Next.js, the Vite plugin is replaced by the PostCSS plugin:

```
// postcss.config.mjs
export default { plugins: { '@tailwindcss/postcss': {} } }
```

No `tailwind.config.js` needed — Tailwind v4 reads configuration from `index.css` (unchanged).

## shadcn/ui

`components.json` requires one change: `"rsc": true`. Components already in `src/components/ui/` are unchanged — they work as Client Components. No need to re-run `npx shadcn add`.

## Test suite

Vitest + RTL + MSW are unchanged. `vitest.config.ts` needs explicit `environment: 'jsdom'` (previously inferred from Vite config). All existing tests remain valid — they test components in isolation, not Next.js routing.

## Rejected alternatives

**Cookie-based auth + Next.js middleware** — cleaner redirect pattern (no client-side flash), but requires JWT in a `httpOnly` cookie, contradicting ADR-007. Deferred.

**`app/api/` routes** — no reason to add a Next.js API layer when Express already handles all API traffic.

**Separate `apps/marketing`** — ruled out in ADR-010.

## Trade-offs accepted

- Dashboard auth guard has a brief client-side render flash before redirect (same as current `RequireAuth` behaviour). Acceptable for an authenticated-only app.
- `next dev` cold start is slower than `vite`. Acceptable.
- `.next/` output requires a Node.js server (not static hosting). Acceptable — the Express API already requires a server.

## Out of scope

- Public booking pages (`(public)` route group) — delivered in M7/M8.
- Cookie-based auth or middleware route guards.
- Blog, pricing page, or any marketing page beyond the home page.
- Next.js API routes.
- CI/CD deployment pipeline changes — noted as a consequence but not implemented here.

## Edge cases

- `localStorage` is not available in Server Components. The dashboard layout guard runs only in a Client Component (`"use client"`); no change needed.
- `next-themes` is already a dependency and is Next.js-aware — no changes needed.
- Dynamic route `[serviceId]` and `[staffId]` — `useParams()` from `next/navigation` returns the same shape as `react-router-dom`'s `useParams()` for single string params. Drop-in replacement.
