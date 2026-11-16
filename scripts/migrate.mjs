import {database, migrate} from '../server/db.mjs';
import {databaseError} from '../server/database-errors.mjs';
let pool;
try {
  pool = database(process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL);
  await migrate(pool);
  console.log('Database migrations applied.');
} catch (error) { console.error(databaseError(error)); process.exitCode = 1; }
finally { await pool?.end(); }
