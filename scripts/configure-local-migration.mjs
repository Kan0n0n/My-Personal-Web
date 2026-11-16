// Explicit helper for this project's local Compose database only.
import {readFile,writeFile} from 'node:fs/promises';
import {database} from '../server/db.mjs';
import {databaseError} from '../server/database-errors.mjs';
let pool;
try {
  if (process.env.MIGRATION_DATABASE_URL) throw Error('A migration connection is already configured; it was not changed.');
  const url=new URL(process.env.DATABASE_URL);
  if (!['127.0.0.1','localhost'].includes(url.hostname) || (url.port && url.port!=='5432') || url.pathname!=='/picturebook') throw Error('This helper supports only the local Compose picturebook database on port 5432.');
  if (!process.env.POSTGRES_ADMIN_PASSWORD || process.env.POSTGRES_ADMIN_PASSWORD.includes('CHANGE_ME')) throw Error('Set POSTGRES_ADMIN_PASSWORD in .env to the password used when creating the local database container.');
  url.username='picturebook_admin'; url.password=process.env.POSTGRES_ADMIN_PASSWORD;
  pool=database(url.href);
  const result=await pool.query("SELECT has_schema_privilege(current_user, 'public', 'CREATE') AS allowed");
  if (!result.rows[0].allowed) throw Error('The administrator connection does not have schema creation privileges.');
  const file=new URL('../.env',import.meta.url), original=await readFile(file,'utf8');
  const line=`MIGRATION_DATABASE_URL=${url.href}`;
  const updated=/^MIGRATION_DATABASE_URL\s*=.*$/m.test(original)?original.replace(/^MIGRATION_DATABASE_URL\s*=.*$/m,()=>line):original+'\n'+line+'\n';
  await writeFile(file,updated);
  console.log('Verified local administrator connection and saved MIGRATION_DATABASE_URL in .env. The application connection was kept unchanged.');
} catch (error) {
  console.error(error.code ? databaseError(error) : error.message?.startsWith('Set DATABASE_URL') ? databaseError(error) : error.message);
  process.exitCode=1;
} finally { await pool?.end(); }
