// Legacy/static export only. The PostgreSQL application reads its live data
// through /api/public/notebook and never uses this snapshot as a save source.
// Keep private notebooks and backups out of public project data.
window.PICTUREBOOK_PUBLIC = null;
