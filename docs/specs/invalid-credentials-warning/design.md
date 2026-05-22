# Design: Invalid Credentials Warning

## Problem

`LoginPage.tsx` already renders `form.formState.errors.root` — the UI slot for the error exists. Two bugs prevent the error from ever appearing:

**Bug 1 — redirect loop kills the error state.**
`apiFetch` calls `window.location.replace('/login')` on any 401 response. On the login page, a 401 from `POST /api/auth/login` (invalid credentials) triggers this, navigating away before React can commit the `form.setError('root', …)` update. The user sees the login page reload with no message.

**Bug 2 — wrong error message even if redirect were skipped.**
The API returns `{ "error": "invalid_credentials" }`. `apiFetch` reads `body.message ?? res.statusText`. Since `body.message` is undefined, the `ApiError` carries `res.statusText` ("Unauthorized") — not user-friendly.

Both bugs must be fixed together. Fixing only Bug 2 still produces a silent reload.

## Components

| File | Change |
|------|--------|
| `apps/web/src/lib/api.ts` | Skip the `window.location.replace('/login')` redirect when `window.location.pathname === '/login'`. The redirect is designed for expired-session 401s on authenticated pages; it is wrong for the login form itself. |
| `apps/web/src/page-components/LoginPage.tsx` | In the `catch` block, check for `ApiError` with `status === 401` and set root error to the fixed string `"Incorrect email or password."`. All other errors keep the existing `"Login failed"` fallback. |

No new files. No new components. No API changes.

## Contracts

No changes to the API contract. `POST /api/auth/login` already returns `401 { "error": "invalid_credentials" }` for both unknown email and wrong password (no enumeration). The frontend now surfaces this correctly.

## Rejected alternatives

**Add `skipAuthRedirect` option to `apiFetch`.**
More interface surface for a single narrow case. The login page is the only place where being on `/login` and receiving a 401 is intentional; checking `window.location.pathname` covers it without changing the call sites.

**Use raw `fetch` in `LoginPage` instead of `apiFetch`.**
Inconsistent with the rest of the codebase. `apiFetch` handles `Content-Type`, `credentials: 'include'`, and error parsing — discarding that for one form is wrong.

**Change the API to return `{ "message": "..." }` instead of `{ "error": "..." }`.**
The API response shape is part of the domain contract. The fix belongs on the frontend, which knows what a 401 means on this endpoint.

**Fix `apiFetch` to also read `body.error` as a message fallback.**
Not needed — the login form hard-codes the user-facing string for 401. Changing `apiFetch`'s body parsing is a wider change with unclear benefits elsewhere.

## Trade-offs accepted

Using `window.location.pathname === '/login'` inside `apiFetch` is a mild coupling of a generic utility to a specific route name. The alternative (a flag on every auth call site) is more ceremony for the same outcome.

## Out of scope

- Register page: signup errors are `409` / `422`, no 401 case exists.
- Server-side changes: none required.
- Showing field-level errors (which field is wrong): the API intentionally withholds this.
- Password visibility toggle or "forgot password" flow.

## Edge cases

| Case | Handling |
|------|----------|
| Network failure (fetch throws, not an `ApiError`) | `"Login failed"` fallback — unchanged from current behavior |
| Server returns 401 with no parseable body | `ApiError.message` falls back to `res.statusText`; login form shows `"Incorrect email or password."` anyway (catches by status code, not message content) |
| `window` undefined (SSR) | `LoginPage` is a Client Component (`'use client'`) — `window` is always defined when this code runs |
| User retries immediately | `form.setError` from previous attempt is overwritten by next submit; `isSubmitting` disables the button during in-flight request |
