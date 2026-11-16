# React, Node.js and Tailwind migration execution plan

Status: implemented on the separate `test/react-node-tailwind` branch, 17 November 2026. See [version 3 implementation and verification](versions/2026-11-17-react-migration.md). The original checklist below records the intended scope; the release notes distinguish completed checks from remaining real-device/external-service checks. Baseline: version 2.3.1, a personal site with one owner, occasional visitors, and one Node.js server.

## Recommendation and purpose

Use React with Vite for the frontend, Tailwind CSS gradually for utility styling, and the existing Node.js runtime with Express 5 for backend routing. Keep PostgreSQL and the existing database services. Use JavaScript/JSX initially. Select compatible stable package versions and commit the lockfile during implementation.

React will replace the existing manual page rendering with components and explicit state. Express is a close fit for the existing Node request/response handlers. Neither requires a visual redesign. The practical goals are shared page components, clearer ownership of interactive state, and less manual HTTP routing. Performance improvements are not assumed.

The highest immediate value is shared frontend components. Backend migration can ship separately after the frontend pilot; Tailwind need not replace the existing theme CSS.

## Whole-app inventory

| Current area | Migration work | Required behavior |
| --- | --- | --- |
| Root `index.html`, old root-page redirects, `/pages/*.html` | Preserve URL entry points in the Vite multi-page build and Express | Existing bookmarks, direct loads, refreshes and navigation work |
| Shared frame and `templates/components.html` | React layout, cards, forms and dialog components | Same artwork, column placement, dimensions, keyboard and focus behavior |
| `pages/index.html` | Home page, profile/interests editors, music and weather widgets | Public music/private profile separation; location only on user action |
| `pages/owner.html` | React owner login/session screen | No public navigation link; remembered sessions and safe error display |
| `pages/posts.html`, `pages/blog.html` | Lists, search, category filtering and editors | Draft/publication actions, Unicode, tags and conflict-safe saves |
| `pages/documents.html` | Resource list, folder labels and editor | Safe links, filtering and private access |
| `pages/work.html` | Task board and editors | Status changes, due dates, notes and failed-save recovery |
| Shared calendar | React calendar and reminder dialog | Month navigation, local dates, private reminders and deletion |
| `pages/utilities.html` | Picker, text tools and backup/trash controls | Existing tool results, server export, signed import preview/commit and restore actions |
| `pages/anime.html` | Anime list, filters and editor | Existing statuses, ratings, episode counts, spoilers and publication rules |
| `pages/archive.html`, `data/changelog.json` | React timeline reading the existing changelog | All historical entries and version-note links remain accessible |
| `pages/novels.html` | Shelf, folder controls, cover preview and reader shell | All formats, uploads/downloads, organization, reading position and speech |
| `pages/ultilities.html`, `assets/js/ai2d.js` | React extractor UI and an isolated graph container | File selection, gallery, zoom, JSON download and graph behavior; preserve the unusual URL |
| `server/api.mjs` | Express route groups and shared errors | Every existing API path, payload, ownership check and status code |
| Other `server/` modules, SQL and grants | Reuse; change only integration points | Existing schema, data, passwords, sessions, imports and transactions |
| `scripts/`, launcher, Compose, docs and tests | Build/start integration and updated verification | Ordinary Windows startup, admin commands and recoverable releases |

The extractor's separate service at `localhost:5000` is outside this repository. Its frontend is included in migration, with mocked contract tests; successful real analysis requires that service to be available. Do not substitute a different model/backend silently.

## Target structure and ownership

Keep `server/`, `scripts/`, SQL and current source assets in place. Add a small frontend source directory with `components/`, `pages/`, an API module and entry points selected by each existing HTML page. Build public files into `dist/`. Create files as pages migrate; do not scaffold empty layers.

Use React state for forms and page data, with a small shared authentication/notebook context only where multiple components need it. Put writes in user actions; use effects for external synchronization and cleanup. Keep confirmed server records authoritative, revisions intact, and unsaved form data available after errors. Never serialize private notebook data into a public build or initial HTML.

Reuse the existing reader modules through refs and effects. React owns the shell and controls; imperative renderers own their dedicated content containers. Do not use raw HTML injection for notebook content. EPUB sanitization continues through DOMPurify.

Start with React/ReactDOM and Express as runtime additions; Vite, its React plugin and Tailwind tooling support the build. Add browser/component test tooling only where existing tools cannot verify the migration. No workspace/package split is needed for this single app.

## Visual contract

Preserve these current design choices:

- Overlock and Tegaki fonts, wordmark lettering and decorative symbols.
- Existing mascot, backgrounds, illustrations, paper textures and gingham frame.
- Warm paper/pink/green palette and existing CSS variables.
- Compact columns, dense spacing, narrow borders and small corner radii.
- Existing button gradients, focus outlines, native dialogs and reader styling.
- Responsive behavior at the current 1000, 700 and 420 pixel breakpoints, plus coarse-pointer and reduced-motion rules.

