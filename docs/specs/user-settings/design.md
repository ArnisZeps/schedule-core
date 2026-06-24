# Design: user-settings

## Problem

Owners have no UI to manage their account. `tenants.md` already documents
`PATCH`/`DELETE /api/tenants/:id` but states "No dedicated tenant management UI
in MVP". This feature adds that UI and fills two gaps:

1. **No email/password endpoints exist.** The `users` table has no update route.
2. **Account deletion is currently impossible for real accounts.**
   `bookings.tenant_id` is `ON DELETE RESTRICT` (data-model.md), so
   `DELETE /api/tenants/:id` returns `409 has_bookings` for any tenant that has
   ever taken a booking. A working "delete account" must purge bookings too.

Decision recorded in **[ADR-013](../../adr/013-account-deletion-purge.md)**:
deliberate account deletion explicitly purges the tenant's bookings inside the
delete transaction. RESTRICT stays in place as accidental-deletion protection
for all other paths (single-service/staff/location deletes).

Constraints honored: cookie auth (ADR-012), SSR pages with client islands
(ADR-012), bcrypt factor 12 (ADR-007), `users`/`tenants` are platform-level with
no RLS (ADR-005), raw SQL via `Pool` (no ORM).

## Components

### API (Route Handlers)

| File | Responsibility |
|------|----------------|
| `apps/web/app/api/account/email/route.ts` | `PATCH` — change authenticated user's email |
| `apps/web/app/api/account/password/route.ts` | `PATCH` — change password (verifies current) |
| `apps/web/app/api/tenants/[tenantId]/route.ts` | `PATCH` (exists, unchanged) + `DELETE` (modified: require password, cascade-purge bookings, clear cookie) |

### Frontend

| File | Responsibility |
|------|----------------|
| `apps/web/app/(dashboard)/settings/page.tsx` | SSR server component: reads `x-user-id`/`x-tenant-id`, fetches email + tenant name/slug, hydrates client page |
| `apps/web/src/page-components/settings/SettingsPage.tsx` | Client island: Account / Business / Danger-zone sections |
| `apps/web/src/hooks/useAccount.ts` | `useUpdateEmail`, `useUpdatePassword`, `useDeleteAccount` |
| `apps/web/src/hooks/useTenant.ts` | `useUpdateTenant` (name/slug) |
| `apps/web/src/components/Sidebar.tsx` | Add "Settings" nav item |
| `apps/web/middleware.ts` | Add `settings` to matcher + protected route regex |

## Contracts

All `/api/account/*` routes resolve the user from the `sc_token` cookie via
`withAuth` (returns `userId`). No `:userId` in the URL — the route only ever acts
on the authenticated user. `users` has no RLS, so these run on a plain connection.

### `PATCH /api/account/email`
**Request** `{ "email": "string" }`
**Response 200** `{ "email": "string" }`
**Errors:** `401` unauthorized, `409` `email_taken`, `422` `validation_error`
JWT is unaffected (`sub` = userId). No re-login required.

### `PATCH /api/account/password`
**Request** `{ "currentPassword": "string", "newPassword": "string (min 8)" }`
**Response 204**
**Errors:** `401` unauthorized, `403` `invalid_current_password`, `422` `validation_error`
Verifies current via `verifyPassword`, stores `hashPassword(newPassword)`.

### `DELETE /api/tenants/:id` (modified)
**Request** `{ "password": "string" }` (new — body now required)
Behavior: verify password against the authenticated user; in one transaction
`DELETE FROM bookings WHERE tenant_id = $1` then `DELETE FROM tenants WHERE id = $1`
(cascades users/services/locations/staff/* per existing FKs).
**Response 204** with `Set-Cookie: sc_token=; Max-Age=0` (clears session).
**Errors:** `401` unauthorized, `403` (`forbidden` on tenant mismatch, or
`invalid_password`), `404` not_found.
The `409 has_bookings` response is **removed** — bookings are purged, not blocked.

### `PATCH /api/tenants/:id` (unchanged)
Already supports `{ name?, slug? }` → 200 / `409 slug_taken` / `422`.

### Data fetched by the SSR page
- Email: `SELECT email FROM users WHERE id = $userId` (plain connection).
- Tenant name/slug: existing tenant read pattern.

## Rejected alternatives

- **Change `bookings.tenant_id` FK to `ON DELETE CASCADE`** — removes the
  accidental-deletion safety net everywhere, not just for account deletion.
  Explicit purge inside the delete transaction is targeted and reversible in
  policy. (See ADR-013.)
- **Soft-delete tenant (`deleted_at`)** — preserves history but the account
  isn't really gone, and it forces auth/middleware changes to block deactivated
  logins. Over-scoped for MVP; the owner explicitly wants data removed.
- **Dedicated `POST /api/account/delete`** — deletion's resource is the tenant;
  reusing `DELETE /api/tenants/:id` keeps one source of truth. Cookie clear is
  added to that response.
- **`PATCH /api/users/:userId` mirroring tenants** — leaks userId in the URL and
  needs ownership checks; `/api/account/*` scoped to the cookie is simpler.
- **Combined `PATCH /api/account` for email+password** — different validation and
  re-auth rules; separate routes are clearer.
- **GET endpoint for current email** — the SSR page reads it directly from the DB
  (matches the services page pattern); no extra route needed.

## Trade-offs accepted

- Account deletion is irreversible and destroys booking history for that tenant.
  Mitigated by Danger-zone isolation + password + explicit confirm.
- Email change is allowed without current-password re-auth (per product
  decision). A leaked session could change the email; acceptable for MVP given
  the 30-day cookie and HttpOnly transport.
- Old JWTs remain valid after a password change until they expire (no blocklist —
  ADR-007 accepted this).

## Out of scope

- Email verification / confirmation links on email change.
- Multi-user tenants and per-user roles (data-model notes multi-user is post-M3).
- 2FA, password-reset-by-email flow, account recovery.
- Exporting data before deletion.

## Edge cases

- **Email unchanged but resubmitted** — UPDATE to the same value succeeds (no-op);
  unique constraint only fires against *other* rows.
- **`email_taken`** — detected via unique-violation on `users_email_key` →
  `409 email_taken` (mirrors tenant slug handling).
- **Wrong current password (change)** — `403 invalid_current_password`; no write.
- **Wrong password (delete)** — `403 invalid_password`; transaction not started.
- **Tenant id mismatch on DELETE** — `403 forbidden` (existing check) before any
  password work.
- **Deletion of a tenant with zero bookings** — purge deletes 0 rows, tenant
  delete proceeds; same path, no special-casing.
- **Cookie cleared mid-session after delete** — middleware redirects subsequent
  requests to `/login`; client redirects immediately on success.
