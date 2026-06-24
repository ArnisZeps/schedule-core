# Requirements: user-settings

A dashboard settings page where the authenticated owner manages their account
and business identity. Surfaces existing tenant update/delete capability in the
UI (no UI existed before — see [tenants.md](../../domains/tenants.md)) and adds
net-new email/password change endpoints.

## User stories

- As an owner, I want to change my login email, so that I can keep my account
  reachable at a current address.
- As an owner, I want to change my password, so that I can rotate credentials or
  recover from a suspected leak.
- As an owner, I want to change my business name, so that the dashboard and
  hosted booking page reflect a rename or rebrand.
- As an owner, I want to change my business slug, so that my hosted booking URL
  matches my brand.
- As an owner, I want to permanently delete my account, so that I can leave the
  platform and remove my data.

## Acceptance criteria

### Email
- [ ] A settings page reachable from the dashboard nav shows the owner's current email.
- [ ] Owner can submit a new, valid email; on success the displayed email updates.
- [ ] Submitting an email already used by another account shows an `email_taken` error.
- [ ] Submitting an invalid email shows a validation error; nothing is changed.
- [ ] Email change does not log the owner out (JWT `sub` is unchanged).

### Password
- [ ] Owner can change password by supplying current password + new password.
- [ ] A wrong current password is rejected with a clear error; password is unchanged.
- [ ] New password must meet the minimum length (8 chars); shorter is rejected.
- [ ] On success the owner stays logged in and sees a confirmation.

### Business name / slug
- [ ] Page shows current business name and slug, pre-filled.
- [ ] Owner can change name and/or slug; on success the values persist.
- [ ] An empty name is rejected.
- [ ] A slug not matching `^[a-z0-9-]{3,50}$` is rejected with a validation error.
- [ ] A slug already taken by another tenant shows a `slug_taken` error.

### Delete account (dangerous)
- [ ] Deletion lives in a visually distinct "Danger zone" and requires explicit confirmation.
- [ ] Owner must re-enter their current password to confirm deletion.
- [ ] On confirm, the tenant and ALL its data — including bookings — are removed
      in a single transaction.
- [ ] A wrong password aborts deletion with an error; nothing is deleted.
- [ ] On success the auth cookie is cleared and the owner is redirected out of the dashboard.

### Cross-cutting
- [ ] All actions are tenant/owner-scoped: a user can only affect their own account/tenant.
- [ ] Each section reports success and failure distinctly (toast or inline message).