Import the existing styles first without rewriting them. Disable Tailwind Preflight, prefix Tailwind utilities, and map only needed theme values to existing design variables. Explicitly plan cascade layers: existing unlayered CSS can override layered Tailwind utilities regardless of file order. Verify a pilot before moving any existing rules into layers.

Keep decorative CSS in CSS. Use utilities for simple layout and spacing where they make the component easier to read. Do not introduce a component kit or convert every class to Tailwind. Check target browser versions against Tailwind's compatibility requirements before selecting the exact release.

## Phases and completion checks

### 0. Establish recovery and comparison

- Capture a source snapshot; use Git history if available, otherwise make a verified source archive before implementation. Keep secrets and private backups outside any public output.
- Take a database backup and verify recovery in a separate test database. Never rehearse migration against the only notebook copy.
- Record baseline screenshots of home, owner login, a list/editor page, work board, library and open reader at desktop, tablet and phone widths. Freeze clocks, weather and fixture content for meaningful comparisons.
- Run the existing 125 scenarios. Add a small real-browser smoke/visual suite for the representative screens and sign-in/edit/save workflow. Screenshot changes require review; do not automatically accept a new baseline.

Complete when: source recovery, database recovery and repeatable visual baselines exist.

### 1. Add the frontend build and a small pilot

- Add React, ReactDOM, Vite, its React plugin and the Tailwind build integration with a lockfile update. Check Node compatibility before choosing versions; update the documented Node minimum only if required.
- Preserve existing page URLs and full-page navigation. Start with a multi-page build rather than adding a client router.
- Pilot one bounded area on Utilities, such as the choice picker. Preserve its HTML structure, classes, labels and keyboard behavior.
- Give React sole ownership of that area. Remove its old event listeners and render path at the same time; do not let React and `picturebook.js` update the same DOM subtree.
- Enable React development Strict Mode and verify repeat setup/cleanup does not duplicate timers, requests or writes. Avoid mount-triggered mutations.
- Verify Tailwind can coexist with the original CSS before replacing any styling. Include all template sources in class detection and avoid constructed utility names that the build cannot detect.
- Keep the developer workflow on one browser origin for `/api` calls. Configure the exact development origin for CSRF validation; retain strict production origin checks and cookies.

Complete when: the pilot works, visual comparisons show no unexplained changes, and untouched pages still run.

### 2. Move shared layout and ordinary pages

- Convert actual repeated markup into components: site frame, masthead, directory, paper panel, profile/calendar widgets, record cards and editor dialog.
- Preserve DOM structure where CSS depends on grid placement, direct children or selectors. Avoid adding wrapper elements merely for component boundaries.
- Migrate the shared frame, owner login and Home, then Utilities/Archive, Posts/Blog, Documents/Work and Anime in small releases. Move the extractor frontend after these ordinary pages, retaining the external-service contract.
- Move `templates/components.html` markup into React components as each consumer migrates. Retain the template file only while legacy consumers remain, then delete the unused runtime fetch and templates.
- Keep the browser legacy-data export available. Preserve its origin and storage names so old localStorage/IndexedDB content remains discoverable. Keep public snapshot export and version-note links working.
- Move each migrated page's state and events out of `picturebook.js`. Reuse the API contract and confirmed-save behavior. Keep unsaved forms on failed or conflicting writes.
- Retain the owner/visitor distinction, keyboard navigation, labels, focus restoration, hidden owner controls and reduced-motion behavior.
- Adapt tests to the component behavior as old render paths disappear. Keep database/API tests and replace DOM-stub checks only where the implementation has changed.

Complete when: ordinary pages use shared components, each DOM subtree has one owner, and old code for migrated behavior has been removed.

### 3. Introduce Express without replacing data services

- Move the HTTP entry point to Express 5, then replace route matching one route family at a time. A temporary mount of the old handler is acceptable during migration; do not leave the framework as a permanent pass-through wrapper.
- Reuse `auth.mjs`, `model.mjs`, `store.mjs`, `import.mjs`, `book-files.mjs` and `db.mjs`. Keep SQL, migrations, transactions and password/session formats intact.
- Keep JSON/body handling bounded. During migration, use existing `readJSON`/`readBody` before adding competing parsers. Raw PDF/EPUB uploads must never pass through a JSON parser.
- Preserve API paths, response fields, meaningful status codes, revision checks, session cookie flags, exact origin validation, owner isolation and login throttling.
- Preserve public-file allowlisting, realpath containment, vendor-only dependency exposure, security headers, old-page redirects and HEAD behavior. Never serve the project root with unrestricted static middleware.
- Keep request/header timeouts and graceful database shutdown. Send sanitized errors; never serialize SQL, credentials or private records into logs or responses.
- Run the existing integration tests against Express, adding parity checks for changed dispatch/error behavior.
- Migrate route families explicitly: session/login/logout; public notebook/music; private notebook/profile; records/publication/trash; folders; book upload/content/file/progress; backup export/import. Preserve all existing administrator CLI commands independently of the HTTP framework.

