# Domain: Tenants

A tenant is a business account (e.g. a barber shop, clinic). Created at signup alongside the first owner user. Owners can update their name/slug or delete their account.

## Schema

Table: `tenants` — see [data-model.md](../db/data-model.md).

## API

All routes require `Authorization: Bearer <token>`. `req.auth.tenantId` must match `:tenantId` — 403 on mismatch. Return 404 if entity does not exist (do not leak existence across tenant boundaries).

| File | Responsibility |
|------|----------------|
| `apps/web/app/api/tenants/[tenantId]/route.ts` | Tenant read / update / delete |

### `GET /api/tenants/:id`

**Response 200**
```json
{ "id": "uuid", "name": "string", "slug": "string", "createdAt": "iso8601" }
```

**Errors:** `403`, `404`

---

### `PATCH /api/tenants/:id`

All fields optional; at least one must be present.

**Request**
```json
{ "name": "string?", "slug": "string?" }
```

**Response 200** — updated tenant object (same shape as GET).

**Errors:** `403`, `404`, `409` `slug_taken`, `422` `validation_error`

---

### `DELETE /api/tenants/:id`

Permanently deletes the account. Requires the authenticated owner's password. In a
single transaction, the tenant's bookings are purged (despite `ON DELETE RESTRICT`)
and the tenant is deleted, cascading users/services/locations/staff. See
[ADR-013](../adr/013-account-deletion-purge.md).

**Request**
```json
{ "password": "string" }
```

**Response 204** — clears the `sc_token` cookie (`Set-Cookie: sc_token=; Max-Age=0`).

**Errors:** `401`, `403` `forbidden` (tenant mismatch) / `invalid_password`, `404`, `422` `validation_error`

---

## Account (user) API

The authenticated user's own credentials. Resolved from the `sc_token` cookie via
`withAuth` — no `:userId` in the URL; these routes only ever act on the caller.
`users` is platform-level (no RLS), so they run on a plain connection.

| File | Responsibility |
|------|----------------|
| `apps/web/app/api/account/email/route.ts` | `PATCH` — change email |
| `apps/web/app/api/account/password/route.ts` | `PATCH` — change password |

### `PATCH /api/account/email`

**Request** `{ "email": "string" }`
**Response 200** `{ "email": "string" }` — stored/returned lowercased. JWT unaffected (no re-login).
**Errors:** `401`, `409` `email_taken`, `422` `validation_error`

### `PATCH /api/account/password`

**Request** `{ "currentPassword": "string", "newPassword": "string (min 8)" }`
**Response 204**
**Errors:** `401`, `403` `invalid_current_password`, `422` `validation_error`

---

## Frontend

**Settings page** (`/settings`, dashboard route group) — owner self-service.

| File | Responsibility |
|------|----------------|
| `apps/web/app/(dashboard)/settings/page.tsx` | SSR: fetches email + tenant name/slug, hydrates the client island |
| `apps/web/src/page-components/settings/SettingsPage.tsx` | Account (email/password), Business (name/slug), Danger zone (delete) |
| `apps/web/src/hooks/useAccount.ts` | `useUpdateEmail`, `useUpdatePassword`, `useDeleteAccount` |
| `apps/web/src/hooks/useTenant.ts` | `useUpdateTenant` (name/slug) |

The page is linked from the sidebar ("Settings") and guarded by `middleware.ts`.
Account deletion confirms via an alert dialog requiring the password, then redirects
to `/login` (the API has cleared the cookie). The owner's `tenantId` is read from
`UserProvider`/`useAuth`.
