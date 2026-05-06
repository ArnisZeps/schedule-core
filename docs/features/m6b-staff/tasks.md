# Tasks: m6b-staff

<!-- Never delete tasks. Mark done, append new ones. -->

## 2026-05-05 Initial implementation

### Migration
- [x] Write `packages/db/migrations/0005_m6b_staff.sql` (staff, staff_services, staff_schedules, staff_schedule_overrides)
- [x] Apply migration and verify all tables + RLS policies exist

### API — Staff CRUD
- [x] Write integration tests: create staff, list active only, list with includeInactive, get by id, update profile, deactivate, reactivate
- [x] Implement `POST /tenants/:tenantId/staff`
- [x] Implement `GET /tenants/:tenantId/staff` (with `?includeInactive` support)
- [x] Implement `GET /tenants/:tenantId/staff/:staffId`
- [x] Implement `PATCH /tenants/:tenantId/staff/:staffId`
- [x] Register staff router in `apps/api/src/app.ts`

### API — Service assignment
- [x] Write integration tests: PUT replaces full set, GET returns assigned services, empty array removes all
- [x] Implement `GET /tenants/:tenantId/staff/:staffId/services`
- [x] Implement `PUT /tenants/:tenantId/staff/:staffId/services`

### API — Schedules
- [x] Write integration tests: PUT replaces full set, GET returns all windows, PUT with empty array removes all
- [x] Implement `GET /tenants/:tenantId/staff/:staffId/schedules`
- [x] Implement `PUT /tenants/:tenantId/staff/:staffId/schedules`

### API — Overrides
- [x] Write integration tests: create available, create not_available, update (change type and dates), delete, startTime >= endTime returns 422, startDate > endDate returns 422
- [x] Implement `GET /tenants/:tenantId/staff/:staffId/overrides` (with `?from` / `?to` filters)
- [x] Implement `POST /tenants/:tenantId/staff/:staffId/overrides`
- [x] Implement `PATCH /tenants/:tenantId/staff/:staffId/overrides/:overrideId`
- [x] Implement `DELETE /tenants/:tenantId/staff/:staffId/overrides/:overrideId`

### Owner UI — Staff list
- [x] Write RTL + MSW tests: active staff list renders, show-inactive toggle reveals deactivated staff, new-staff button present
- [x] Add "Staff" nav entry to Sidebar
- [x] Add `/staff` route to router
- [x] Implement `StaffListPage` (list, show-inactive toggle, new staff button)
- [x] Implement `useStaffList` query hook

### Owner UI — Staff create and profile edit
- [x] Write RTL + MSW tests: create form validation (name required, email format), deactivate confirmation dialog, reactivate
- [x] Implement `StaffForm` (name, email, phone)
- [x] Implement create flow: button → StaffForm → POST → navigate to detail
- [x] Add `/staff/:staffId` route to router
- [x] Implement `StaffDetailPage` profile section with edit, deactivate (AlertDialog), and reactivate
- [x] Implement `useCreateStaff` and `useUpdateStaff` mutation hooks

### Owner UI — Service assignment
- [x] Write RTL + MSW tests: checkboxes reflect assigned services, save triggers PUT with correct IDs, empty save removes all
- [x] Implement `ServiceAssignment` component
- [x] Implement `useStaffServices` query and `useUpdateStaffServices` mutation hooks
- [x] Wire `ServiceAssignment` into `StaffDetailPage`

### Owner UI — Weekly schedule calendar
- [x] Write RTL + MSW tests: windows render per day, drag creates a new block (simulate mousedown/mousemove/mouseup), block popover edit updates times, popover delete removes block, save triggers PUT with correct payload
- [x] Implement `WeekdayColumn` (drag gesture, ghost block, window blocks, block popover)
- [x] Implement `WeeklyScheduleCalendar` (7 columns, pending-change state, save button)
- [x] Implement `useStaffSchedules` query and `useUpdateStaffSchedules` mutation hooks
- [x] Wire `WeeklyScheduleCalendar` into `StaffDetailPage`

### Owner UI — Override calendar
- [x] Write RTL + MSW tests: green/red blocks render for each override type, drag opens panel pre-filled, create button opens blank panel, clicking block opens panel in edit mode, delete from panel triggers DELETE and closes panel
- [x] Implement `OverrideBlock` (green / red coloured block)
- [x] Implement `OverridePanel` (slide-over: start/end date, type toggle, start/end time, create/edit/delete)
- [x] Implement `OverrideCalendar` (week/day view toggle, navigation, "Create override" button, day columns with drag, override block rendering)
- [x] Implement override hooks: `useStaffOverrides`, `useCreateStaffOverride`, `useUpdateStaffOverride`, `useDeleteStaffOverride`
- [x] Wire `OverrideCalendar` into `StaffDetailPage`