Complete when: the existing API contracts pass on Express, old dispatch code is removed, and no database migration was needed solely for the framework.

### 4. Migrate the reading room last

- Keep `novel-formats.mjs`, `reading-position.mjs` and `reader-speech.mjs` as reusable modules initially.
- Let React own the reader controls and shell; give the PDF/EPUB renderer a dedicated container React does not render children into.
- Connect mount/unmount cleanup to renderer destruction, speech cancellation, timers, listeners, object URLs and pending saves. Keep save serialization and stale-reader guards intact.
- Handle rapid book changes and Strict Mode setup/cleanup cycles without duplicate saves or stale state updates. Trigger required saves before controlled navigation; do not assume React awaits asynchronous effect cleanup. Retain pagehide/visibility handling for best-effort exit saves and report persistence failures honestly.
- Verify TXT/MD, sanitized EPUB and PDF, covers, folder actions, original downloads, autosave, manual saves, cross-device conflicts and restored positions/preferences.
- Test real device voices, highlights, page turns and zoom in a browser. Preserve the recently fixed conflict-save and malformed-image regressions.

Complete when: the current reader scenarios pass and actual browser reading/saving works without a visual regression.

### 5. Finish startup, release and rollback

- Serve only the built public output and explicitly allowed original assets; exclude server code, `.env`, source backups and private database exports. Verify emitted font/image URLs, PDF workers and PDF support assets.
- Add clear development/build/production commands. Keep `Start Picture Book.cmd` as the ordinary launch path and `--check` as configuration validation only.
- Target commands: `npm run dev` for development, `npm run build` for public output, `npm start` for the built app, and `npm test` for verification. Keep migrations and owner setup as separate commands. Choose one browser origin in development; no permissive CORS workaround.
- Ensure a fresh checkout can install, build and start. Avoid adding a full build to every launch; fail clearly with the build command if production output is missing.
- Run all relevant tests and browser comparisons. Smoke-test the actual Windows launcher with Docker and the built frontend.
- Record every shipped phase in `data/changelog.json` and `docs/versions/`. Keep a tagged/source-archived known-good release with rollback instructions.

Complete when: the built app starts through the normal launcher, old URLs and data still work, and a rollback can restore the prior app against the unchanged schema.

## Release sequence and final acceptance

Work in this order: recovery/baselines → React/Tailwind pilot → shared layout and ordinary pages → Express API → reader and extractor completion → built-app startup and cleanup. Commit or archive a recoverable checkpoint for each phase; record shipped changes in the changelog. If a phase fails its checks, repair or revert that phase before continuing.

The migration is complete only when:

- Every page in the inventory has a React implementation, including owner login and extractor UI; no active legacy renderer competes for its DOM.
- Express owns all API dispatch while existing service/data contracts pass integration tests. No schema rewrite or data reset was needed.
- Visual comparisons at 390, 768 and 1366 CSS pixels show no unexplained appearance changes. Check 320 pixels and 200% zoom for overflow and accessibility. Include light/dark readers, dialogs, loading/error states and long content.
- Real-browser flows cover owner login/logout, visitor privacy, editing/publishing/trash, task changes, book upload/read/save/reopen, and signed backup import into a separate empty test account/database.
- Existing meaningful tests survive or have equivalent replacements. The 125 current scenarios are the baseline, not a required fixed final count; no meaningful coverage is removed simply because the implementation changed.
- The launcher starts the built app against the existing database; source/build/private-file isolation checks pass; documentation describes recovery and the new commands.
- Dead `picturebook.js`/`ai2d.js` code and unused templates are removed only after their last caller is migrated. Historical documentation and assets are not deleted without checking references.

The only external integration acceptance item that may remain pending is live extractor analysis if its separate backend is unavailable. State that limitation explicitly in the release notes; do not describe an untested external flow as complete.

## Scope boundaries and risks

No new ORM, authentication system, TypeScript conversion, state-management package, client router, SSR system or visual component library is planned initially. Add one only for an observed need. Do not combine this migration with a visual redesign or new product features.

The existing browser backup limits remain: 60 MiB files and 64 MiB request envelopes, with record-count limits. Database backups remain necessary for large libraries. A framework does not remove these limits or make the separate extractor backend available.

The main migration risks are CSS resets/precedence, duplicate DOM ownership, reader cleanup, accidentally weakened static-file or authentication restrictions, and a broken build/launcher path. Each has an explicit completion check above. The plan itself has not tested the proposed stack in this app.

## Official references

- [React incremental adoption and Vite](https://react.dev/learn/add-react-to-an-existing-project)
- [React effects and external-system cleanup](https://react.dev/reference/react/useEffect)
- [Tailwind Preflight, disabling the reset, and prefixes](https://tailwindcss.com/docs/preflight)
- [Tailwind browser compatibility](https://tailwindcss.com/docs/compatibility)
- [Express 5 migration and async errors](https://expressjs.com/en/guide/migrating-5/)
- [Vite backend/build integration](https://vite.dev/guide/backend-integration)
