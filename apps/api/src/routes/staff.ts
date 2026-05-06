import { Router } from 'express';
import { z } from 'zod';
import type { Pool } from '@schedule-core/db';
import { authMiddleware } from '../middleware/auth.js';
import { withTenantContext } from '../middleware/tenant-context.js';

const TIME = /^\d{2}:\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type StaffRow = {
  id: string;
  tenant_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: Date;
};

type ServiceRow = {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  created_at: Date;
};

type ScheduleRow = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

type OverrideRow = {
  id: string;
  staff_id: string;
  start_date: string;
  end_date: string;
  type: string;
  start_time: string;
  end_time: string;
  created_at: Date;
};

const STAFF_COLS = 'id, tenant_id, name, email, phone, is_active, created_at';

function formatStaff(r: StaffRow) {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    isActive: r.is_active,
    createdAt: r.created_at,
  };
}

function formatService(r: ServiceRow) {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    name: r.name,
    description: r.description,
    durationMinutes: r.duration_minutes,
    createdAt: r.created_at,
  };
}

function formatSchedule(r: ScheduleRow) {
  return {
    id: r.id,
    dayOfWeek: r.day_of_week,
    startTime: r.start_time.substring(0, 5),
    endTime: r.end_time.substring(0, 5),
  };
}

function formatOverride(r: OverrideRow) {
  return {
    id: r.id,
    staffId: r.staff_id,
    startDate: r.start_date,
    endDate: r.end_date,
    type: r.type,
    startTime: r.start_time.substring(0, 5),
    endTime: r.end_time.substring(0, 5),
    createdAt: r.created_at,
  };
}

const createStaffSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().nullish(),
  phone: z.string().nullish(),
});

const patchStaffSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().nullish(),
  phone: z.string().nullish(),
  isActive: z.boolean().optional(),
});

const putServicesSchema = z.object({
  serviceIds: z.array(z.string().uuid()),
});

const windowSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(TIME),
  endTime: z.string().regex(TIME),
});

const putSchedulesSchema = z.object({
  windows: z.array(windowSchema),
});

const overrideBodySchema = z
  .object({
    startDate: z.string().regex(DATE_RE),
    endDate: z.string().regex(DATE_RE),
    type: z.enum(['available', 'not_available']),
    startTime: z.string().regex(TIME),
    endTime: z.string().regex(TIME),
  })
  .refine((d) => d.startTime < d.endTime, { message: 'startTime must be before endTime' })
  .refine((d) => d.startDate <= d.endDate, { message: 'startDate must be on or before endDate' });

const OVERRIDE_SELECT =
  'id, staff_id, start_date::text AS start_date, end_date::text AS end_date, type, start_time, end_time, created_at';

