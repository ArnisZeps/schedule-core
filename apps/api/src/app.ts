import express from 'express';
import { createDb } from '@schedule-core/db';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';

export const app = express();
const db = createDb();

app.use(express.json());
app.use('/health', healthRouter);
app.use('/auth', authRouter(db));
