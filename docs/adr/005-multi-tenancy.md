# ADR 005 — Multi-Tenancy Strategy: Row-Level with tenant_id + RLS

**Date:** 2026-04-12
**Status:** Accepted

## Context

ScheduleCore serves multiple independent businesses (tenants). Every tenant's data must be isolated. Two primary models were considered:

**Schema-level** — each tenant gets their own Postgres schema (`tenant_abc.bookings`).
**Row-level** — all tenants share tables; every tenant-scoped row carries a `tenant_id` UUID.

## Decision

Use **row-level multi-tenancy**:

- `tenant_id UUID NOT NULL` on every tenant-scoped table (`services`, `availability_rules`, `bookings`).
- Postgres **Row Level Security (RLS)** enabled on all three tables (`services`, `availability_rules`, `bookings`) as a defence-in-depth layer.
- RLS policy reads `current_setting('app.current_tenant_id', true)::uuid`. The `true` flag returns NULL (not an error) when the setting is absent — meaning zero rows are visible until the application explicitly sets the context.
- The `tenants` table itself has no RLS — it is platform-level; access is controlled by the auth layer.

Schema-level was rejected because:
- Migrations must run per-tenant schema — operationally expensive at any scale.
- Schema explosion (hundreds of schemas) complicates monitoring, vacuuming, and connection pooling.
- No compliance requirement or per-tenant customisation need justifies the overhead.

## Consequences

- Every query on tenant-scoped tables must either set `app.current_tenant_id` or bypass RLS via a trusted internal role.
- Full RLS enforcement requires a **non-owner application role** (table owners bypass RLS by default). Creating this role and granting minimal privileges is deferred to M3 (tenant auth).
- Until M3, the database owner role is used in development. RLS policies are in place but not enforced against the owner. Tests document this gap.
- `FORCE ROW LEVEL SECURITY` on tables will be evaluated in M3 to enforce policies even for the owner role in staging/production.
- `availability_rules` carries a denormalised `tenant_id` (in addition to `service_id`) to allow RLS filtering without a join.
