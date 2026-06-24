# ADR-013 — Account Deletion Purges Bookings

**Date:** 2026-06-24
**Status:** Accepted
**Amends:** data-model.md (bookings `ON DELETE RESTRICT` intent)

---

## Context

`bookings.tenant_id`, `service_id`, `location_id`, and `staff_id` are all
`ON DELETE RESTRICT` (see [data-model.md](../db/data-model.md)), deliberately to
"preserve booking history" — you cannot delete a service, staff member, or
location while bookings reference it.

The user-settings feature adds an owner-facing "delete account" action. With
RESTRICT on `bookings.tenant_id`, `DELETE FROM tenants` raises a foreign-key
violation (`409 has_bookings`) for any tenant that has ever taken a booking —
i.e. essentially every real account. The delete button would be non-functional.

## Decision

Account deletion is a **deliberate, owner-confirmed, password-gated** action that
removes the entire account and all of its data, including bookings.

`DELETE /api/tenants/:id` purges within a single transaction:

```sql
BEGIN;
DELETE FROM bookings WHERE tenant_id = $1;
DELETE FROM tenants  WHERE id = $1;   -- cascades users/services/locations/staff/*
COMMIT;
```

The `bookings` foreign keys remain `ON DELETE RESTRICT`. They are **not** changed
to `CASCADE`. RESTRICT continues to protect against accidental loss of history on
all other paths (deleting a single service, staff member, or location). Only the
explicit account-deletion path purges bookings, and only because the owner has
re-authenticated and confirmed.

## Consequences

- `data-model.md`'s "preserve booking history" note now has one documented
  exception: full account deletion. The bookings table note will reference this ADR.
- `tenants.md` must drop the `409 has_bookings` error from `DELETE` and document
  the new password requirement + cookie clear.
- Deletion is irreversible and unrecoverable (no soft-delete, no export). This is
  intentional for MVP; mitigated by Danger-zone UI isolation, password re-auth,
  and explicit confirmation.

## Rejected alternatives

- **Change `bookings.tenant_id` FK to `ON DELETE CASCADE`** — would remove the
  accidental-deletion safety net for *all* deletes, not just account deletion.
- **Soft-delete (`tenants.deleted_at`)** — preserves history but the account is
  not actually removed and it forces auth/middleware changes to block deactivated
  logins. Over-scoped; contradicts the owner's intent to remove their data.
