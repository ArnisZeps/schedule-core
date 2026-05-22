# Tasks: Invalid Credentials Warning

<!-- Never delete tasks. Mark done, append new ones. -->

## 2026-05-22 Initial implementation

- [x] Write failing RTL tests for `LoginPage`: 401 response → "Incorrect email or password." visible; non-401 error → "Login failed" visible. Run them (must be red). Present output to user for approval.
- [x] Fix `apiFetch` (`apps/web/src/lib/api.ts`): skip `window.location.replace('/login')` when `window.location.pathname === '/login'`.
- [x] Fix `LoginPage` (`apps/web/src/page-components/LoginPage.tsx`): map `ApiError` with `status === 401` to "Incorrect email or password." in the catch block.
- [x] Verify in browser via Playwright MCP: submit wrong credentials → error message appears inline, no reload, button re-enables.
- [x] Update `docs/domains/auth.md` — frontend components section to note that `LoginPage` displays "Incorrect email or password." on 401.
