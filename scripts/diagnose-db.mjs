import {database} from '../server/db.mjs';
import {databaseError} from '../server/database-errors.mjs';
let pool;
try {
  const admin = !!process.env.MIGRATION_DATABASE_URL;
  console.log(`Checking ${admin ? 'MIGRATION_DATABASE_URL' : 'DATABASE_URL (MIGRATION_DATABASE_URL is empty)'}. Credentials are hidden.`);
  pool = database(process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL);
  const result = await pool.query("SELECT has_schema_privilege(current_user, 'public', 'CREATE') AS can_migrate");
  console.log('Database connection succeeded.');
  console.log(result.rows[0].can_migrate ? 'The login has CREATE privileges on the public schema.' : 'The login cannot create tables in the public schema. Use an administrator/schema-owner migration connection.');
} catch (error) { console.error(databaseError(error)); process.exitCode = 1; }
finally { await pool?.end(); }
