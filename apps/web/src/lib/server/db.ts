import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

if (!process.env.APP_DATABASE_URL) throw new Error('APP_DATABASE_URL is not set');
export const db = new Pool({ connectionString: process.env.APP_DATABASE_URL });
