import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { generateAvailableDatesInWindow } from '@/lib/server/availability'
import { withTenantContext } from '@/lib/server/withTenantContext'
import {
  pool, withClient,
  insertTenant, insertLocation, insertService,
  insertStaff, assignStaffService, insertSchedule, insertBooking,
} from './helpers'

const SLUG = 'test-gen-avail-window'
let tenantId: string
let locationId: string
let serviceId: string

// 2026-05-04 = Monday (day_of_week = 1)
const MON = '2026-05-04'
const WED = '2026-05-06'
const SUN = '2026-05-10'

beforeAll(async () => {
  await withClient(async (client) => {
    await client.query('BEGIN')
    tenantId = await insertTenant(client, SLUG)
    locationId = await insertLocation(client, tenantId)
    serviceId = await insertService(client, tenantId, 'Haircut', 60)
    await client.query('COMMIT')
  })
})

afterAll(async () => {
  await withClient(async (client) => {
    await client.query('DELETE FROM bookings WHERE tenant_id = $1', [tenantId])
    await client.query('DELETE FROM staff_schedule_overrides WHERE tenant_id = $1', [tenantId])
    await client.query('DELETE FROM staff_schedules WHERE tenant_id = $1', [tenantId])
    await client.query('DELETE FROM staff_services WHERE tenant_id = $1', [tenantId])
    await client.query('DELETE FROM staff WHERE tenant_id = $1', [tenantId])
    await client.query('DELETE FROM services WHERE tenant_id = $1', [tenantId])
    await client.query('DELETE FROM locations WHERE tenant_id = $1', [tenantId])
    await client.query('DELETE FROM tenants WHERE id = $1', [tenantId])
  })
})

function callFn(
  staffId: string | null,
  opts: {
    startDate?: string
    endDate?: string
    durationMinutes?: number
    timezone?: string
    locId?: string
  } = {},
) {
  return withTenantContext(pool, tenantId, (client) =>
    generateAvailableDatesInWindow(client, {
      tenantId,
      serviceId,
      locationId: opts.locId ?? locationId,
      staffId,
      startDate: opts.startDate ?? MON,
      endDate: opts.endDate ?? SUN,
      durationMinutes: opts.durationMinutes ?? 60,
      timezone: opts.timezone ?? 'UTC',
    }),
  )
}

