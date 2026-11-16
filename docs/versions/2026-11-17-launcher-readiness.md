# Version 3.0.1 — Detect outdated local servers

The previously running version-2 server survived the framework migration. Refreshing the browser fetched the new source HTML, whose React entry `/frontend/main.jsx` was rejected with HTTP 403 by that old server. The result was the original background with no mounted app.

The affected server was identified by its listening port and Node command, then restarted with the current built-app server. No database records were changed.

The launcher now compares the served home page with the local production build and checks that its same-origin JavaScript assets return a JavaScript response. An incompatible existing server produces an instruction to stop its launcher and reopen it, rather than silently reopening a blank page. New startup also waits for frontend readiness as well as the API.

Six focused regression scenarios cover a working build, stale source HTML, missing assets, HTML returned as JavaScript, missing scripts and external scripts. Run through `npm test` or `node tests/frontend-check.mjs`.
