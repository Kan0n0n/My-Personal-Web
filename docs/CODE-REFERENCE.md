# Code reference — Philine’s Picture Book 1.2.1

Historical version-1 reference. PostgreSQL replaces the storage/server contracts below; use the [current API reference](API-REFERENCE.md) and [database setup](DATABASE-SETUP.md) for version 2.0.0.

Companion documents: [editing guide](EDITING-GUIDE.md), [project report](PROJECT-REPORT.md), [future plan](UPDATE-PLAN.md). This reference describes every project-owned function/helper, event callback group, important variable, return value, and storage contract. Markup now lives in HTML; neither browser script builds HTML strings.

## 1. Files and execution order

Each main page is a complete HTML document with header, directory, sidebar, main content, widgets where relevant, footer, editor dialog, and status element. It loads `data/site-content.js` followed by deferred `assets/js/picturebook.js`. The script reads page/default-profile hooks, loads reusable templates from `templates/components.html`, then binds behaviour and fills data lists. A template-loading failure leaves the normal page visible and reports the failure.

The extractor is separate: `pages/ultilities.html` contains its visible layout and four templates, loads pinned vis-network, then `assets/js/ai2d.js`. It does not load the main notebook script.

Node files: scripts/serve.mjs serves the project; tests/check.mjs verifies source/data behaviour; tests/music-api.mjs exercises the music API with mocked upstream responses. No npm packages or compilation are required.

## 2. State, schemas, and global variables

### `picturebook.js` globals

| Variable | Type / role |
| --- | --- |
| `defaults` | Notebook v1 object. Known profile strings plus empty collections/bookmarks. Visible `[data-profile]` elements seed the corresponding defaults in a fresh notebook. |
| `state` | Current editable notebook. Defaults are optionally replaced by validated public data and then validated local saved data. |
| `profileOverrides` | Boolean. When true, saved/public profile values fill marked HTML slots and the animated name. When false, static HTML is left as authored. |
| `page` | `document.body.dataset.page`; selects which page-specific controls/lists are used. |
| `calendarDate` | Date set to day 1 of the visible month. |
| `initialMusicCover` | Original home image src from HTML, or empty outside home. Used when a notebook has no saved artwork. |
| `toastTimer` | Handle for hiding the most recent toast. |
| `books` | In-memory array of loaded IndexedDB book records. |
| `activeBook` | ID of currently opened book. |
| `originalReader` | Clone of the reading page’s original empty-reader element, used after removing a book or restoring a backup. Undefined outside the reading page. |

### Storage contracts

localStorage key: **`philine-picturebook-v1`**. IndexedDB: **`philine-books`**, version **1**, store **`books`**, key path **`id`**. These are unchanged by the HTML refactor.

| Notebook field | Data fields / meaning |
| --- | --- |
| `version` | Number 1 (data schema version, separate from site release 1.2.1). |
| `profile` | Strings: `name`, `bio`, `status`, `intro`, `watching`, `playing`, `doing`, `song`, `artist`, `musicCover`, `musicUrl`. Music stores video title, uploader/channel, remote thumbnail URL, and canonical YouTube watch URL. Cover/link default to empty for old saves; no image bytes are stored. |
| `posts[]` | `{id, title, date, body, tags}`; date ISO `YYYY-MM-DD`; tags display string. New entries are prepended, not date-sorted. |
| `blogs[]` | Post fields plus `category` = Blog/Story. |
| `tasks[]` | `{id, title, note, due, status}`; optional date; status To do/In progress/Done. |
| `documents[]` | `{id, title, url, folder, note}`; form requires HTTP(S). |
| `anime[]` | `{id, title, status, rating, episodes, date, body, spoilers}`; rating/episode input values are strings; spoilers boolean. |
| `events[]` | `{id, title, date}`; multiple reminders per day allowed. |
| `reading` | Book-ID keyed object containing `{progress, font}`; percentage and pixel font size. |

IndexedDB book: `{id, title, text}`, all strings. Folder relative path or filename is ID; title removes TXT/MD suffix. Reimporting same ID replaces that browser copy. Full backup: `{notebook: state, books: Book[]}`; legacy bare notebook accepted. Public export: `{profile, posts, blogs, anime}` assigned to `window.PICTUREBOOK_PUBLIC`; private notebook sections excluded.

