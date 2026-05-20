# Design: staff-preload

## Problem

`NewAppointmentPanel` calls `useServiceStaff(serviceId, locationId)` after the user selects a service and a location. This triggers `GET /api/tenants/:tenantId/services/:serviceId/staff?locationId=UUID`. On first open, the React Query cache has no entry for this key, so the dropdown shows an empty state for ~100–300 ms while the request completes.

The appointments page (`appointments/page.tsx`) already SSR-fetches bookings, services, staff, and locations as initial data (ADR-012 pattern). The service-staff relationship — which staff members are qualified for which service at which location — is not included.

The fix: add a single SQL query to the existing SSR transaction that returns all qualified staff per `(serviceId, locationId)` pair, then seed the React Query cache before `useServiceStaff` is called with valid params.

No new API endpoints. No schema changes. No change to `useServiceStaff`'s external contract.

---

## Components

| File | Responsibility |
|------|----------------|
| `apps/web/app/(dashboard)/appointments/page.tsx` | Add 5th parallel query inside the existing `withTenantContext` transaction; pass result as `initialServiceStaff` to `AppointmentsPage` |
| `apps/web/src/page-components/appointments/AppointmentsPage.tsx` | Accept `initialServiceStaff` prop; call `queryClient.setQueryData` for each `(serviceId, locationId)` entry on first render |

---

## Contracts

### New SSR query

Runs inside the same `withTenantContext` call as the existing four queries in `appointments/page.tsx`:

```sql
SELECT
  ss.service_id,
  s.id,
  s.tenant_id,
  s.name,
  s.email,
  s.phone,
  s.is_active,
  s.location_id,
  s.created_at
FROM staff_services ss
JOIN staff s ON s.id = ss.staff_id
WHERE s.is_active = true
ORDER BY s.created_at
```

RLS via `withTenantContext` (`SET LOCAL app.current_tenant_id`) restricts results to the current tenant. No explicit `tenant_id` filter needed in the WHERE clause.

### `initialServiceStaff` prop

```ts
interface ServiceStaffEntry {
  serviceId: string
  locationId: string
  staff: Staff[]  // same Staff shape as useStaff
}

// Passed from page.tsx to AppointmentsPage
initialServiceStaff: ServiceStaffEntry[]
```

Grouping from flat SQL rows to `ServiceStaffEntry[]` happens in `appointments/page.tsx`:

```
rows → group by (service_id, location_id) → ServiceStaffEntry[]
```

### Cache seeding in `AppointmentsPage`

`AppointmentsPage` calls `queryClient.setQueryData` once on first render (via `useMemo` or a ref guard — not a `useEffect`) for each `ServiceStaffEntry`:

```ts
queryClient.setQueryData(
  useServiceStaff.queryKey(serviceId, locationId, tenantId),
  staffArray
)
```

The query key format must match `useServiceStaff` exactly. The implementation task must verify the key before writing this call — checking `useStaff.ts` for the `['serviceStaff', tenantId, serviceId, locationId]` pattern or equivalent.

`setQueryData` does not set a `staleTime`. The data is immediately available but considered stale at time 0 — `useServiceStaff` will re-fetch in the background on first use if `staleTime` is 0, or serve from cache if `staleTime > 0`. Existing `staleTime` on the hook is unchanged.

---

## Rejected alternatives

**N×M SSR queries (one per service × location combination)** — same end result, but O(N×M) database round-trips vs 1 query. For a tenant with 5 services × 3 locations this is 15 queries instead of 1. Rejected.

**Add `serviceIds: string[]` to the staff list response** — extends the staff payload and changes the `GET /staff` API contract. Requires a JOIN on every staff list fetch, even outside the appointments page. Over-scoped for a single panel. Rejected.

**`staleTime: Infinity` on `useServiceStaff`** — eliminates repeat-navigation flashes but does not fix the cold-cache first-load case, which is the reported problem. Rejected.

**Re-use `initialStaff` with client-side service filter** — `initialStaff` does not include service assignment data (`staff_services`). Would require adding `serviceIds` to the staff model (API + schema change). Rejected.

**`initialData` option on `useServiceStaff`** — `useServiceStaff` accepts null params and is disabled until both params are non-null. Cannot pass `initialData` at hook call site since the panel doesn't know the seeded data at the point of calling the hook. `setQueryData` on the parent component is the correct pattern. Rejected.

---

## Trade-offs accepted

- The SSR transaction now runs 5 queries instead of 4. The new query adds one JOIN across `staff_services` and `staff` — low cost for typical tenant data sizes (tens of staff, tens of services).
- `setQueryData` without an explicit `updatedAt` timestamp means the data is immediately stale by React Query's default rules. `useServiceStaff` may fire a background re-fetch on mount if its `staleTime` is 0. This is acceptable: the user sees data immediately; the background re-fetch is silent.
- If a staff member is added or reassigned between the SSR render and the panel open, the seeded cache is stale. The background re-fetch corrects this silently. `override: true` exists as an escape hatch for booking conflicts in any case.

---

## Out of scope

- Seeding slot data (`useServiceSlots`) — slots depend on date and cannot be pre-fetched meaningfully at SSR time.
- Pre-fetching service-staff for other pages (staff list, service detail) — those pages have their own data needs.
- Incremental cache updates when staff mutations fire — mutation invalidation already clears the `['serviceStaff']` cache, which is sufficient.

---

## Edge cases

- **Tenant with no staff:** query returns zero rows; `initialServiceStaff` is `[]`; no `setQueryData` calls; behavior unchanged.
- **Service with no assigned staff at a location:** that `(serviceId, locationId)` pair simply has an empty `staff[]` in the seeded entry. Dropdown correctly shows "Any available" only.
- **Single-location tenant (location picker hidden):** the seeded data still covers the one location. Staff are immediately available upon service selection.
- **Staff deactivated between SSR and panel open:** seeded cache serves stale data for at most `staleTime` ms; `useServiceStaff` re-fetches and corrects. The `override` mechanism handles any booking conflict.
- **New staff added after SSR:** same as above — mutation invalidation on the staff create path must include `['serviceStaff']` invalidation. Verify this is already the case; add if missing.
