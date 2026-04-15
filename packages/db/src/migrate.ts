import { config } from 'dotenv';
import { resolve } from 'path';
import { migrate, status } from './migrator.js';

config({ path: resolve(process.cwd(), '../../.env') });

const command = process.argv[2];
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('Error: DATABASE_URL is not set');
  process.exit(1);
}

if (command === 'up') {
  migrate(databaseUrl)
    .then((count) => {
      console.log(`Applied ${count} migration(s).`);
      process.exit(0);
    })
    .catch((err: Error) => {
      console.error(`Migration failed: ${err.message}`);
      process.exit(1);
    });
} else if (command === 'status') {
  status(databaseUrl)
    .then((rows) => {
      if (rows.length === 0) {
        console.log('No migration files found.');
        process.exit(0);
      }
      const colVersion = 'Version';
      const colFile = 'File';
      const colState = 'State';
      const colApplied = 'Applied At';

      const maxFile = Math.max(colFile.length, ...rows.map((r) => r.filename.length));

      const header = `${colVersion.padEnd(8)}  ${colFile.padEnd(maxFile)}  ${colState.padEnd(7)}  ${colApplied}`;
      const divider = '-'.repeat(header.length);

      console.log(header);
      console.log(divider);
      for (const row of rows) {
        const state = row.appliedAt ? 'applied' : 'pending';
        const appliedAt = row.appliedAt ? row.appliedAt.toISOString() : '-';
        console.log(
          `${row.version.padEnd(8)}  ${row.filename.padEnd(maxFile)}  ${state.padEnd(7)}  ${appliedAt}`,
        );
      }
      process.exit(0);
    })
    .catch((err: Error) => {
      console.error(`Status failed: ${err.message}`);
      process.exit(1);
    });
} else {
  console.error('Usage: migrate <up|status>');
  process.exit(1);
}
