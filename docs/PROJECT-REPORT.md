# Philine’s Picture Book — project report

Historical version-1 report. Version 2.0.0 replaces browser persistence with an authenticated PostgreSQL API. Use the [current API reference](API-REFERENCE.md) and [setup](DATABASE-SETUP.md) for current behaviour; the layout/report below is retained as historical context.

Version: 1.2.1, 5 November 2026. This report describes ordinary HTML layouts, shared component templates, the YouTube metadata widget, and the surviving extractor. Start with [EDITING-GUIDE.md](EDITING-GUIDE.md) for practical changes. The complete function and callback reference is in [CODE-REFERENCE.md](CODE-REFERENCE.md). Future work is in [UPDATE-PLAN.md](UPDATE-PLAN.md).

## 1. What the website is

A personal anime/indie-web home with a compact, approximately 2010-era visual language: a centred gingham frame, pastel gradients, thin brown borders, dotted dividers, serif italic section headings, multicoloured handwritten logo, character illustration, and small directory links. It takes layout cues from the supplied screenshot while using your own surviving artwork and site identity. No text, photos, or code from the example site were copied.

The implementation is buildless HTML, CSS, and JavaScript. A small Node server serves files and proxies YouTube metadata lookups. It is not a framework application and has no package dependencies. Authoring and private notebook data live in the browser. Public content can be exported as a static snapshot. There is no authenticated publishing backend or cloud integration yet. Static hosting alone does not supply the music lookup endpoint.

## 2. Folder structure

```text
web/
├── index.html                         Static-host entry redirect
├── README.md                          Quick start and operating guide
├── pages/                             All actual website pages
│   ├── index.html                     Home
│   ├── posts.html                     Daily notes
│   ├── blog.html                      Blogs and stories
│   ├── documents.html                 Resource links
│   ├── work.html                      Task board
│   ├── utilities.html                 Toolbox
│   ├── ultilities.html                Original AI2D tool, adapted layout
│   ├── anime.html                     Anime log
│   ├── novels.html                    Text-novel library and reader
│   └── archive.html                   Code change archive
├── assets/
│   ├── css/
│   │   ├── site.css                   Current theme and components
│   │   ├── responsive.css             Tablet, phone, touch rules
│   │   ├── animations.css             Jumping logo and image zoom
│   │   ├── legacy-tool.css            Extractor integration and responsive fixes
│   │   └── legacy/                    Retained styles from earlier versions
│   │       ├── style.css              Old CSS import entry
│   │       ├── base.css               Original fonts and background
│   │       ├── layout.css             Original fixed/percentage layout
│   │       ├── component.css          Original cards and music components
│   │       ├── utilities.css          Extractor and unused race-picker components
│   │       ├── animation.css          Original animation definitions
│   │       ├── all.css                Retained Font Awesome vendor stylesheet
│   │       └── picturebook.css        First rebuild’s scrapbook theme
│   ├── js/
│   │   ├── picturebook.js             Notebook behaviour and data binding
│   │   └── ai2d.js                    Original diagram-analysis workflow
│   ├── fonts/
│   │   ├── Overlock-Mod.ttf           Main text font
│   │   └── ktegaki-webfont.woff        Handwritten logo font
│   └── images/
│       ├── bg_2.jpg                    Surviving repeating star background
│       ├── Philine-P5V6.webp           Profile avatar and favicon
│       ├── Rozemyne-LN-4.webp          Retained illustration, currently unused
│       ├── rzmcsb_trans_rel.png        Header character illustration
│       └── loading.gif                Extractor loading indicator
├── data/
│   ├── site-content.js                Optional public content snapshot
│   └── changelog.json                 Website version archive entries
├── templates/
│   └── components.html                Editable cards, forms, reader/widget markup
├── scripts/
│   └── serve.mjs                      Static HTTP server and music metadata route
├── tests/
│   ├── check.mjs                      Static/data/music regression checks
│   └── music-api.mjs                  Real API handler with mocked YouTube
└── docs/
    ├── PROJECT-REPORT.md              This overview and visual guide
    ├── CODE-REFERENCE.md              Every function, callback group, data field
    ├── EDITING-GUIDE.md               Where and how to edit ordinary HTML
    ├── UPDATE-PLAN.md                 Prioritised future work
    ├── legacy/
    │   └── ultilities-original.html.txt  Historical HTML source, not a live page
    └── versions/
        ├── 2026-11-05.md              First rebuild notes
        ├── 2026-11-05-retro.md         Redesign/reorganisation notes
        ├── 2026-11-05-html.md          HTML/behaviour separation
        └── 2026-11-05-music.md         YouTube metadata widget and current limits
```

