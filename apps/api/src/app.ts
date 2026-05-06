import express, { type Express } from 'express';
import { createDb } from '@schedule-core/db';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { tenantsRouter } from './routes/tenants.js';
import { servicesRouter } from './routes/services.js';
import { availabilityRulesRouter } from './routes/availability-rules.js';
import { bookingsRouter } from './routes/bookings.js';
import { publicRouter } from './routes/public.js';
import { staffRouter } from './routes/staff.js';

export const app: Express = express();
const db = createDb();

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000')
  .split(',')
  .map(o => o.trim())

app.use((req, res, next) => {
  const origin = req.headers.origin
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  if (req.method === 'OPTIONS') { res.sendStatus(204); return }
  next()
})
app.use(express.json());
app.use('/health', healthRouter);
app.use('/auth', authRouter(db));
app.use('/tenants', tenantsRouter(db));
app.use('/tenants/:tenantId/services', servicesRouter(db));
app.use('/tenants/:tenantId/services/:serviceId/availability-rules', availabilityRulesRouter(db));
app.use('/tenants/:tenantId/bookings', bookingsRouter(db));
app.use('/tenants/:tenantId/staff', staffRouter(db));
app.use('/public/:tenantSlug', publicRouter(db));