export function staffRouter(pool: Pool): Router {
  const router = Router({ mergeParams: true });
  router.use(authMiddleware);

  // ---------------------------------------------------------------------------
  // Staff CRUD
  // ---------------------------------------------------------------------------

  router.post('/', async (req, res) => {
    const { tenantId } = req.params as { tenantId: string };
    if (req.auth!.tenantId !== tenantId) { res.status(403).json({ error: 'forbidden' }); return; }

    const parsed = createStaffSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: 'validation_error', details: parsed.error.issues.map((i) => i.path.join('.') || i.message) });
      return;
    }

    const { name, email, phone } = parsed.data;
    const row = await withTenantContext(pool, tenantId, async (client) => {
      const { rows } = await client.query<StaffRow>(
        `INSERT INTO staff (tenant_id, name, email, phone) VALUES ($1, $2, $3, $4) RETURNING ${STAFF_COLS}`,
        [tenantId, name, email ?? null, phone ?? null],
      );
      return rows[0];
    });

    res.status(201).json(formatStaff(row));
  });

  router.get('/', async (req, res) => {
    const { tenantId } = req.params as { tenantId: string };
    if (req.auth!.tenantId !== tenantId) { res.status(403).json({ error: 'forbidden' }); return; }

    const includeInactive = req.query.includeInactive === 'true';
    const rows = await withTenantContext(pool, tenantId, async (client) => {
      const sql = includeInactive
        ? `SELECT ${STAFF_COLS} FROM staff ORDER BY created_at`
        : `SELECT ${STAFF_COLS} FROM staff WHERE is_active = true ORDER BY created_at`;
      const { rows } = await client.query<StaffRow>(sql);
      return rows;
    });

    res.json(rows.map(formatStaff));
  });

  router.get('/:staffId', async (req, res) => {
    const { tenantId, staffId } = req.params as { tenantId: string; staffId: string };
    if (req.auth!.tenantId !== tenantId) { res.status(403).json({ error: 'forbidden' }); return; }

    const row = await withTenantContext(pool, tenantId, async (client) => {
      const { rows } = await client.query<StaffRow>(
        `SELECT ${STAFF_COLS} FROM staff WHERE id = $1 AND tenant_id = $2`,
        [staffId, tenantId],
      );
      return rows[0] ?? null;
    });

    if (!row) { res.status(404).json({ error: 'not_found' }); return; }
    res.json(formatStaff(row));
  });

  router.patch('/:staffId', async (req, res) => {
    const { tenantId, staffId } = req.params as { tenantId: string; staffId: string };
    if (req.auth!.tenantId !== tenantId) { res.status(403).json({ error: 'forbidden' }); return; }

    const parsed = patchStaffSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: 'validation_error', details: parsed.error.issues.map((i) => i.path.join('.') || i.message) });
      return;
    }

    const { name, email, phone, isActive } = parsed.data;
    const sets: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    if (name !== undefined)     { sets.push(`name = $${i++}`);      values.push(name); }
    if (email !== undefined)    { sets.push(`email = $${i++}`);     values.push(email ?? null); }
    if (phone !== undefined)    { sets.push(`phone = $${i++}`);     values.push(phone ?? null); }
    if (isActive !== undefined) { sets.push(`is_active = $${i++}`); values.push(isActive); }
    values.push(staffId);

    const row = await withTenantContext(pool, tenantId, async (client) => {
      if (sets.length === 0) {
        const { rows } = await client.query<StaffRow>(
          `SELECT ${STAFF_COLS} FROM staff WHERE id = $1 AND tenant_id = $2`,
          [staffId, tenantId],
        );
        return rows[0] ?? null;
      }
      const { rows } = await client.query<StaffRow>(
        `UPDATE staff SET ${sets.join(', ')} WHERE id = $${i} RETURNING ${STAFF_COLS}`,
        values,
      );
      return rows[0] ?? null;
    });

    if (!row) { res.status(404).json({ error: 'not_found' }); return; }
    res.json(formatStaff(row));
  });

  // ---------------------------------------------------------------------------
  // Service assignment
  // ---------------------------------------------------------------------------

  router.get('/:staffId/services', async (req, res) => {
    const { tenantId, staffId } = req.params as { tenantId: string; staffId: string };
    if (req.auth!.tenantId !== tenantId) { res.status(403).json({ error: 'forbidden' }); return; }

    const rows = await withTenantContext(pool, tenantId, async (client) => {
      const { rows } = await client.query<ServiceRow>(
        `SELECT s.id, s.tenant_id, s.name, s.description, s.duration_minutes, s.created_at
         FROM services s
         JOIN staff_services ss ON ss.service_id = s.id
         WHERE ss.staff_id = $1
         ORDER BY s.created_at`,
        [staffId],
      );
      return rows;
    });

    res.json(rows.map(formatService));
  });

  router.put('/:staffId/services', async (req, res) => {
    const { tenantId, staffId } = req.params as { tenantId: string; staffId: string };
    if (req.auth!.tenantId !== tenantId) { res.status(403).json({ error: 'forbidden' }); return; }

    const parsed = putServicesSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: 'validation_error', details: parsed.error.issues.map((i) => i.path.join('.') || i.message) });
      return;
    }

    const { serviceIds } = parsed.data;
    const rows = await withTenantContext(pool, tenantId, async (client) => {
      await client.query('DELETE FROM staff_services WHERE staff_id = $1', [staffId]);
      for (const serviceId of serviceIds) {
        await client.query(
          'INSERT INTO staff_services (staff_id, service_id, tenant_id) VALUES ($1, $2, $3)',
          [staffId, serviceId, tenantId],
        );
      }
      const { rows } = await client.query<ServiceRow>(
        `SELECT s.id, s.tenant_id, s.name, s.description, s.duration_minutes, s.created_at
         FROM services s
         JOIN staff_services ss ON ss.service_id = s.id
         WHERE ss.staff_id = $1
         ORDER BY s.created_at`,
        [staffId],
      );
      return rows;
    });

    res.json(rows.map(formatService));
  });

  // ---------------------------------------------------------------------------
  // Schedules
  // ---------------------------------------------------------------------------

  router.get('/:staffId/schedules', async (req, res) => {
    const { tenantId, staffId } = req.params as { tenantId: string; staffId: string };
    if (req.auth!.tenantId !== tenantId) { res.status(403).json({ error: 'forbidden' }); return; }

    const rows = await withTenantContext(pool, tenantId, async (client) => {
      const { rows } = await client.query<ScheduleRow>(
        'SELECT id, day_of_week, start_time, end_time FROM staff_schedules WHERE staff_id = $1 ORDER BY day_of_week, start_time',
        [staffId],
      );
      return rows;
    });

    res.json(rows.map(formatSchedule));
  });

  router.put('/:staffId/schedules', async (req, res) => {
    const { tenantId, staffId } = req.params as { tenantId: string; staffId: string };
    if (req.auth!.tenantId !== tenantId) { res.status(403).json({ error: 'forbidden' }); return; }

    const parsed = putSchedulesSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: 'validation_error', details: parsed.error.issues.map((i) => i.path.join('.') || i.message) });
      return;
    }

    const { windows } = parsed.data;
    const rows = await withTenantContext(pool, tenantId, async (client) => {
      await client.query('DELETE FROM staff_schedules WHERE staff_id = $1', [staffId]);
      for (const w of windows) {
        await client.query(
          'INSERT INTO staff_schedules (staff_id, tenant_id, day_of_week, start_time, end_time) VALUES ($1, $2, $3, $4, $5)',
          [staffId, tenantId, w.dayOfWeek, w.startTime, w.endTime],
        );
      }
      const { rows } = await client.query<ScheduleRow>(
        'SELECT id, day_of_week, start_time, end_time FROM staff_schedules WHERE staff_id = $1 ORDER BY day_of_week, start_time',
        [staffId],
      );
      return rows;
    });

    res.json(rows.map(formatSchedule));
  });

  // ---------------------------------------------------------------------------
  // Overrides
  // ---------------------------------------------------------------------------

  router.get('/:staffId/overrides', async (req, res) => {
    const { tenantId, staffId } = req.params as { tenantId: string; staffId: string };
    if (req.auth!.tenantId !== tenantId) { res.status(403).json({ error: 'forbidden' }); return; }

    const { from, to } = req.query as Record<string, string | undefined>;
    const conditions = ['staff_id = $1'];
    const params: unknown[] = [staffId];

    if (from && DATE_RE.test(from)) {
      params.push(from);
      conditions.push(`end_date >= $${params.length}::date`);
    }
    if (to && DATE_RE.test(to)) {
      params.push(to);
      conditions.push(`start_date <= $${params.length}::date`);
    }

    const rows = await withTenantContext(pool, tenantId, async (client) => {
      const { rows } = await client.query<OverrideRow>(
        `SELECT ${OVERRIDE_SELECT} FROM staff_schedule_overrides WHERE ${conditions.join(' AND ')} ORDER BY start_date, start_time`,
        params,
      );
      return rows;
    });

    res.json(rows.map(formatOverride));
  });

  router.post('/:staffId/overrides', async (req, res) => {
    const { tenantId, staffId } = req.params as { tenantId: string; staffId: string };
    if (req.auth!.tenantId !== tenantId) { res.status(403).json({ error: 'forbidden' }); return; }

    const parsed = overrideBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: 'validation_error', details: parsed.error.issues.map((i) => i.path.join('.') || i.message) });
      return;
    }

    const { startDate, endDate, type, startTime, endTime } = parsed.data;
    const row = await withTenantContext(pool, tenantId, async (client) => {
      const { rows } = await client.query<OverrideRow>(
        `INSERT INTO staff_schedule_overrides (staff_id, tenant_id, start_date, end_date, type, start_time, end_time)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING ${OVERRIDE_SELECT}`,
        [staffId, tenantId, startDate, endDate, type, startTime, endTime],
      );
      return rows[0];
    });

    res.status(201).json(formatOverride(row));
  });

  router.patch('/:staffId/overrides/:overrideId', async (req, res) => {
    const { tenantId, staffId, overrideId } = req.params as { tenantId: string; staffId: string; overrideId: string };
    if (req.auth!.tenantId !== tenantId) { res.status(403).json({ error: 'forbidden' }); return; }

    const parsed = overrideBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: 'validation_error', details: parsed.error.issues.map((i) => i.path.join('.') || i.message) });
      return;
    }

    const { startDate, endDate, type, startTime, endTime } = parsed.data;
    const row = await withTenantContext(pool, tenantId, async (client) => {
      const { rows } = await client.query<OverrideRow>(
        `UPDATE staff_schedule_overrides
         SET start_date = $1, end_date = $2, type = $3, start_time = $4, end_time = $5
         WHERE id = $6 AND staff_id = $7
         RETURNING ${OVERRIDE_SELECT}`,
        [startDate, endDate, type, startTime, endTime, overrideId, staffId],
      );
      return rows[0] ?? null;
    });

    if (!row) { res.status(404).json({ error: 'not_found' }); return; }
    res.json(formatOverride(row));
  });

  router.delete('/:staffId/overrides/:overrideId', async (req, res) => {
    const { tenantId, staffId, overrideId } = req.params as { tenantId: string; staffId: string; overrideId: string };
    if (req.auth!.tenantId !== tenantId) { res.status(403).json({ error: 'forbidden' }); return; }

    let rowCount = 0;
    await withTenantContext(pool, tenantId, async (client) => {
      const result = await client.query(
        'DELETE FROM staff_schedule_overrides WHERE id = $1 AND staff_id = $2',
        [overrideId, staffId],
      );
      rowCount = result.rowCount ?? 0;
    });

    if (rowCount === 0) { res.status(404).json({ error: 'not_found' }); return; }
    res.status(204).send();
  });

  return router;
}