Initialisation catches malformed saved/public data so ordinary HTML remains visible. Validation is basic rather than a complete nested schema. Saved values override HTML profile defaults but do not replace static page headings, sections, links, or layout.

## 3. Every function/helper in `assets/js/picturebook.js`

Unless stated otherwise, functions return undefined. All record text is assigned with `textContent`; plain-text insertion replaces the old escaping/string-template system. Common callback variables: `record` = notebook entry, `element` = DOM Element, `event` = native event, `key` = collection name, `id` = record/book ID, `form` = cloned form Element.

### Helpers, loading, and text binding

| Function / parameters | Return | Behaviour and important locals |
| --- | --- | --- |
| `$(selector, root = document)` | Element/null | First `root.querySelector(selector)`. No jQuery. |
| `$$(selector, root = document)` | Element array | Converts `querySelectorAll` NodeList to Array. |
| `uid()` | String | UUID where supported, else timestamp/random base-36 string. |
| `localDate(date = new Date())` | ISO date string | Uses browser-local year/month/day, zero-pads month/day. |
| `dateLabel(date)` | Display string | Parses ISO date at local noon and formats en-GB day/short month/year. Invalid nested dates are not fully validated yet. |
| `validate(data)` | Merged notebook or throws | `data`: object. Checks schema version, profile, arrays, each record’s string id/title, known profile strings, and object-like reading field. `result` combines cloned defaults with data; `key` selects each field. |
| `save()` | Boolean | Serialises global state to localStorage; on quota/security failure shows toast and returns false. Does not roll back in-memory mutation. |
| `toast(message)` | Undefined | `target` is `#toast`; sets text/display, clears old timer, hides after 4500ms. |
| `loadTemplates()` | Promise<void> | Fetches shared HTML; `response` must be OK; `parsed` is DOMParser document. Imports each `template[id]` into page body using `document.importNode(template,true)`. No visible layout insertion or script execution. |
| `cloneTemplate(id)` | Cloned root Element or throws | Finds template by ID, requires `content.firstElementChild`, deep-clones only that root. Component templates need one root wrapper. |
| `fillFields(root, values)` | Same root Element | Scans `[data-field]` slots; assigns matching own values as plain text, nullish values become empty. `key` comes from each element’s dataset. |
| `bindEdit(root, key, id)` | Undefined | Sets collection/ID data attributes on a card’s edit button. |
| `applyProfile()` | Undefined | Returns without overrides. Updates marked profile text; cover uses saved URL or initialMusicCover, with interpolated alt or fallback. `listenLink` uses safeURL(musicUrl), hidden if empty/invalid. Restores animated name/label retaining suffix. Other locals: name, wordmark, suffix, letters, destination. |
| `tick()` | Undefined | Updates existing `#clock` in Asia/Ho_Chi_Minh timezone; called at startup and every 30s. Other date helpers use browser local time. |

### Dynamic data lists

| Function / parameters | Return | Behaviour and important locals |
| --- | --- | --- |
| `entryCard(record, key, full = false)` | Card Element | Clones entry-template, fills date/category/title/body/tags, sets edit metadata. Preview body limited to 240 characters; full body gets `.full-entry`. `body`, `card` are locals. |
| `showRecords(target, records, makeCard, emptyId, hasRecords = false)` | Undefined | Replaces only list `target` children with `records.map(makeCard)`. If empty, clones either `no-results` or the supplied empty template. Does not change page layout. |
| `renderEntries()` | Undefined | `key` posts/blogs from page; `query` search; `category` optional filter. Selects matching title/body/tags and delegates cards/empty state to showRecords. |
| `renderDocuments()` | Undefined | Filters title/folder, fills document-template; default folder Unsorted; validates link through safeURL; binds edit control. |
| `renderTasks()` | Undefined | Iterates static `[data-task-column]` sections. `status`, `records` identify tasks; updates count/empty flag/list; each cloned task gets due text, progress select value/ID, edit ID. Does not replace column headings. |
| `renderAnime()` | Undefined | Filters query/status; integer rating clamped 0–5, heart text/accessible label; fills episode text and spoiler label; binds edit ID. |
| `renderArchive()` | Promise<void> | Fetches changelog. `versions` map to version-template; each change becomes a text-only li; sets safe version-note URL. Catch replaces timeline with archive-error template. |
| `refreshPage()` | Undefined | Applies profile, redraws calendar, refreshes current page’s lists. Home toggles starter-note and fills latest posts. Does not recreate header/main/widgets/forms. Archive/book loading are separate operations. |
| `renderCalendar()` | Undefined | Keeps static calendar frame, heading and weekday spans; creates blank/day template clones for visible month. Sets date IDs, today/event classes and accessible labels. `calendar`, `year`, `month`, `grid`, `headings`, `cells`, `date`, `count`, `cell` are locals. |

