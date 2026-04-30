import express, { type Express } from 'express';
import { createDb } from '@schedule-core/db';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { tenantsRouter } from './routes/tenants.js';
import { resourcesRouter } from './routes/resources.js';
import { availabilityRulesRouter } from './routes/availability-rules.js';

export const app: Express = express();
const db = createDb();

app.use(express.json());
app.use('/health', healthRouter);
app.use('/auth', authRouter(db));
app.use('/tenants', tenantsRouter(db));
app.use('/tenants/:tenantId/resources', resourcesRouter(db));
app.use('/tenants/:tenantId/resources/:resourceId/availability-rules', availabilityRulesRouter(db));