describe('generateAvailableDatesInWindow', () => {
  it('returns [] when no staff is assigned to the service at the location', async () => {
    // No staff inserted at this point — tenant/location/service exist but no staff_services rows
    const dates = await callFn(null)
    expect(dates).toEqual([])
  })

  it('returns [] when staff has no schedule for any day in the window', async () => {
    const staffId = await withClient(async (client) => {
      await client.query('BEGIN')
      const id = await insertStaff(client, tenantId, locationId, 'NoScheduleStaff')
      await assignStaffService(client, id, serviceId, tenantId)
      await client.query('COMMIT')
      return id
    })
    try {
      const dates = await callFn(staffId)
      expect(dates).toEqual([])
    } finally {
      await withClient(async (c) => {
        await c.query('DELETE FROM staff_services WHERE staff_id = $1', [staffId])
        await c.query('DELETE FROM staff WHERE id = $1', [staffId])
      })
    }
  })

  it('returns dates where the staff member has a recurring schedule', async () => {
    const staffId = await withClient(async (client) => {
      await client.query('BEGIN')
      const id = await insertStaff(client, tenantId, locationId, 'ScheduledStaff')
      await assignStaffService(client, id, serviceId, tenantId)
      await insertSchedule(client, id, tenantId, 1, '09:00', '11:00') // Monday
      await insertSchedule(client, id, tenantId, 3, '09:00', '11:00') // Wednesday
      await client.query('COMMIT')
      return id
    })
    try {
      const dates = await callFn(staffId, { startDate: MON, endDate: SUN })
      expect(dates).toContain(MON) // Monday
      expect(dates).toContain(WED) // Wednesday
      expect(dates).not.toContain('2026-05-05') // Tuesday
      expect(dates).not.toContain('2026-05-07') // Thursday
      expect(dates).not.toContain('2026-05-10') // Sunday
    } finally {
      await withClient(async (c) => {
        await c.query('DELETE FROM staff_schedules WHERE staff_id = $1', [staffId])
        await c.query('DELETE FROM staff_services WHERE staff_id = $1', [staffId])
        await c.query('DELETE FROM staff WHERE id = $1', [staffId])
      })
    }
  })

  it('includes a date covered by an available override with no recurring schedule', async () => {
    const staffId = await withClient(async (client) => {
      await client.query('BEGIN')
      const id = await insertStaff(client, tenantId, locationId, 'OverrideOnlyStaff')
      await assignStaffService(client, id, serviceId, tenantId)
      await client.query(
        `INSERT INTO staff_schedule_overrides (staff_id, tenant_id, type, start_date, end_date, start_time, end_time)
         VALUES ($1, $2, 'available', $3::date, $3::date, '10:00', '12:00')`,
        [id, tenantId, MON],
      )
      await client.query('COMMIT')
      return id
    })
    try {
      const dates = await callFn(staffId, { startDate: MON, endDate: SUN })
      expect(dates).toContain(MON)
      expect(dates).not.toContain('2026-05-05') // Tuesday — no override
    } finally {
      await withClient(async (c) => {
        await c.query('DELETE FROM staff_schedule_overrides WHERE staff_id = $1', [staffId])
        await c.query('DELETE FROM staff_services WHERE staff_id = $1', [staffId])
        await c.query('DELETE FROM staff WHERE id = $1', [staffId])
      })
    }
  })

  it('excludes a date when a not_available override blocks all slots', async () => {
    const staffId = await withClient(async (client) => {
      await client.query('BEGIN')
      const id = await insertStaff(client, tenantId, locationId, 'BlockedStaff')
      await assignStaffService(client, id, serviceId, tenantId)
      await insertSchedule(client, id, tenantId, 1, '09:00', '10:00') // 1 slot for 60min service
      await client.query(
        `INSERT INTO staff_schedule_overrides (staff_id, tenant_id, type, start_date, end_date, start_time, end_time)
         VALUES ($1, $2, 'not_available', $3::date, $3::date, '00:00', '24:00')`,
        [id, tenantId, MON],
      )
      await client.query('COMMIT')
      return id
    })
    try {
      const dates = await callFn(staffId, { startDate: MON, endDate: MON })
      expect(dates).toEqual([])
    } finally {
      await withClient(async (c) => {
        await c.query('DELETE FROM staff_schedule_overrides WHERE staff_id = $1', [staffId])
        await c.query('DELETE FROM staff_schedules WHERE staff_id = $1', [staffId])
        await c.query('DELETE FROM staff_services WHERE staff_id = $1', [staffId])
        await c.query('DELETE FROM staff WHERE id = $1', [staffId])
      })
    }
  })

  it('excludes a date when the only available slot is booked', async () => {
    const staffId = await withClient(async (client) => {
      await client.query('BEGIN')
      const id = await insertStaff(client, tenantId, locationId, 'BookedStaff')
      await assignStaffService(client, id, serviceId, tenantId)
      await insertSchedule(client, id, tenantId, 1, '09:00', '10:00') // 1 slot for 60min service
      await client.query('COMMIT')
      return id
    })
    const bookingId = await withClient((c) =>
      insertBooking(c, tenantId, serviceId, locationId, staffId, `${MON}T09:00:00Z`, `${MON}T10:00:00Z`),
    )
    try {
      const dates = await callFn(staffId, { startDate: MON, endDate: MON })
      expect(dates).toEqual([])
    } finally {
      await withClient(async (c) => {
        await c.query('DELETE FROM bookings WHERE id = $1', [bookingId])
        await c.query('DELETE FROM staff_schedules WHERE staff_id = $1', [staffId])
        await c.query('DELETE FROM staff_services WHERE staff_id = $1', [staffId])
        await c.query('DELETE FROM staff WHERE id = $1', [staffId])
      })
    }
  })

  it('includes a date when at least one staff has a free slot (any-available)', async () => {
    const [s1, s2] = await withClient(async (client) => {
      await client.query('BEGIN')
      const a = await insertStaff(client, tenantId, locationId, 'AnyAvailA')
      const b = await insertStaff(client, tenantId, locationId, 'AnyAvailB')
      await assignStaffService(client, a, serviceId, tenantId)
      await assignStaffService(client, b, serviceId, tenantId)
      await insertSchedule(client, a, tenantId, 1, '09:00', '10:00') // 1 slot
      await insertSchedule(client, b, tenantId, 1, '09:00', '10:00') // 1 slot
      await client.query('COMMIT')
      return [a, b]
    })
    // Book staff A — B is still free
    const bookingId = await withClient((c) =>
      insertBooking(c, tenantId, serviceId, locationId, s1, `${MON}T09:00:00Z`, `${MON}T10:00:00Z`),
    )
    try {
      const dates = await callFn(null, { startDate: MON, endDate: MON })
      expect(dates).toContain(MON) // B still has a free slot
    } finally {
      await withClient(async (c) => {
        await c.query('DELETE FROM bookings WHERE id = $1', [bookingId])
        await c.query('DELETE FROM staff_schedules WHERE staff_id = $1', [s1])
        await c.query('DELETE FROM staff_schedules WHERE staff_id = $1', [s2])
        await c.query('DELETE FROM staff_services WHERE staff_id = $1', [s1])
        await c.query('DELETE FROM staff_services WHERE staff_id = $1', [s2])
        await c.query('DELETE FROM staff WHERE id = $1', [s1])
        await c.query('DELETE FROM staff WHERE id = $1', [s2])
      })
    }
  })

  it('handles single-day window (startDate === endDate)', async () => {
    const staffId = await withClient(async (client) => {
      await client.query('BEGIN')
      const id = await insertStaff(client, tenantId, locationId, 'SingleDayStaff')
      await assignStaffService(client, id, serviceId, tenantId)
      await insertSchedule(client, id, tenantId, 1, '09:00', '11:00') // Monday
      await client.query('COMMIT')
      return id
    })
    try {
      const dates = await callFn(staffId, { startDate: MON, endDate: MON })
      expect(dates).toEqual([MON])
    } finally {
      await withClient(async (c) => {
        await c.query('DELETE FROM staff_schedules WHERE staff_id = $1', [staffId])
        await c.query('DELETE FROM staff_services WHERE staff_id = $1', [staffId])
        await c.query('DELETE FROM staff WHERE id = $1', [staffId])
      })
    }
  })

  it('applies timezone correctly — booking at local slot time blocks the slot', async () => {
    // America/New_York is EDT in May 2026 (UTC-4)
    // Staff schedule: Mon 09:00-10:00 local = Mon 13:00-14:00 UTC
    // Booking at 2026-05-04T13:00:00Z fills the only slot → date not available
    const nyLocId = await withClient(async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO locations (tenant_id, name, timezone) VALUES ($1, 'NY Branch', 'America/New_York') RETURNING id`,
        [tenantId],
      )
      return rows[0].id
    })
    const staffId = await withClient(async (client) => {
      await client.query('BEGIN')
      const id = await insertStaff(client, tenantId, nyLocId, 'NYStaff')
      await assignStaffService(client, id, serviceId, tenantId)
      await insertSchedule(client, id, tenantId, 1, '09:00', '10:00') // Mon 09:00-10:00 NY
      await client.query('COMMIT')
      return id
    })
    const bookingId = await withClient((c) =>
      insertBooking(c, tenantId, serviceId, nyLocId, staffId, `${MON}T13:00:00Z`, `${MON}T14:00:00Z`),
    )
    try {
      const dates = await callFn(staffId, {
        startDate: MON,
        endDate: MON,
        locId: nyLocId,
        timezone: 'America/New_York',
      })
      expect(dates).toEqual([]) // booking fills the only slot
    } finally {
      await withClient(async (c) => {
        await c.query('DELETE FROM bookings WHERE id = $1', [bookingId])
        await c.query('DELETE FROM staff_schedules WHERE staff_id = $1', [staffId])
        await c.query('DELETE FROM staff_services WHERE staff_id = $1', [staffId])
        await c.query('DELETE FROM staff WHERE id = $1', [staffId])
        await c.query('DELETE FROM locations WHERE id = $1', [nyLocId])
      })
    }
  })
})