### Editing, audio, and weather

| Function / parameters | Return | Behaviour and important locals |
| --- | --- | --- |
| `displayMusic(metadata, videoId)` | Boolean (save success), or throws | Requires nonempty string title/author_name/thumbnail_url, permitted thumbnail URL and valid 11-character ID before mutation. Assigns song/artist/musicCover/musicUrl to profile, enables overrides, saves, calls applyProfile, returns saved. Canonical watch URL is constructed from ID. |
| `bindAudio()` | Undefined | Retains its old name but now installs an async onclick handler on `#music-load`. `input`, `button`, `status` reference music-url/music-load/audio-status. The handler parses the link, fetches local metadata, and calls displayMusic(). Does not attach playback/seek listeners. |
| `openDialog(title, fieldsId, onSubmit, record = {}, deletion = null)` | Form Element | Clones dialog frame and fields template. Sets title, fills named form inputs from record. Optional `{key,id}` exposes delete button. Submit awaits onSubmit(formDataObject); false leaves dialog open, other results close/refresh. Catches errors and always clears busy flag. Uses existing native `#editor`, only calls showModal if not open. |
| `confirmAction(title, message, label, onConfirm)` | Undefined | Uses confirmation-fields, assigns plain message and submit label; delegates accepted action to openDialog. |
| `editProfile()` | Undefined | Opens profile-fields. Submit merges form data over existing profile, preserving musicCover/musicUrl and other fields absent from the form, enables overrides, saves. |
| `editEntry(key, id)` | Undefined | `kinds` maps supported collections to title/template ID. `old` is existing record; `record` combines form defaults and old values. Submit validates document URL, converts anime spoiler string to boolean, creates/replaces `entry`, saves. Invalid key returns. Delete metadata only for existing record. |
| `editDay(date)` | Undefined | Opens reminder-fields; submit appends date/title/ID and saves. Fills existing matching reminder-template clones and remove-button date/ID. |
| `safeURL(url, local = false)` | URL string or # | Allows HTTP(S) resolved against current page. With local true permits only safe `../docs/versions/<name>.md` file paths under file scheme. Rejects script/unsupported schemes and parse failures. Does not enforce a particular HTTP(S) host. |
| `weatherError(message)` | Undefined | Clones weather-error, optionally replaces its message, updates weather slot. |
| `getWeather()` | Undefined | Shows loading template and requests optional geolocation. Success callback is async and fetches current weather; outer function does not return a Promise for completion. Maps code to display text; result uses weather-result template. Errors display retry panel. Does not store coordinates. |

### Books, backup, event routing, startup

