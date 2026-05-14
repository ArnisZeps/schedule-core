# Design: persistent-auth-session

## Problem

Four independent causes combine to make the session feel non-persistent:

1. **7-day JWT expiry** (`apps/web/src/lib/server/jwt.ts`, `signToken`). Tokens expire after one week, requiring full re-authentication. For a business tool used regularly, this is disruptive.

2. **`apiFetch` silently clears the token on any 401** (`apps/web/src/lib/api.ts:23-24`). During development the `JWT_SECRET` may differ between server restarts, rendering stored tokens invalid and triggering token removal with a hard redirect to `/login` on the first API call after restart.

3. **Logout crash (separate spec: fix-logout-crash)** — `localStorage.removeItem` runs before the React crash, so the token is gone even if navigation did not complete, making the crash look like an unexplained logout.

4. **Auth routing is one-way.** The dashboard layout blocks unauthenticated users and redirects them to `/login`. The reverse is not implemented: authenticated users who land on `/` or `/login` (e.g. after reopening the browser) are not redirected to the dashboard. They see a "Sign in" button and must click it, which feels like a forced logout even though the token is still valid in `localStorage`.

Items 1 and 4 are the production-visible causes. Item 2 is a development friction issue. Item 3 is covered by [[fix-logout-crash]].

## Components

| File | Responsibility |
|------|----------------|
| `apps/web/src/lib/server/jwt.ts` | Change `expiresIn` from `'7d'` to read from `JWT_EXPIRY` env var, defaulting to `'30d'` |
| `apps/web/src/components/UnauthenticatedOnly.tsx` | Client component — the symmetric counterpart of `DashboardLayout`. Uses `useAuth()` + a `hydrated` flag (same pattern). Returns `null` until hydrated; returns `null` (and triggers redirect) when `user` is non-null; renders `children` only when hydrated and `user` is null. This prevents any flash of public-page content for authenticated users because nothing is painted until auth state is known. |
| `apps/web/app/(marketing)/page.tsx` | Wrap the entire page content in `<UnauthenticatedOnly redirectTo="/services">`. Keeps server component structure (metadata export intact). |
| `apps/web/src/page-components/LoginPage.tsx` | Wrap the form container in `<UnauthenticatedOnly redirectTo="/services">`. |

## Contracts

JWT payload shape is unchanged: `{ sub, tenantId, iat, exp }`. Only the value of `exp` changes (30 days instead of 7 days from issue time).

## Rejected alternatives

**Token refresh / sliding sessions** — ADR-007 explicitly rejected refresh tokens for MVP (requires token store or Redis, adds client complexity). Not in scope.

**Cookie-based auth with long-lived HttpOnly cookie** — ADR-007 flags this as a post-MVP hardening task. Not in scope.

**Hard-coding 30d** — Rejected in favour of `JWT_EXPIRY` env var so that staging/prod can be tuned without a code change.

## Trade-offs accepted

Longer-lived tokens have a wider theft window. ADR-007 acknowledges the XSS / localStorage risk as accepted for MVP. A 30-day token increases the blast radius of a stolen token compared to 7 days, but remains acceptable for MVP given the existing constraint.

Token revocation remains out of scope (ADR-007: no blocklist for MVP). A stolen 30-day token cannot be invalidated until expiry.

## Out of scope

- Refresh tokens
- "Remember me" UI toggle (all sessions are 30 days; different durations are post-MVP)
- Cookie migration
- Token revocation

## Edge cases

- **Existing 7-day tokens in localStorage**: remain valid until their original `exp`. Users with tokens issued before this change will not be affected until those tokens expire normally.
- **Dev environment JWT_SECRET instability**: `JWT_EXPIRY` change does not fix item 2. This is a known friction point in local dev but not a production issue; no code change is warranted.