Only the root `index.html` remains outside `pages/`: static hosts normally expect this entry file. It contains a redirect and fallback link, not another copy of the website. All asset references are relative, so the site can also be hosted inside a subdirectory. The provided server redirects old root-level page URLs such as `/anime.html` to `/pages/anime.html`. An unrelated static host would need its own redirects to preserve those old links; only its root entry is handled by the HTML redirect.

## 3. What appears where

### Desktop: over 1000 CSS pixels

```text
┌─────────────────────────────────────────────────────────────┐
│              welcome strip                    ICT clock      │
├─────────────┬───────────────────────────────────────────────┤
│ calendar    │ multicoloured name    character illustration   │
│ reminders   │ Picture Book          (hover/focus to zoom)    │
│             ├───────────────────────────────────────────────┤
│ directory   │              short welcome message            │
│ page links  ├───────────────────────────────┬───────────────┤
│             │ welcome / page heading        │ music         │
│ profile     │ introduction / page content   │ current       │
│ status      │                               │ interests     │
│ edit button │ daily notes on home           │ weather       │
│             │                               │ (home only)   │
│ small note  │ other pages span both right-hand columns       │
│ small paths │                                               │
├─────────────┴───────────────────────────────────────────────┤
│ footer     backup / restore       readme       site report    │
└─────────────────────────────────────────────────────────────┘
```

The maximum outer width is 1150px; the sidebar is 198px and the home widget rail is 218px. The centre is flexible with `minmax(0, 1fr)` so long text does not force the page wider. Sections use white/cream surfaces and decorative gradient heading bars, with small gaps rather than floating rounded cards. The pastel gingham is built with CSS; the banner uses the surviving star image.

### Tablet: 701–1000 CSS pixels

The site becomes two columns: a 180px directory sidebar and flexible content. On home, widgets move below the main content into two columns. The task board and resource cards become single-column to avoid narrow controls; the reading shelf moves above the reader.

### Phone: 700 CSS pixels and below

The outer frame becomes a vertical flex layout. Visual order is: welcome strip, banner, short welcome message, three-column page directory, main page, home widgets, calendar, profile, small notes/links, footer. The directory stays visible without a hover-only menu. Below 420px, home widgets stack in one column. The profile uses an avatar beside its text. Native form text is at least 16px; headings wrap; dialogs scroll within the visible viewport.

Touch input is detected separately with `pointer: coarse`, so tablet touch devices also receive larger buttons. Calendar days have compact but enlarged targets. The theme uses CSS pixels, not assumptions about a specific Android model. Browser zoom and landscape changes are supported by fluid widths and reflow rules. These rules are implemented but need visual testing on actual devices.

### Logo and illustration interactions

- The default name has ordinary `.logo-char` spans in HTML. Saved profile names are split into text-only span Elements by `applyProfile()`.
- Every span receives `--order`, its zero-based position. Hovering or keyboard-focusing the wordmark starts `logo-jump`, delayed by `index × 65ms`, creating the original sequential jumping effect.
- A small apostrophe/suffix and “Picture Book” sit below/beside the name. Colour rules repeat across names of any length.
- The separate `.mascot-link` scales its image to 1.13 and rotates it slightly on hover/focus. It links home and stays keyboard accessible.
- On touch, pressing provides an active animation response. The site does not require hover to navigate or edit.
- `prefers-reduced-motion: reduce` disables animations, transitions, and zoom transformations.

## 4. Page-by-page use and file introductions

