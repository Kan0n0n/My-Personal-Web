# Future update plan

17 November 2026: the React/Vite, Tailwind and Node.js/Express migration is implemented on `test/react-node-tailwind`. See the [execution plan](FRAMEWORK-MIGRATION-PLAN.md) and [version 3 verification notes](versions/2026-11-17-react-migration.md). The historical phases below are not a current implementation checklist.

Status, 6 November 2026: version 2.0.0 implements PostgreSQL persistence, owner authentication, publishing, trash, and transactional empty-account import. See [current contracts and remaining limits](API-REFERENCE.md). The original phases below predate this implementation. Native database setup, deployment, and browser verification remain environment tasks.

Planning baseline: 1.2.0, 5 November 2026. Ordinary HTML layouts and shared HTML templates are now implemented. Items below are proposed work. Work in small, reviewable versions and record each release in `data/changelog.json`.

## Phase 1 — settle the visual design and reliability

1. Review the new anime-homepage direction together. Tune the logo size, palette, border density, banner height, and sidebar order against the owner’s preference. Keep the surviving artwork and letter/image effects.
2. Test every page at 320, 360, 390, 412, 768, 1024, 1366, and 1920 CSS pixels, portrait/landscape, and 200% zoom. Verify no page-wide horizontal scrolling; test unusually long profile names, titles, URLs, and imported book paths.
3. Test Chrome/Firefox/Edge desktop and Chrome Android, plus Safari if available. Verify the folder picker’s actual mobile availability; keep individual-file import working everywhere.
4. Complete keyboard and touch review: focus order, visible focus, native dialogs, extractor zoom close/Tab/Escape, reading controls, calendar reminders, coarse-pointer targets, and reduced-motion preferences. Run text/background contrast checks.
5. Add real browser regression checks for writing/editing/deleting, task movement, search/filtering, IndexedDB books, audio selection, and backup/restore when browser automation is available. Keep VM checks as fast logic checks.

Done when: the owner approves the visual direction, all target widths are readable and operable, and browser-tested workflows are recorded in a version note.

## Phase 2 — protect personal writing

1. Introduce a complete schema for every record, including dates, statuses, episode/rating bounds, IDs, bookmark progress, and safe object keys. Validate imported books and notebook size before changing existing data.
2. Make storage writes transactional at the application level: stage a restore, keep a recovery snapshot, and commit only after every storage write succeeds. Roll back on localStorage/IndexedDB failures.
3. Add recoverable trash and export-before-delete options for entries/books. Prevent silent loss when the browser quota is full or storage is disabled.
4. Add backup reminders, the last successful backup timestamp, and a round-trip restore test. Offer separate notebook-only and full-library backups for large collections.
5. Split `picturebook.js` into small modules for storage, page rendering, forms, widgets, and the reader once behaviour is covered by browser tests. Keep module contracts documented.

Done when: invalid backups cannot partially replace a notebook, failed saves leave previous content recoverable, and all restore paths are tested.

## Phase 3 — publishing and the change archive

1. Choose hosting and whether public pages need permanent URLs for individual posts/stories. Keep the work board, resource links, reminders, and local books private by default.
2. Add authenticated owner editing and a public read-only view if editing across devices is needed. Decide the data model and migration path before adding a database.
3. Add a preview for the public snapshot showing exactly what will be shared. Improve the existing export into a deployment workflow only after the owner chooses a host.
4. Add Git with a clear commit convention, then a release helper or CI job that creates `data/changelog.json` entries and version notes from reviewed commits. Keep human-readable explanations instead of exposing raw diffs as the only archive.
5. Add RSS, permalink pages, tag archives, draft/published states, optional spoiler flags for longer writings, and readable Markdown rendering with sanitisation.

Done when: the owner can review/publish a post, visitors cannot alter shared content, and each deployed version has matching code/history notes.

## Phase 4 — teaching materials and work

1. Select a cloud provider (Drive, OneDrive, Dropbox, or another service). Begin with read-only folder listing and links; define which materials can be public.
2. Add server-side OAuth and scoped permissions if needed. Keep provider credentials out of static JavaScript and exports. Document reconnect, failure, and permission-revocation behaviour.
3. Add resource folders, tags, subject/class metadata, file type/size, previews, and broken-link detection. Add upload/download only after permissions and quotas are defined.
4. Expand tasks with priorities, categories/classes, recurring work, due-date views, and optional reminder export. Add calendar integration only if the owner wants it.

Done when: the chosen provider works with real materials and no private file URLs or tokens leak into public exports.

## Phase 5 — reading, anime, and music

1. Add EPUB support with a maintained parser, sanitised rendering, a table of contents, and offline tests. Treat PDF as a separate viewer rather than assuming it behaves like flowing text.
2. Group novel folders into books/chapters; support natural chapter order, automatic place saving, adjustable line height/margins/fonts, and optional persistent folder access where supported.
3. Decide whether reading progress should sync. Use explicit import/copy semantics so a removed browser book never deletes the original file.
4. Add optional anime covers, richer personal scoring categories, favourites, watch-date history, and import/export. Add an external catalogue only after deciding whether it improves the personal style of the log.
5. Add saved music files or owned/allowed streaming links, a playlist, a proper persistent player if desired, and accessible time/volume controls. Explain storage/quota and licensing expectations before hosting audio.

Done when: each added format/service has tested failure states and local content stays recoverable.

## Phase 6 — recover and modernise the extractor

1. Locate the original backend source/model assets and document the `/api/analyze` request/response contract. Do not claim the front end restores the model service itself.
2. Replace the hardcoded localhost URL with a clearly configured endpoint; plan how Android reaches the service and how HTTPS/CORS will work.
3. Validate response JSON and image URLs; restrict permitted result origins/schemes. Add upload size/type checks, cancellation, timeouts, backend health messaging, and object-URL cleanup.
4. Extract the graph builder into a testable function and test the special `relation_type:` field, duplicate IDs, missing text arrays, unmatched labels, and empty results. Consider local-vendoring the graph library with licence attribution for offline use.
5. Remove obsolete race-picker CSS and missing icon-font references only after retaining a useful historical snapshot. Simplify `legacy/utilities.css` into an extractor-only stylesheet.

Done when: a real diagram completes end-to-end, errors are clear, and the service can be reached from the intended devices.

## Suggested release order

| Release | Focus | Prerequisite |
| --- | --- | --- |
| 1.2.1 | Owner’s visual adjustments and actual device/browser review | Current HTML separation |
| 1.3.0 | Strict validation, reliable restore, recoverable deletion | Browser coverage |
| 1.4.0 | Public publishing workflow, permalinks, archive automation | Hosting/data decisions |
| 1.5.0 | Teaching cloud connection and work improvements | Provider choice and access design |
| 1.6.0 | EPUB/reader, richer anime log and music | Stable storage |
| Separate tool release | Working extractor backend and device connectivity | Original backend recovery |

Keep speculative integrations out of the interface until they work. Revisit the sequence after using the rebuilt site for a while; daily friction should set priorities.

