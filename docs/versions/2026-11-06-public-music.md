# Version 2.0.6 — A soundtrack for every visitor

Music of the Day previously disappeared for signed-out visitors when the owner's profile was private. Public notebook responses now return the owner's song title, artist, cover URL, and listening URL independently of profile visibility. Other private profile fields remain excluded. No database migration or resaving of the existing song is needed.

Music editing stays owner-only. Updated editor help and save feedback explain that the saved song is public. Regression checks cover signed-out rendering, public music with a private profile, an owner changing the song, and rejection of anonymous profile writes.

Validation: 36 frontend/static, 14 embedded PostgreSQL/API, and 7 mocked music API scenarios passed. Restarted the local server and checked the signed-out live API response for public music fields. No database migration was required.