Each main HTML file now contains its complete header, navigation, sidebar, main sections, widgets where relevant, and footer. Edit these tags directly. Each loads the styles, public data, and deferred behaviour. `body[data-page]` identifies the page. JavaScript fills marked data slots and record lists; it never replaces the whole layout. Shared `templates/components.html` holds reusable cards, modal forms, empty states, reader controls, and widget results. Header/sidebar copies are deliberate so normal HTML is readable and visible before JavaScript.

| Page file | What the visitor sees / what to do |
| --- | --- |
| `pages/index.html` | Banner, introduction, latest notes, interests, weather, music. Load a YouTube watch/youtu.be link to save thumbnail/title/channel; Listen on YouTube opens the selected video in another tab. |
| `pages/posts.html` | Searchable daily-life notes. “New note” opens title, date, text, and tags; “Edit page” edits or deletes. |
| `pages/blog.html` | Longer writings. Add a Blog or Story entry; search text and filter by type. |
| `pages/documents.html` | Save a URL, title, folder/subject, and note. Search titles/folders and open links in another tab. Actual document files are not uploaded. |
| `pages/work.html` | To do / In progress / Done columns. Add tasks, notes, optional due dates; change the progress select to move a task. |
| `pages/utilities.html` | Link to extractor, random choice picker, word/character counter, backup access. |
| `pages/ultilities.html` | Standalone extractor. Select PNG/JPEG, send to local backend, inspect returned images/JSON, download JSON, or zoom a result. Backend still required. |
| `pages/anime.html` | Add title, watch status, episode count, date, 1–5 hearts, and thoughts; flag spoilers. Search/filter; thoughts expand deliberately. |
| `pages/novels.html` | Choose a text folder or individual TXT/MD files. Select a title from the shelf, adjust size/theme, and save a bookmark. Remove only the browser copy. |
| `pages/archive.html` | Timeline from `data/changelog.json`, with links to readable version notes. |

Calendar reminders are available from every main page. Click any day to list that date’s reminders and add another. Dot markers show dates with entries. Month arrows change the visible month. On mobile the calendar appears after the main content so navigation and reading come first.

The footer’s backup dialog has three separate operations: full notebook export, public snapshot export, and full restore. A restore shows a count preview and requires clicking the replacement button.

### Music of the Day

The music panel remains in the home widget rail. A circular 64px image replaces the decorative disc, with title/channel beside it. A Listen on YouTube link appears after loading a video and opens it in a new tab. The URL input, Load music button, request status, and help copy describe metadata storage. Inactive play/seek controls have been removed.

`bindAudio()` reads an HTTP(S) watch/youtu.be URL on click, validates its ID, and calls the local API. The server fetches oEmbed metadata with a ten-second timeout. `displayMusic()` validates metadata before storing it and the canonical listening URL; `applyProfile()` is the single display/restore path. API errors are shown, storage failure is distinguished from saved success, and the button always reenables. See [music changes and verification](versions/2026-11-05-music.md).

## 5. File responsibilities

### Runtime code

- **`assets/js/picturebook.js`** owns state, template/text binding, filtering, forms, local saves, calendar, music metadata lookup/display, weather, novels, and exports. `bindAudio()` retains its old name but now loads YouTube information; it does not bind playback. No HTML strings are generated. Saving updates data lists without rebuilding the page. Public data loads first without a build.
- **`templates/components.html`** contains inert, editable HTML templates with one root per component. JavaScript imports them once, clones a component, fills `data-field` slots, and attaches metadata/listeners. Keep IDs, field/input names, and action hooks when changing markup. No compilation or server template engine is involved.
- **`assets/js/ai2d.js`** runs only on the extractor page. It uploads a file, clones loading/image/JSON/graph templates at the bottom of `pages/ultilities.html`, fills returned data, builds the graph, and handles download/zoom. Backend implementation is outside the project.
- **`data/site-content.js`** assigns `window.PICTUREBOOK_PUBLIC`; `null` means use built-in introductory defaults. It is executable site data, so only replace it with a trusted export you have reviewed.
- **`scripts/serve.mjs`** runs in Node. In addition to static files, redirects, path checks, and loopback port 4173, it handles `/api/music-info` before static resolution. GET returns metadata; invalid IDs, methods, and upstream failures return JSON errors with 400, 405, and 502 respectively.
- **`tests/check.mjs`** runs in Node. It makes a lightweight fake DOM/storage environment, executes the main application in a VM, checks paths and state flows, and optionally exercises real HTTP routes. It is not a browser engine.
- **`tests/music-api.mjs`** invokes the real server handler in a VM with mocked upstream responses. It checks ID/method rejection, request construction, response mapping, and failure handling without a live YouTube request.