| Function / parameters | Return | Behaviour and important locals |
| --- | --- | --- |
| `database()` | Promise<IDBDatabase> | Opens existing database version. Upgrade creates books store; success resolves, error rejects. `request` holds open request. |
| `booksOp(mode, callback)` | Promise<request result/undefined> | `mode` readonly/readwrite; callback gets books store. Opens `db`, creates `transaction`, stores callback’s returned `request`; completes/rejects and closes DB on terminal event. Multiple-write callback may return nothing. |
| `loadBooks()` | Promise<void> | Reads/sorts all books naturally by title, assigns global books, renders shelf. On failure writes error text into shelf. Does not clear current reader. |
| `showShelf()` | Undefined | Filters title by `query`, clones book-template with title/progress, assigns read-book ID; empty/no-match uses HTML template. |
| `importBooks(event)` | Promise<void> | Reads input files, filters TXT/MD, skips >10MB. Serially awaits file.text and put, using relative path/filename ID. Reports count, reloads shelf, clears file input for future reselection. Does not touch original files. |
| `readBook(id)` | Undefined | Finds book; sets active ID; clones reader-template and fills book text/title via textContent. `saved` bookmark controls clamped 14–30px font and optional next-frame scroll restoration. Replaces only reader contents. |
| `download(name, data, type = 'application/json')` | Undefined | Blob/object URL download via temporary link; revokes URL after 1s. Does not write automatically into project files. |
| `backupDialog()` | Undefined | Clones backup-template into native editor, opens if necessary, attaches prepareRestore to file input. |
| `prepareRestore(event)` | Promise<void> | Clears old preview before reading selected file; validates notebook and string-field book array; clones count/confirm panel. Confirmation replaces IndexedDB books, updates notebook/profile override flag, saves and refreshes; reading page also reloads/reset reader. File selection itself does not restore. |
| `handleAction(event)` | Promise<void/handler result> | Resolves closest action button, dispatches actions listed below. Async errors are caught by bindPage wrapper. |
| `bindPage()` | Undefined | Registers delegated click and task-change handlers once; attaches search/filter, music metadata, utility counter, novel inputs as appropriate. Lists can redraw without duplicate listeners. |
| `init()` | Promise<void> | Starts clock/timer, awaits shared templates, binds controls, refreshes page, optionally awaits archive/book loading. Catch displays error/server hint; visible static page remains. Invoked once at script end. |

## 4. All callback groups in the main script

### Defaults, lists, and calendar

- Default-profile forEach receives `element`, reads `key=element.dataset.profile`, and copies known text to defaults.
- `validate` collection predicate receives `record`; true means invalid ID/title/object. Profile loop uses each known key.
- Toast timeout has no parameters and hides captured target.
- Template loading forEach receives `template`; imports a deep copy to body.
- Field/profile forEach receives `element`; writes matching data only. Name array factory receives `(letter,index)` and returns an individual span; no HTML interpretation.
- `showRecords` invokes `makeCard(record,index,array)` through Array.map. Built-in card callbacks use record only.
- Note/document/anime search predicates receive `record`, returning boolean text/category/status matches.
- Document map fills text slots, safe URL, edit data. Task column forEach receives `column`; task predicate receives `record`; task map builds card/select metadata.
- Anime card callback clamps numeric rating before repeat; thoughts remain inside HTML details/summary.
- Archive version map receives `version`; inner change map receives `change`, creates li with textContent. Network/JSON failure enters catch and fills archive error.
- Home map receives `record` from first three notes. Calendar reminder predicate receives `event` record, counts dates; day cells use ordinary loops and template clones. Weekday Elements are retained.

### Music link click callback (`bindAudio`)

The async `button.onclick()` has no used event parameter. It disables the button, reads link=input.value.trim() at click time, rejects blank input and non-HTTP(S) schemes. url=new URL(link) supplies host/path/query; youtu.be takes first path segment; youtube.com/www.youtube.com/m.youtube.com take query parameter v. videoId must match 11 letters/numbers/underscore/hyphen. Shorts/embed formats are not extracted.

The handler sets loading status, fetches the local API, parses metadata JSON, and displays the server's error text for non-OK responses (generic fallback if absent). It calls displayMusic(metadata,videoId), then reports saved success or a storage failure for this visit. Catch displays error.message; finally reenables the button. Playback uses a regular Listen on YouTube anchor in a new tab; there are no dead play/seek controls or local-audio globals.

displayMusic validates before changing state, then delegates all visible updates to applyProfile. This removes the incomplete song selector/incorrectly quoted alt and avoids duplicated display logic. Profile edits merge fields, so music cover/link survive. Old saves show the original artwork and hide the listening link until a new video is loaded. The selected URL and image remain remote references; playback is not embedded and image bytes are not cached.

