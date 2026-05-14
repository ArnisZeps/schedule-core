# Design: fix-logout-crash

## Problem

When a user clicks logout, `AuthProvider.logout()` does two things synchronously:
1. Sets `user` to `null` in React state
2. Calls `router.replace('/login')` (async — navigation completes later)

Because navigation is asynchronous, the current page remains mounted and React re-renders it with `user = null`. `DashboardLayout` has a local `authenticated` boolean that is set to `true` once on mount and never cleared — it does not react to `AuthContext.user` becoming `null`. So it continues rendering its children, which call hooks such as `useStaff`, `useServices`, etc. Those hooks use `user!.tenantId` (non-null assertion). The assertion blows up, producing a RuntimeTypeError before navigation completes.

## Components

| File | Responsibility |
|------|----------------|
| `apps/web/app/(dashboard)/layout.tsx` | Replaces one-shot `authenticated` local state with a reactive guard on `useAuth().user`. Returns `null` (and triggers redirect) when `user` is null, preventing children from mounting at all. |

## Contracts

No API, schema, or hook interface changes. The `AuthContext` contract (`user: User | null`) is unchanged.

## Approach

Replace the manual localStorage check in `DashboardLayout` with a reactive approach using `useAuth()`:

1. Read `user` from `useAuth()`.
2. Keep a `hydrated` boolean (initialized `false`, set to `true` in a one-time `useEffect`) to avoid SSR/hydration mismatch — same intent as the original `authenticated` state, but separate from auth.
3. A second `useEffect` watches `[hydrated, user]`: when hydrated and `user` is null, call `router.replace('/login')`.
4. Return `null` when `!hydrated || !user`, preventing any child component (and its hooks) from mounting.
5. Render `<AppLayout>{children}</AppLayout>` only when both `hydrated` and `user` are truthy.

This means dashboard children are unmounted the instant `user` becomes null — before navigation completes — so no hook with `user!.tenantId` can run against a null user.

## Rejected alternatives

**Make every hook defensive (`enabled: !!user`)** — treats the symptom at 7+ call sites, not the root cause. The layout is the correct guard; patching hooks makes them silently do nothing instead of surfacing the real invariant violation. Also requires ongoing discipline as new hooks are added.

**Set `authenticated = false` in a logout callback / event listener** — indirect; introduces coordination coupling between `DashboardLayout` and `AuthProvider` beyond the existing context.

## Trade-offs accepted

The `DashboardLayout` now depends on `useAuth()`, coupling it to `AuthContext`. This is appropriate — the layout's only job is to guard the authenticated region.

## Out of scope

- Fixing individual hooks to guard against null user (not needed if the layout is correct)
- Token refresh or revocation (ADR-007: explicitly deferred post-MVP)
- Cookie-based auth (ADR-007: post-MVP hardening)

## Edge cases

- **SSR / first client render**: `useAuth()` returns `user` from `useState(readUser)`. `readUser()` returns `null` on the server (no `window`). The `hydrated` flag ensures the component returns `null` on the first render on both server and client, avoiding hydration mismatch. After hydration, the layout re-evaluates.
- **Expired token on page load**: `readUser()` returns `null` for expired tokens, so `user` is null from the start → layout redirects to `/login`.
- **User on non-staff page at logout**: Same fix applies — all dashboard routes use this layout.