### Current style files

- **`assets/css/site.css`** defines font loading, colour custom properties, base controls, frame/grid, logo/banner, directory, all page components, dialogs, and footer. Header and page positions are explicit grid placements; `.layout` uses `display: contents`.
- **`assets/css/responsive.css`** changes layout at 1000px, 700px, and 420px and enlarges controls on coarse pointers. It follows `site.css` so breakpoint rules take precedence.
- **`assets/css/animations.css`** defines the jump keyframes, name hover/focus/press rules, mascot zoom, avatar hover, and reduced-motion overrides. `--order` belongs to each character, not global state.
- **`assets/css/legacy-tool.css`** adapts extractor components to the current theme and handles tool-specific mobile layouts. It follows the old `utilities.css` so it can replace fixed sizing and old decorations.

### Preserved style/source files

Only `assets/css/legacy/utilities.css` is loaded by a current page. The other legacy styles are retained as historical material and are not part of the current cascade. They should not be added to new pages: the original universal 32px font and fixed header sizes would conflict with the responsive theme.

| Retained file | Contents and current role |
| --- | --- |
| `legacy/style.css` | Original `@import` chain for base/layout/components/utilities/animations. Historical, unloaded. |
| `legacy/base.css` | Original local font declarations, universal typography, body and drifting star background. Paths updated after moving assets. Unloaded. |
| `legacy/layout.css` | Original `.box`, navigation strips, character colours/delays, image transforms, three-column percentages. Unloaded; useful reference for the original logo. |
| `legacy/component.css` | Original biography, cards, carousels, music widgets. No current JavaScript depends on these selectors. Unloaded. |
| `legacy/utilities.css` | Original race-picker and extractor CSS. Extractor sections are live and overridden by `legacy-tool.css`; race-picker selectors have no active feature. |
| `legacy/animation.css` | Original keyframes for star drift, name jump, music bars, race runners, winners, rain, stumbling, and reveal effects. Unloaded. |
| `legacy/all.css` | Third-party Font Awesome icon mappings, font faces, utility classes, and icon animation styles. Required webfont binaries were absent in the recovered project. Unloaded; current UI uses text glyphs instead. Retain its licence header if preserving or redistributing it. |
| `legacy/picturebook.css` | First rebuilding pass’s full theme, including its breakpoints. Unloaded. |
| `docs/legacy/ultilities-original.html.txt` | Preserved previous extractor HTML source with its original references. A text archive, not a working page; paths inside intentionally describe the old layout. |

### Data and documentation

`data/changelog.json` is an array, newest first, with `version`, `date`, `title`, `changes`, and `notes`. Note paths are project-root-relative, e.g. `docs/versions/2026-11-05-retro.md`. The archive adds `../` from inside `pages/` to resolve them. Changes are recorded deliberately; code changes do not automatically create entries.

The README is the quick operating guide. This report is the architecture and visual guide. The code reference documents each function and callback. Version notes describe particular releases. The update plan separates planned features from existing behaviour.

## 6. Data flow and persistence

```text
default introduction
        + optional public snapshot
        ↓ validate
  publicDefaults
        ↓ overridden by valid browser notebook, if present
      state ── bind/clone ── existing HTML slots and record lists
        ↑                    │
        └──── dialogs/actions┘
        ↓ save()
localStorage: philine-picturebook-v1

selected TXT/MD files ── importBooks ── IndexedDB: philine-books / books
                                         ↓
                                  library and reader

state + IndexedDB books ── backup JSON
profile/posts/blogs/anime ── public site-content.js snapshot
```