### Form callbacks

- `openDialog` submit async `(event)`: preventDefault, disable submit button, await `onSubmit(Object.fromEntries(new FormData(form)))`, close/refresh unless false, catch message, finally reenable. `record` fields use `form.elements.namedItem(name)`; absent names are skipped.
- Profile submit `(data)`: merge existing profile with form fields, preserve cover/listening URL, set overrides, return save result.
- Entry lookup predicate `(record)` compares ID; submit `(data)` validates link/spoilers, creates/replaces entry, saves.
- Reminder submit `(data)` appends reminder; reminder predicate/map each receives record. Map fills remove ID/date.
- Confirmation callbacks capture record/book ID and perform only the accepted removal.

### Weather and IndexedDB callbacks

- Geolocation async success `(position)` reads latitude/longitude; creates API `url`, `response`, `data`, `current`, weather `code`/`label`; 12s fetch timeout. Validates current temperature then fills result. Failure catch uses weatherError.
- Geolocation failure callback takes no used parameter, shows permission/location guidance. Request options: timeout10s/maximumAge5min. No network request occurs until the weather action.
- Database Promise executor `(resolve,reject)`: upgrade creates store, success resolves request.result, error rejects.
- Transaction Promise executor captures db/mode/callback. Completion resolves returned request.result; error/abort rejects; each closes db.
- Store callbacks receive `store`: getAll for load/export; put for import; delete for removal; clear plus imported.forEach(book=>put(book)) for restore.
- Book sorting `(a,b)` compares title with `{numeric:true}`. Book/file search predicates receive `book`/`file` and return title/extension matches.
- Shelf card callback receives book and fills progress metadata. Read lookup predicate compares ID. requestAnimationFrame callback uses text offset/height and viewport height to restore progress.
- Download cleanup timeout revokes captured URL.

### Restore callbacks

`prepareRestore(event)` reads first File and JSON; validation predicate receives `book` and checks id/title/text strings. It empties any prior confirmation before parsing, preventing accidental confirmation of an older valid selection after a bad file.

Separate async confirm callback has no parameters; performs book-store replacement, assigns notebook and profile flag, saves, closes, refreshes; on novels resets active ID, reloads shelf, restores original HTML placeholder. Errors show toast. Storage systems are separate: restore is not atomic across IndexedDB and localStorage, and strict nested validation/recovery remain planned.

### Persistent input callbacks (`bindPage`)

Click wrapper `(event)` calls handleAction and catches rejected Promise into toast. Change listener `(event)` finds closest data-task select, finds task by `select.dataset.task`, updates status, saves, redraws task lists. Search/filter controls reference named rendering functions directly. Home calls bindAudio to attach the separate music-load onclick handler (the button has no data-action). Utility counter input `(event)` counts whitespace-delimited words and Unicode code points. Novel file/folder changes reference importBooks; book search references showShelf.

## 5. Every delegated action

The dispatcher reads `button=event.target.closest('[data-action]')`, then `{action,key,id}=button.dataset`. No button means return. `types` maps five new-entry action names to collections.

| Action | Effect / data |
| --- | --- |
| `close` | Close editor. |
| `new-post`, `new-blog`, `new-task`, `new-document`, `new-anime` | Open appropriate create form. |
| `profile`, `edit` | Open profile or existing collection record. |
| `delete` | Confirmation; filter captured ID out of collection, save. |
| `delete-event` | Remove ID immediately, save, reopen date form, redraw calendar. |
| `month-prev`, `month-next`, `day` | Change visible calendar month/redraw, or open date form. |
| `weather`, `backup` | Request weather or open backup controls. |
| `pick` | Trim newline choices, drop blank lines, choose random item, update result text. |
| `export-public` | Destructure profile/posts/blogs/anime, JSON-encode with literal `<` escaped as Unicode, download JS assignment. No tasks/materials/reminders/novels/audio. |
| `export` | Read all books, download dated JSON with notebook/books, show toast. |
| `read-book` | Open chosen ID. |
| `font-up`, `font-down` | Change reader font ±2px, clamp14–30px; saved with bookmark. |
| `reader-theme` | Toggle dark class; session-only preference. |
| `bookmark` | Compute viewport-top progress using text top/height, clamp0–100, save font/progress, update text/toast/shelf. |
| `remove-book` | Confirmation; delete browser copy/bookmark, reset active ID, reload shelf and original placeholder, save. Original file unchanged. |

