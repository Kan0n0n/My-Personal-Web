import pg from 'pg';
import {readFile, readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';

// DATE values represent calendar dates, not midnight in the host's timezone.
pg.types.setTypeParser(1082, value => value);
export function database(url = process.env.DATABASE_URL) {
  if (!url || url.includes('CHANGE_ME')) throw Error('Set DATABASE_URL in .env before starting the server.');
  return new pg.Pool({connectionString: url, max: 10, connectionTimeoutMillis: 10000, statement_timeout: 30000});
}
export async function transaction(pool, action) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await action(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
export async function migrate(pool) {
  return transaction(pool, async client => {
    await client.query('SELECT pg_advisory_xact_lock(41830611)');
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
    for (const name of (await readdir(new URL('./migrations/', import.meta.url))).filter(x => x.endsWith('.sql')).sort()) {
      const sql = await readFile(new URL(`./migrations/${name}`, import.meta.url), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const existing = (await client.query('SELECT checksum FROM schema_migrations WHERE name=$1', [name])).rows[0];
      if (existing) {
        if (existing.checksum !== checksum) throw Error(`Applied migration changed: ${name}`);
        continue;
      }
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)', [name,checksum]);
    }
  });
}