Moving files into folders does not rename the storage keys or database. If you use the same browser origin (scheme, host, port), previous local data remains accessible. `localhost:4173` and `127.0.0.1:4173` are different origins; use the same one you used before. Export before changing origins or clearing browser data.

The database is version 1, with a `books` object store keyed by `id`. Folder imports use `webkitRelativePath` as ID; individual imports use the filename. A same-path reimport replaces that browser copy. This is not ongoing folder access, and folder picking varies by mobile browser; the individual-file input is the fallback.

Data field and variable definitions, callback inputs, returns, and side effects are exhaustively listed in [CODE-REFERENCE.md](CODE-REFERENCE.md).

Music uses profile fields song, artist, musicCover, and musicUrl (canonical watch URL). Empty cover/link defaults preserve old saves; absent artwork uses the original HTML image. Full/public profile exports include these references, not image bytes. Edit my corner now merges form fields with existing profile, preserving artwork and listening URL. Loading a new video updates and persists all four fields.

## 7. External requirements and current limits

- Music loads metadata and offers listening on YouTube in a separate tab. There is no embedded player. Artwork is a remote thumbnail, not cached album art; the channel may differ from artist credit. Old saves have no listening URL until a video is loaded again.
- Weather requests coordinates only after the user clicks the location button. The browser may ask permission; the request then goes to Open-Meteo. Failure is shown without inventing weather values.
- The extractor needs `http://localhost:5000/api/analyze` plus a vis-network CDN download. The current page pins the library version. CORS and a compatible backend response are required. On Android, localhost refers to the phone, so the existing backend URL cannot reach a desktop service without future configuration. This report does not claim the absent backend is functional.
- Browser-local editing is not authentication. Each visitor edits their own local notebook. Publishing a public snapshot requires replacing the data file and uploading the static project.
- TXT and MD display as escaped plain text; Markdown is not converted into HTML. EPUB/PDF are not parsed. Files over 10MB are skipped.
- Backups can be large and restore replaces current data. IndexedDB and localStorage are separate storage systems; restore is not an atomic transaction spanning both. Stronger recovery is planned.
- Validation checks the version, profile strings, collection object IDs/titles, and reading container. It is not a complete strict schema for every nested field yet.
- On a static public host, any uploaded source/documentation is publicly readable. Full private notebook exports should stay outside the deployed directory.

## 8. Verification and maintenance

Run:

```sh
node --check assets/js/picturebook.js
node --check assets/js/ai2d.js
node --check scripts/serve.mjs
node tests/check.mjs
node tests/music-api.mjs
node scripts/serve.mjs
# In another terminal, with the server running:
node tests/check.mjs --http
```

The checks cover static layouts/control hooks, balanced HTML source tags, template IDs, linked assets, safe DOM text, entry create/edit persistence and reloads, malformed collection/unsafe URL rejection, archive notes, HTTP pages, old-URL redirects, template loading route, and error responses. Version 1.2.0 passed 31 checks without the server and 54 with HTTP checks. JavaScript syntax checks passed. Element stubs test assignments and data flow; they do not parse or render the HTML like a browser.

Current v1.2.1 checks pass: 45 local checks / 68 with HTTP checks, plus seven mocked music API scenarios. The updated tests cover music display/save/reload, profile merging, old-save compatibility, invalid links/responses, server errors, and storage failures. The API suite executes actual handler code with controlled upstream responses. Syntax and documentation/JSON link checks pass. A live YouTube lookup and real browser interaction are not covered by these results.

Browser/native automation was unavailable during this update. Desktop/mobile screenshots, real text wrapping/overflow at 320–1920px, touch/keyboard animations, zoom, audio, location, folder selection, IndexedDB library operation, and full backup restore still need interactive verification. Source-level layout rules and a passing VM test are not a substitute for that review.

After code changes, update the changelog and version note, update this report/reference when contracts change, and rerun the affected checks. Avoid adding third-party dependencies just to duplicate browser features already in use.

