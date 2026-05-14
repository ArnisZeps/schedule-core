# Tasks: persistent-auth-session

<!-- Never delete tasks. Mark done, append new ones. -->

## 2026-05-14 Initial implementation

- [x] Write unit test: `signToken` issues a token that decodes to an expiry ≥ 30 days from now
- [x] Write unit test: `signToken` respects `JWT_EXPIRY` env var when set
- [x] Present failing tests for approval
- [x] Update `apps/web/src/lib/server/jwt.ts` — read expiry from `JWT_EXPIRY` env var, default `'30d'`
- [x] Update `docs/domains/auth.md` — JWT payload section: note expiry is 30 days (configurable via `JWT_EXPIRY`)

## 2026-05-14 Auth routing — reverse direction (item 4)

- [x] Write RTL test: `UnauthenticatedOnly` renders children and does not redirect when there is no valid token
- [x] Write RTL test: `UnauthenticatedOnly` renders nothing and redirects when a valid token is present
- [x] Present failing tests for approval
- [x] Create `apps/web/src/components/UnauthenticatedOnly.tsx`
- [x] Wrap `apps/web/app/(marketing)/page.tsx` content in `<UnauthenticatedOnly redirectTo="/services">`
- [x] Wrap `apps/web/src/page-components/LoginPage.tsx` form in `<UnauthenticatedOnly redirectTo="/services">`
- [x] Update `docs/domains/auth.md` — Frontend > Routes section: note that `/` and `/login` redirect authenticated users to `/services`
