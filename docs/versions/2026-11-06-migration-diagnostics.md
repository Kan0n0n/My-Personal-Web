# Version 2.0.1 — Migration connection diagnostics

6 November 2026

Migration previously hid all errors behind one generic message. The local database was healthy, but an empty `MIGRATION_DATABASE_URL` caused migration to use the restricted application role, which lacked schema creation privileges.

Added credential-safe database error descriptions, a read-only connection/privilege diagnostic, and an explicit local Compose helper that verifies the administrator connection before saving the missing migration URL. The migration CLI also handles configuration failures inside its error handler. The runtime connection remains restricted.

Verified the administrator connection and successfully applied migrations to the local native PostgreSQL container. No existing browser data was imported. Owner setup, runtime grants, and starting the website remain separate setup steps. Updated the setup guide with diagnostic commands.