## 6. `assets/js/ai2d.js`: every function and variable

The backend contract is unchanged: POST multipart `file` to localhost:5000/api/analyze; response has `json_data` and optional `images.relationships`, `text_matching`, `clip_results`, `knowledge_graph`. Graph records expect `blobs`, optional `texts`, `relationships`, optional `image_id`; relationship type field is literally `relation_type:`.

| Function | Parameters/return | Behaviour |
| --- | --- | --- |
| `updateFileLabel(e)` | Change Event; undefined | Selected filename or fallback written as text. Named event listener. |
| `cloneToolTemplate(id)` | Template ID string → Element | Deep-clones first root of local extractor template. |
| `downloadJSON()` | None; undefined | Latest JSON → encoded data URL → temporary download anchor; no-op if no JSON. |
| `buildExactGraph(containerId,jsonData)` | DOM ID/string, graph object; undefined | Guard required arrays/library; construct vis DataSets and Network, grouping blob-label pairs. |
| `processDiagram()` | None → Promise<void> | Require file, clear gallery/old JSON, disable button, clone loading template. POST; render cloned image/JSON/graph components; set values as DOM properties/text. Catch error; finally reenable. |
| `handleGalleryClick(event)` | MouseEvent; undefined | IMG in result card → prevent navigation, display zoom source/image, hide text, lock scrolling, focus close button. |
| `closeZoom()` | None; undefined | Hide overlay, restore scrolling, focus analyse control. |
| `handleBackdropClick(event)` | MouseEvent; undefined | Close if overlay background itself clicked. |
| `handleZoomKey(event)` | KeyboardEvent; undefined | Escape closes; Tab remains on only interactive close button. |

Globals: `currentJsonData` latest JSON/null; `dynamicGallery`, `modalElement`, `dynamicZoomedImg`, `dynamicZoomedText`, `modalImgClass`, `modalTextClass`, `dynamicCloseBtn` reference corresponding page elements. Text viewer is retained but no handler opens it.

Graph locals: `nodesArray`, `edgesArray`; `colors` by node kind; `imageId`, root ID; processed blob/text Sets; `idToSuper` mapping; `blobMatches`, `mainRelationships`; DOM `container`, vis `graphData`, physics/layout `options`. Blob-label filter callback `r` matches special relation type; grouping forEach `rel` computes `t_id`, `b_id`, `super_id`, tracks members and creates root/member edges. Blob/text callbacks `blob`/`t` add nodes and unmatched root edges. Main relation callback `rel` sets `srcNode/tgtNode`, remaps grouped IDs, adds directed labelled edge. Physics uses Barnes-Hut and random seed42. Network instance is not retained/destroyed explicitly yet.

Analysis locals: file/status/gallery/button Elements; `formData`, `inputImageUrl`; response/data; `orderedCards`, `jsonCard`, `graphCard`. Image forEach receives `card`, skips absent URL, fills h4/link/img of clone with title/URL properties. JSON uses pre.textContent. Graph is conditional on blobs/relationships. Loading/JSON/image/graph templates are in `pages/ultilities.html`. Input preview object URLs are not yet revoked on reruns; backend image URLs remain trusted, configurable endpoint/timeouts/response validation are future work.

## 7. `scripts/serve.mjs`

Globals: `root` absolute project path from script URL; `pageNames` ten old flat route names; `types` MIME map; `server` HTTP server bound to 127.0.0.1:4173.

