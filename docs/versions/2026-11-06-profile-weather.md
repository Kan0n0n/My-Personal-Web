# Version 2.0.4 — Profile defaults and weather recovery

6 November 2026

New database profiles contain empty optional text fields. Those values previously erased the welcome text, music labels, and Watching/Playing/Doing copy in owner mode. Empty optional text now means “use the HTML/page default,” including in the editor state. Existing nonempty profile values are preserved, and reading the profile does not write to the database.

Added a small owner-only pencil button to In my little world. Its dedicated form updates only the three interests through the revision-protected profile API, retaining music metadata and profile visibility.

Fixed the weather null-property crash: the loading template is itself the message element, so searching its descendants returned null. Loading now writes to the template root. Weather responses tolerate a missing timestamp and show helpful errors for missing current conditions, failed requests, and denied/unavailable browser location.

Added manual city/town search with region and country selection. Forecasts use the selected coordinates, and refresh retains the selected place for the current page visit. Browser location reports coarse accuracy when available. Requests are made only after user interaction, and no location is stored in the notebook. Late responses cannot overwrite a newer place selection.

Verification: 35 frontend/static scenarios, 13 embedded PostgreSQL/API scenarios, and 7 mocked music scenarios pass. New checks cover empty-profile defaults, interest edits preserving unrelated fields, loading-template root behaviour, missing/denied geolocation, coordinate forecasts without timestamps, incomplete weather responses, and manual place selection. Weather tests use mocked provider responses; actual location accuracy and browser permissions depend on the user's device. No schema migration is needed.

Provider contracts: [Open-Meteo forecast](https://open-meteo.com/en/docs) and [city search](https://open-meteo.com/en/docs/geocoding-api).
