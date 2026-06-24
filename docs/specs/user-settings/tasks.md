# Tasks: user-settings

<!-- Never delete tasks. Mark done, append new ones. -->
<!-- TDD: write tests, get approval, then implement. Mark done atomically. -->

## 2026-06-24 Initial implementation

### API
- [x] Tests + impl: `PATCH /api/account/email` (200, 401, 409 email_taken, 422)
- [x] Tests + impl: `PATCH /api/account/password` (204, 401, 403 invalid_current_password, 422)
- [x] Tests + impl: modify `DELETE /api/tenants/:id` — require password, purge bookings + delete tenant in one transaction, clear cookie, drop 409 has_bookings (404, 401, 403 forbidden/invalid_password, 204)
- [x] Fixed pre-existing test breakage: `makeRequest` helper now sends the `sc_token` cookie (was `Authorization: Bearer`, broken by ADR-012). Added `insertUser` helper.

### Frontend
- [x] Add "Settings" nav item to `Sidebar`; add `/settings` to middleware matcher + protected regex
- [x] Tests + impl: `useUpdateEmail`, `useUpdatePassword`, `useDeleteAccount`, `useUpdateTenant` hooks
- [x] Tests + impl: SSR `settings/page.tsx` (fetch email + tenant) → `SettingsPage` client island
- [x] Tests + impl: Account section (email form, password form) with success/error states
- [x] Tests + impl: Business section (name/slug form) with success/error states
- [x] Tests + impl: Danger zone — delete dialog with password confirm, on success redirect to /login

### Verification
- [ ] Browser-verify settings page golden paths (Playwright MCP per testing.md) — NOT RUN: Playwright MCP not available in this environment. Verified via RTL (9 settings tests) + full suite (211 web / 81 API green) + typecheck.

### Docs (final task)
- [x] Update `docs/domains/tenants.md`: DELETE now requires password + purges bookings (removed 409 has_bookings); documented `/api/account/*` endpoints + the settings UI
- [x] Documented `/api/account/*` and the settings UI in `tenants.md` (folded in rather than a separate account.md — owner/tenant-scoped, lives naturally there)
- [x] Amend `docs/db/data-model.md` bookings note to reference ADR-013 (account deletion purge)