| Function | Parameters/return | Behaviour |
| --- | --- | --- |
| `resolveRequestPath(pathname)` | Decoded URL path → absolute path/null | `file`, `relative` enforce lexical root/hidden-component restriction. Predicate `part` tests leading dot. Trailing slash gets index.html. |
| `handleRequest(req,res)` | IncomingMessage/ServerResponse → Promise<void> | Parses url/requested/old page; redirects root/old pages. Handles /api/music-info before static resolution (contract below). Otherwise checks paths/stat, serves MIME/nosniff (HEAD no body), rejects403 or catches404. |
| Nested `sendJSON(status,data)` | Numeric HTTP status and JSON-serialisable value; undefined | Defined inside music route; captures res, writes application/json; charset=utf-8, serialises data, ends response. |
| listen callback | No params; undefined | Prints preview URL when listening. |

Node built-ins only: http, path, readFile/stat, fileURLToPath. Server has no auth/write API/TLS, and lexical path checks do not resolve symlinks; do not add sensitive outside symlinks. It also serves `templates/components.html` as ordinary HTML; no template engine is involved.

### Music API contract and local variables

`GET /api/music-info?videoId=VIDEO_ID` accepts only GET (405 otherwise); videoId from url.searchParams must match `/^[A-Za-z0-9_-]{11}$/` (400 otherwise). `videoURL` is a canonical YouTube watch URL constructed by the server. `endpoint` points to the fixed YouTube oEmbed service with url/format=json parameters. `response` is the upstream fetch with `AbortSignal.timeout(10000)`; non-OK throws; `metadata` is parsed JSON. Success sends 200 with exactly title, author_name, thumbnail_url. Fetch/timeout/parse/upstream errors send 502 with an error message. Each handled route returns before static file handling. It does not download audio, cache artwork, or require a YouTube API key. New lookups require this Node endpoint; static hosting alone does not implement it.

## 8. `tests/check.mjs`

Globals: `source` main script text; `components` template source; `templates` Map of IDs to source body; `routes` nine main pages; `checks` counter; `required` page-specific ID lists.

| Function/method | Inputs/return | Role |
| --- | --- | --- |
| `checkTags(html,file)` | Source and label; undefined/throws | Stack-checks balanced tags after removing comments, skips known void tags. Source balance only, not semantic/browser parsing. |
| `ElementStub.constructor()` | None → fake instance | Creates children/dataset/style/text/value/selectors/groups/classes; minimal classList and form-elements methods. |
| `querySelector(selector)` | String → cached/new stub | Selector-keyed fake child. |
| `querySelectorAll(selector)` | String → configured array/empty | Returns known groups; never parses markup. |
| `replaceChildren(...children)` | Nodes; undefined | Replaces fake children array. |
| `append(...children)` | Nodes; undefined | Appends to fake children array. |
| `setAttribute(name,value)` | Strings; undefined | Stores simple fake property. |
| `getAttribute(name)` | String → stored value/null | Reads a fake attribute for initial artwork capture. |
| `showModal()`, `close()` | None | Set open flag. |
| `click()` | None | No-op. |
| `cloneNode()` | None → empty stub | Minimal placeholder clone, not browser cloning. |
| `firstElementChild` getter | None → first child | Lets tests inspect dialog content. |
| `componentStub(id)` | Template ID → stub root | Checks actual template exists; scans data-field names to configure field Elements. Does not parse real DOM. |
| `sandbox(route,saved)` | Route string, optional notebook → context/document/storage/run | Isolates state in VM and storage Map. Removes final init invocation so tests choose behaviour. |

Stub callbacks: classList.toggle(name,enabled) updates Set; style.setProperty no-op; elements.namedItem(name) returns fake input; document event listener/click/timer functions no-op; createElement returns stub; getElementById returns template cloning fixture; getItem/setItem read/write isolated Map; FormData constructor returns testData iterable; fetch returns actual local changelog data; `run(code)` executes VM expression. No real browser data or IndexedDB is touched.

Source checks verify static header/main/navigation, route IDs/control hooks, balanced tags, template IDs, no HTML-string APIs in browser scripts, local href/src and CSS URLs. Fake-DOM refresh tests exercise page branches. Behaviour checks submit note create/edit and other collection forms, inspect persistence/reload, reject malformed collections/unsafe URLs, verify text-like markup stays text, verify name letters, and render archive records/note references. With --http, check ten page routes, ten old flat redirects, template URL,403 hidden path,404 missing file. Actual DOMParser/native forms/layout/media/IndexedDB need browser QA.

