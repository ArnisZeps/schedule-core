# Requirements: M4 — Core API Surface

## User stories

**Tenant management**
- As a tenant admin, I want to view my tenant's details so that I can confirm my account configuration.
- As a tenant admin, I want to update my tenant's name and slug so that I can rebrand or fix a typo.
- As a tenant admin, I want to delete my tenant so that I can close my account.

**Service management**
- As a tenant admin, I want to create a bookable service so that clients can book it.
- As a tenant admin, I want to list all my services so that I can see what is configured.
- As a tenant admin, I want to view a single service so that I can inspect its details.
- As a tenant admin, I want to update a service's name or description so that I can keep it accurate.
- As a tenant admin, I want to delete a service so that I can remove one that is no longer offered.

**Availability configuration**
- As a tenant admin, I want to add a weekly availability window to a service so that clients know when it can be booked.
- As a tenant admin, I want to list all availability rules for a service so that I can review the schedule.
- As a tenant admin, I want to view a single availability rule so that I can inspect its details.
- As a tenant admin, I want to update an availability rule so that I can adjust the schedule.
- As a tenant admin, I want to delete an availability rule so that I can remove a time window.

## Acceptance criteria

**Tenants**
- [ ] `GET /tenants/:id` returns 200 with the tenant object.
- [ ] `GET /tenants/:id` returns 403 if `req.auth.tenantId` does not match `:id`.
- [ ] `GET /tenants/:id` returns 404 if the tenant does not exist.
- [ ] `PATCH /tenants/:id` returns 200 with the updated tenant object.
- [ ] `PATCH /tenants/:id` returns 409 `slug_taken` if the new slug is already in use by another tenant.
- [ ] `PATCH /tenants/:id` returns 403 / 404 under the same conditions as GET.
- [ ] `DELETE /tenants/:id` returns 204.
- [ ] `DELETE /tenants/:id` returns 409 `has_bookings` if the tenant has existing bookings.
- [ ] `DELETE /tenants/:id` returns 403 / 404 under the same conditions as GET.

**Services**
- [ ] `POST /tenants/:tenantId/services` returns 201 with the service object.
- [ ] `POST /tenants/:tenantId/services` requires `name`; `description` is optional.
- [ ] All service routes return 403 if `req.auth.tenantId` does not match `:tenantId`.
- [ ] All service routes return 404 if the service does not exist or does not belong to `:tenantId`.
- [ ] `DELETE /tenants/:tenantId/services/:id` returns 409 `has_bookings` if bookings reference the service.

**Availability rules**
- [ ] `POST .../availability-rules` returns 201 with the rule object.
- [ ] `POST .../availability-rules` returns 409 `overlap` if the new rule overlaps an existing rule for the same service and day.
- [ ] `POST .../availability-rules` returns 422 if `startTime >= endTime`.
- [ ] `PATCH .../availability-rules/:id` returns 409 `overlap` if the updated rule would overlap another rule (excluding itself).
- [ ] `PATCH .../availability-rules/:id` returns 422 if the resulting `startTime >= endTime`.
- [ ] All availability rule routes return 403 / 404 under the same conditions as service routes.
- [ ] Availability rules that belong to a service in another tenant return 404 (not 403) to avoid leaking existence.
