import { Pool, PoolClient, neonConfig } from '@neondatabase/serverless'
import ws from 'ws'
import jwt from 'jsonwebtoken'

neonConfig.webSocketConstructor = ws

export const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    return await fn(client)
  } finally {
    client.release()
  }
}

export function makeToken(tenantId: string, userId = 'user-test'): string {
  return jwt.sign({ sub: userId, tenantId }, process.env.JWT_SECRET!, { expiresIn: '1h' })
}

export function makeRequest(url: string, token: string, init?: RequestInit): Request {
  return new Request(url, {
    ...init,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers as Record<string, string> ?? {}),
    },
  })
}

// Pool is shared; only call pool.end() in the final afterAll if needed.
// When multiple test files run, each file's afterAll calls pool.end() which
// causes subsequent files to fail. Use afterAll(() => pool.end()) only in
// single-file scenarios; for multi-file runs, the process exits and closes all connections.

export async function insertTenant(client: any, slug: string, name = 'Test Biz'): Promise<string> {
  const { rows } = await client.query(
    "INSERT INTO tenants (name, slug) VALUES ($1, $2) ON CONFLICT (slug) DO UPDATE SET name = $1 RETURNING id",
    [name, slug],
  )
  return rows[0].id
}

export async function insertLocation(client: any, tenantId: string, name = 'Main'): Promise<string> {
  const { rows } = await client.query(
    "INSERT INTO locations (tenant_id, name, timezone) VALUES ($1, $2, 'UTC') RETURNING id",
    [tenantId, name],
  )
  return rows[0].id
}

export async function insertService(client: any, tenantId: string, name = 'Test Service', durationMinutes = 60): Promise<string> {
  const { rows } = await client.query(
    "INSERT INTO services (tenant_id, name, duration_minutes) VALUES ($1, $2, $3) RETURNING id",
    [tenantId, name, durationMinutes],
  )
  return rows[0].id
}

export async function insertStaff(
  client: any,
  tenantId: string,
  locationId: string,
  name = 'Staff Member',
  isActive = true,
): Promise<string> {
  const { rows } = await client.query(
    "INSERT INTO staff (tenant_id, location_id, name, is_active) VALUES ($1, $2, $3, $4) RETURNING id",
    [tenantId, locationId, name, isActive],
  )
  return rows[0].id
}

export async function assignStaffService(client: any, staffId: string, serviceId: string, tenantId: string): Promise<void> {
  await client.query(
    "INSERT INTO staff_services (staff_id, service_id, tenant_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
    [staffId, serviceId, tenantId],
  )
}

export async function insertSchedule(
  client: any,
  staffId: string,
  tenantId: string,
  dayOfWeek: number,
  startTime = '09:00',
  endTime = '17:00',
): Promise<string> {
  const { rows } = await client.query(
    "INSERT INTO staff_schedules (staff_id, tenant_id, day_of_week, start_time, end_time) VALUES ($1, $2, $3, $4, $5) RETURNING id",
    [staffId, tenantId, dayOfWeek, startTime, endTime],
  )
  return rows[0].id
}

export async function insertBooking(
  client: any,
  tenantId: string,
  serviceId: string,
  locationId: string,
  staffId: string | null,
  startAt: string,
  endAt: string,
): Promise<string> {
  const { rows } = await client.query(
    `INSERT INTO bookings (tenant_id, service_id, location_id, staff_id, client_name, client_phone, start_at, end_at)
     VALUES ($1, $2, $3, $4, 'Test Client', '+1 555 000 0000', $5, $6) RETURNING id`,
    [tenantId, serviceId, locationId, staffId, startAt, endAt],
  )
  return rows[0].id
}

export async function setTenantContext(client: any, tenantId: string): Promise<void> {
  await client.query(`SET LOCAL app.current_tenant_id = '${tenantId}'`)
}
