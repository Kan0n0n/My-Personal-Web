// Never print the raw driver error: it may contain connection details or SQL.
export function databaseError(error) {
  const codes = [error?.code, ...(error?.errors ?? []).map(item => item.code)].filter(Boolean);
  const hints = {
    ECONNREFUSED: 'PostgreSQL is not accepting connections at the configured host/port. Start the database and check the connection URL.',
    ENOTFOUND: 'The database hostname could not be resolved. Check the hostname in the connection URL.',
    EACCES: 'The operating system denied the database connection.',
    EPERM: 'The operating system denied the database connection.',
    ETIMEDOUT: 'The database connection timed out. Check the host, port, and firewall.',
    '28P01': 'PostgreSQL rejected the login/password. Check MIGRATION_DATABASE_URL. Changing a Compose environment password does not change an existing database password.',
    '28000': 'PostgreSQL rejected authentication. Check the database login and authentication configuration.',
    '3D000': 'The database named in the connection URL does not exist. Create it or correct the database name.',
    '42501': 'The database login lacks migration privileges. Set MIGRATION_DATABASE_URL to the database administrator/schema owner, not the restricted application login.',
    '42P07': 'A table already exists outside the recorded migration history. Inspect the existing schema before retrying; do not delete notebook tables.',
    '57P03': 'PostgreSQL is still starting or recovering. Wait for it to become healthy and retry.',
    '53300': 'PostgreSQL has reached its connection limit.',
    DEPTH_ZERO_SELF_SIGNED_CERT: 'The database TLS certificate is not trusted. Configure the correct CA certificate.',
    SELF_SIGNED_CERT_IN_CHAIN: 'The database TLS certificate chain is not trusted. Configure the correct CA certificate.'
  };
  for (const code of codes) if (Object.hasOwn(hints, code)) return `Database error ${code}: ${hints[code]}`;
  if (error?.message?.startsWith('Applied migration changed:')) return 'An already-applied migration file has changed. Restore the original file and put new changes in a new migration.';
  if (error?.message?.startsWith('Set DATABASE_URL')) return 'Set DATABASE_URL, or MIGRATION_DATABASE_URL for the migration CLI, to a real PostgreSQL connection URL in .env.';
  return `Database operation failed${codes.length ? ` (${codes.join(', ')})` : ''}. Check connection configuration and PostgreSQL server logs; credentials and SQL are omitted here.`;
}
