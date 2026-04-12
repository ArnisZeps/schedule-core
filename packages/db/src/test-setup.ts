import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env from monorepo root (packages/db/../../.env)
config({ path: resolve(process.cwd(), '../../.env') });

// Tests drop and recreate tables. Require an explicit TEST_DATABASE_URL so
// the app's DATABASE_URL can never be accidentally targeted.
if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    'TEST_DATABASE_URL is not set. ' +
    'Set it to a dedicated test/dev branch — never point it at production.',
  );
}
