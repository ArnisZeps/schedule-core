# Design: m5a-dashboard-shell

## Problem

M4 delivered a fully working REST API (auth, resources, availability rules) with no UI. M5a adds the
authenticated web shell that business owners use to manage their account — the foundation all subsequent
owner-facing features build on. The UI must be responsive (phones are primary for small businesses) and
establish component and data-fetching patterns that the rest of the dashboard can follow without rework.

## New dependencies (apps/web)

| Package | Kind | Purpose |
|---------|------|---------|
| react-router-dom | runtime | client-side routing (named in ADR-003) |
| @tanstack/react-query | runtime | server-state: fetch, cache, loading/error (named in ADR-003) |
| tailwindcss | devDep | utility CSS |
| postcss | devDep | Tailwind pipeline |
| autoprefixer | devDep | vendor prefixes |

## Components

| File | Responsibility |
|------|----------------|
| `apps/web/src/App.tsx` | `createBrowserRouter` route tree |
| `apps/web/src/main.tsx` | Mount `QueryClientProvider` → `RouterProvider`; `AuthProvider` inside router |
| `apps/web/src/lib/api.ts` | `apiFetch<T>`: reads token from `AuthContext`, injects `Authorization` header, throws `ApiError` on non-2xx, calls `logout()` + redirect on 401 |
| `apps/web/src/lib/queryClient.ts` | Singleton `QueryClient`; global `onError` triggers logout on 401 |
| `apps/web/src/context/AuthContext.tsx` | Reads/writes JWT in `localStorage`; decodes payload (no sig verify — API enforces); exposes `{ user, token, login, logout }` |
| `apps/web/src/components/RequireAuth.tsx` | Reads `AuthContext.user`; if null or token expired, `<Navigate to="/login" state={{ next: location }} />` |
| `apps/web/src/components/AppLayout.tsx` | Responsive shell: sidebar + `<Outlet>`; header with hamburger on mobile |
| `apps/web/src/components/Sidebar.tsx` | Nav links (Resources); collapses to slide-over on mobile |
| `apps/web/src/components/ui/Button.tsx` | Tailwind button with `variant` prop (primary / secondary / danger) |
| `apps/web/src/components/ui/Input.tsx` | Labelled input with inline error display |
| `apps/web/src/hooks/useAuth.ts` | `useContext(AuthContext)` with null-guard throw |
| `apps/web/src/hooks/useResources.ts` | `useQuery` for list; `useMutation` for create / update / delete |
| `apps/web/src/hooks/useResource.ts` | `useQuery` for single resource by id |
| `apps/web/src/hooks/useAvailabilityRules.ts` | `useQuery` for list; `useMutation` for create / delete |
| `apps/web/src/pages/LoginPage.tsx` | Email + password form → `POST /auth/login` → `login(token)` → redirect |
| `apps/web/src/pages/resources/ResourceListPage.tsx` | Table: name, description, edit link, delete action, availability link |
| `apps/web/src/pages/resources/ResourceFormPage.tsx` | Create (no `:resourceId`) and edit (`:resourceId` present) in one component |
| `apps/web/src/pages/resources/AvailabilityPage.tsx` | Weekly grid; inline add-window form; delete per row |

## Routes

```
/login                                → LoginPage (public)
/                                     → <Navigate to="/resources" />
/resources                            → RequireAuth → AppLayout → ResourceListPage
/resources/new                        → RequireAuth → AppLayout → ResourceFormPage (create)
/resources/:resourceId                → RequireAuth → AppLayout → ResourceFormPage (edit)
/resources/:resourceId/availability   → RequireAuth → AppLayout → AvailabilityPage
*                                     → 404 page
```

## Contracts

No new API endpoints. All calls use the M4 API; the tenant id comes from the decoded JWT.

```ts
// AuthContext
interface User { userId: string; tenantId: string; exp: number }
interface IAuthContext { user: User | null; token: string | null; login(token: string): void; logout(): void }

// api.ts
class ApiError extends Error { constructor(public status: number, message: string) {} }
async function apiFetch<T>(path: string, init?: RequestInit): Promise<T>
// Base URL: import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

// API calls used
// POST   /auth/login                                              → { token }
// GET    /tenants/:id/resources                                   → Resource[]
// POST   /tenants/:id/resources                                   → Resource
// GET    /tenants/:id/resources/:resourceId                       → Resource
// PATCH  /tenants/:id/resources/:resourceId                       → Resource
// DELETE /tenants/:id/resources/:resourceId                       → 204
// GET    /tenants/:id/resources/:resourceId/availability-rules    → Rule[]
// POST   /tenants/:id/resources/:resourceId/availability-rules    → Rule
// DELETE /tenants/:id/resources/:resourceId/availability-rules/:ruleId → 204
```

## Tailwind setup

Three config files added to `apps/web/`:
- `tailwind.config.js` — content: `['./index.html', './src/**/*.{ts,tsx}']`
- `postcss.config.js` — plugins: tailwindcss, autoprefixer
- `src/index.css` — `@tailwind base; @tailwind components; @tailwind utilities;`

`index.css` imported in `main.tsx`.

## Rejected alternatives

- **Next.js / SSR**: Already rejected in ADR-003. No SEO need for an authenticated dashboard.
- **Shadcn/ui**: More components than needed at this stage; adds setup overhead. Plain Tailwind primitives keep the bundle lean.
- **TanStack Router**: Stronger TypeScript but more boilerplate. react-router-dom is explicitly named in ADR-003.
- **localStorage alternatives (httpOnly cookie)**: Requires CSRF protection and backend cookie-setting changes. Out of scope for MVP; JWT in localStorage is the simplest path.
- **Plain fetch + useState**: Manual loading/error/stale tracking in every component. TanStack Query eliminates this boilerplate.

## Trade-offs accepted

- JWT in localStorage: XSS risk accepted for MVP. Cookie-based auth is a hardening task post-MVP.
- No token refresh: 7-day expiry from ADR-007. Users re-login on expiry. No refresh token workflow.
- No optimistic updates: mutations wait for server confirmation. Simpler error handling.
- Minimal UI primitives: Button and Input only. No date picker, modal library, or toast system.

## Out of scope

- Tenant settings page (name/slug editing) — deferred.
- Appointment calendar and list (M5b).
- Manual appointment entry (M6).
- Any public-facing or client-facing pages.
- Toast/notification system — inline error messages only.
- True end-to-end browser tests — RTL + MSW covers user-visible behaviour without a real browser.

## Edge cases

| Scenario | Handling |
|----------|----------|
| Token expires mid-session | `apiFetch` throws `ApiError(401)` → global `onError` calls `logout()` + redirects to `/login` |
| Availability rule overlap | API returns 409; `AvailabilityPage` shows server message inline |
| Delete resource with bookings | API returns 409; `ResourceListPage` shows server message inline |
| Submit while mutation pending | Submit button disabled while `isPending` is true |
| Empty resource list | "No resources yet — add one" empty state with CTA |
| Mobile navigation | Sidebar hidden; hamburger in header toggles slide-over overlay |
| Back navigation after delete | TanStack Query invalidates the list query; list re-fetches on focus |
