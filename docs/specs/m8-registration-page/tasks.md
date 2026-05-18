# Tasks: M8 - Registration Page

<!-- Never delete tasks. Mark done, append new ones. -->

## 2026-05-16 Initial implementation

- [x] Write RTL tests for `RegisterPage` — MSW handlers for 201, 409 email_taken, 409 slug_taken, 422 slug_reserved; cover all acceptance criteria. Present to user for approval before implementing.
- [x] Implement `apps/web/app/(auth)/register/page.tsx` shell.
- [x] Implement `apps/web/src/page-components/RegisterPage.tsx` (form, slug derivation, API call, error handling).
- [x] Add "Don't have an account? Register" link to `apps/web/src/page-components/LoginPage.tsx`.
- [x] Verify in browser via Playwright MCP: golden path (register → redirect to /services), slug auto-derivation, field errors for email_taken and slug_taken, authenticated redirect.
- [x] Update `docs/domains/auth.md` — document the `/register` route, `RegisterPage` component, and the link addition to `LoginPage`.