Music coverage now checks the actual link/image/listening hooks, display/save/reload of all four music fields, profile-edit preservation, old saves, rejected metadata, supported/invalid URLs, API errors, and storage failures. `musicSlots(app)` configures fake song/artist data bindings; app is a sandbox result and the helper returns undefined. Click tests replace fetch with controlled success/error JSON. This remains Element-stub coverage, not browser parsing or a live upstream call.

### `tests/music-api.mjs`

This dependency-free suite reads actual serve.mjs source into a VM after removing imports/listen startup, injects Node path/URL helpers and a fake fetch, then invokes the real handleRequest without opening a port. Globals: serverURL, source, requests counter, metadata fixture. `requestMusic(method,url,fetchStub)` returns a Promise of a response recorder; its writeHead(status,headers) stores headers/status and end(body) parses response JSON. `youtubeStub(endpoint,options)` increments requests, checks fixed YouTube oEmbed origin/path, canonical video URL, JSON format, and AbortSignal, then returns metadata plus an extra HTML field (asserted absent in server output). Bad-request table checks 405/400 without upstream calls; success checks exact metadata; three stub callbacks simulate non-OK upstream, network throw, and JSON parse throw, each expecting 502. Seven scenarios pass without contacting YouTube.

## 9. HTML, CSS, and data contracts

All main HTML pages contain real editable layout, `body[data-page]`, complete static directory, `#main`, `#calendar`, `#editor`, `#toast`. Header/sidebar copies are intentional and can be edited directly per page. Root index is only a static-host redirect. Ordinary static copy is never replaced by refreshPage. `data-profile` opts text into saved-profile binding; removing that attribute makes it fixed HTML.

Shared templates each have exactly one root element. IDs are referenced by cloneTemplate; `data-field` names bind data, `data-action` values route buttons, form input `name` values map to schemas. Customise tags/order/classes/text without deleting needed hooks. Template content is inert until cloned. Extractor templates live in its own page. See EDITING-GUIDE for practical examples.

Current styles: site.css typography/palette/desktop grid/components; responsive.css1000/700/420px and coarse-pointer overrides; animations.css staggered name/mascot and reduced-motion; legacy-tool.css extractor integration. `[hidden]` is enforced so visibility flags work despite author display rules. Utility classes block/record-heading/record-spacing/rating support templates.

Home music hooks: music-cover image, song/artist data-profile slots, music-url input, music-load button, music-listen anchor, audio-status message. The listening anchor is hidden until a safe saved URL exists and opens a new tab with noopener/noreferrer. `.music-cover` is a 64×64px nonshrinking, cover-cropped circular image. Help copy describes metadata storage and external listening. Old play/seek controls were removed.

Palette properties: --ink, --muted, --rose, --line, --paper, --green, --pink, --blue; per-letter --order. CSS functions: url resource paths; var substitutions; linear/radial/repeating gradients for surfaces/gingham/record; min/max/clamp/calc for fluid sizing; repeat/minmax for grids; translate/scale/rotate for movement. These are browser CSS functions, not project JS APIs.

Legacy CSS is retained, not generally loaded. Only legacy/utilities.css supplies old extractor components, overridden by legacy-tool.css. base/layout/component/style/picturebook files are historical themes/imports. all.css is unloaded third-party Font Awesome CSS with absent recovered font binaries. Legacy animation.css keyframes: star-drift-fast, jump, bar-jump, bar-rainbow, runner-bounce, winner-bounce, winner-glow, result-pop, winner-popup-bounce, mystery-pulse, reveal-pop, raindrops, rainfall, stumble, stumble-stars. Unused race-picker styles are not a working game. Live name uses logo-jump in current animations.css.

`data/site-content.js` assigns optional public snapshot, no functions; trusted executable data, no secrets. `data/changelog.json` newest-first `{version,date,title,changes[],notes}`; notes paths root-relative, archive prepends ../. Fonts/images are binary resources, documentation files are non-executable. The project report lists each file and retained asset.

Maintain this reference when functions, schemas, hooks, or callbacks change; place future behaviour in UPDATE-PLAN instead of describing it as implemented.

