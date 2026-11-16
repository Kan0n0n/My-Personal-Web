# Your novel library

Sign in as the owner and open **The reading room**. Books, folders, and reading positions remain private.

## Organize a serial

1. Click **New folder** and enter the series name.
2. Leave that folder selected in **Series folder**.
3. Click **Choose novel files** and select the volumes to upload. Each file becomes a separate volume, sorted naturally by title (Volume 2 comes before Volume 10).
4. Choose a volume on the shelf to read it.

Use **Edit title / folder** inside an open volume to rename it or move it to another series. Select **All books** to see the whole library, or **Unfiled books** for books without a series. Search applies within the selected folder. Empty folders remain selectable.

Rename through **Edit title / folder** inside the reader. Saving writes the title and folder to PostgreSQL and preserves the file and bookmark. The separate shelf Rename button has been removed. Hover over a PDF/EPUB book (or focus its button with the keyboard) to preview its cover. EPUB previews use the embedded cover; PDF previews show the first page. If no cover can be found, a short message appears. Previews load only on demand, use the original private database file, and require no re-upload.

**Rename** changes the selected folder's name. **Remove folder** moves its books, including trashed books, to Unfiled without deleting files or bookmarks. Folders are one level deep; importing a directory tree preserves the path as a folder label such as `Series / Part 1`. When you explicitly select a series folder before import, all selected files go into that folder.

Uploads save one file at a time. If a file fails, the status shows how many were saved; remaining files are not uploaded. Re-importing creates additional copies. Original local files are never changed.

## Read PDF

Use **Previous**, **Next**, or the page selector. **Zoom − / Zoom +** resize the page; larger pages can be scrolled horizontally. Click **Keep my place** to save the current page and zoom. Reopening restores that page. The original PDF is retained and available through **Download original**.

PDF pages are rendered on canvas, including scanned pages. A selectable text layer is added when the original PDF contains text, allowing read-aloud highlights to follow the page. Text order and overlay precision depend on the PDF's structure/fonts; unusual layouts may need an external reader. Image-only scans have no selectable text and cannot be spoken without OCR, which is not included. There is no annotation UI. Password-protected PDFs require an unlocked copy.

## Read EPUB

The selector shows **Title - Page**, for example `Prologue - Page 1`, `Prologue - Page 2`, then `A New World - Page 3`. Page numbers run continuously from the beginning of the book. Titles come only from EPUB 3 navigation or EPUB 2 NCX; headings do not create extra chapter entries. Files not listed in the TOC continue under the surrounding title, and if a book has no usable TOC, its book title is used throughout.

Text pages aim for 1,800 characters, with breaks at complete sentence boundaries. A sentence that does not fit moves to the next page; an unusually long sentence gets a larger page rather than being cut. Sentences remain together across inline bold/italic markup. Each illustration gets a separate page and is limited to 75% of the screen height. These are stable content pages rather than publisher print pages or an exact screenful; larger fonts may need some scrolling. Changing fonts or screen width does not renumber the pages.

Use **Previous / Next** at the top or **Previous page / Next page** at the bottom. **Next title** jumps to the next different TOC title. Multiple TOC anchors inside one source file are recognized. **A− / A+** adjust text size, and **Light / dark** changes the background. **Keep my place** saves the current page using its source section and text offset. Older section/percentage bookmarks are mapped to a nearby new page when opened.

## Fonts and automatic saving

The **Novel font** selector offers Georgia, Overlock, Palatino, Arial, Verdana, and Monospace using installed fonts/the existing bundled font. **Alignment** offers Left, Center, Right, and Justify. Only the novel text changes; the website keeps its own typography. Font, alignment, size, and theme are stored with the book's reading position in PostgreSQL. Font/alignment changes are disabled for PDFs, which preserve their original page layout; PDF zoom still works.

Reading positions save after about 1.2 seconds without scrolling, every 15 seconds while the reader is open, on page changes, when switching books, and when the tab is hidden or closed. Unchanged positions are not repeatedly written. Text readers store the visible text offset and its vertical viewport position, with a scroll-ratio fallback; PDFs retain their page and approximate vertical position. Reopening tries to restore the same text location after fonts and images finish loading. Different screen layouts can change the exact pixel placement.

As requested, **the most recently confirmed save wins**, automatic or manual. **Keep my place** saves immediately and cancels pending older automatic writes. Subsequent reading can automatically update the position again; there is no pinned-bookmark mode. The status below the reader title reports confirmed saves and failures. Concurrent writes are serialized locally and revision-checked on the server. A conflict or expired session pauses automatic writes until the book is reloaded. Network failures can retry on a later save. Browser shutdown/network loss may interrupt a final request; the latest confirmed server save is the recovery point.

## Read aloud

Choose a **Device voice** and speed, then press **Read aloud**. Nothing plays automatically when opening a book. To start at a particular sentence, select text in that sentence before pressing Read aloud; otherwise playback starts near the visible reading position. **Pause / Resume** restarts the current sentence or chunk, and **Stop** cancels playback. Voice, speed, and Follow voice preferences are saved per book.

The active word is highlighted when the voice reports word-boundary timing. Otherwise the active sentence is highlighted; the status identifies the mode. **Follow voice** scrolls the spoken passage into view; disable it to control scrolling yourself. At a page's end the reader advances automatically, skips EPUB illustration-only pages, and stops at the end of the book. Manually choosing another page or volume stops old playback. Changing PDF zoom stops playback so it can restart against the rebuilt text layer. Text-layer PDFs are supported; an image-only PDF page stops playback with an explanation.

Only voices the browser identifies as local device voices are offered. If none exist, the reader reports this rather than silently using an online speech service. Voice quality/languages depend on the browser and installed OS voices. No API key, paid service, speech-model download, or application-managed GPU runtime is used. There is no whole-book audio generation or recording. Short text utterances are queued one at a time, with event-driven highlights.

Spoken text offsets join the same automatic/manual save queue used by ordinary reading. Positions save periodically and on pause/stop/page changes; Keep my place remains immediate, and the newest confirmed save wins. Actual audio quality and highlight timing need checking with the voices available in your browser. See the [approved implementation plan](TTS-PLAN.md) for constraints.

This reader supports ordinary, unencrypted, reflowable EPUBs. Original publisher CSS, scripts, remote resources, audio/video, interactive content, and internal footnote navigation are not rendered. Raster illustrations are supported; SVG illustrations and fixed-layout fidelity are not. DRM/encrypted books report an error; the source file remains downloadable.

## Limits and backups

- PDF and EPUB originals: 50 MiB per file. EPUB expansion: 100 MiB / 5,000 entries. Individual EPUB illustrations: 8 MiB.
- TXT and Markdown: 10 MiB in UTF-8 per file. Markdown continues to display as text.
- Books are private, authenticated files in PostgreSQL. Shelf listings do not load file contents.
- Server JSON backups include folders, original PDF/EPUB bytes encoded as base64, text, and bookmarks. Empty-notebook import remaps folder/book IDs and preserves their relationships.
- The existing backup import limit is 60 MiB in the browser / 64 MiB at the API. Binary encoding increases backup size by about one third. A large library's JSON export can exceed that limit; use administrator `pg_dump` / `pg_restore` for complete large-library recovery. This update does not add merging or large backup batching.

The database upgrade uses the new `002_novel_formats_folders.sql` migration. Existing TXT/MD books stay readable and start in Unfiled. Dependencies are installed with `npm ci`; browser reader libraries are served locally, with no CDN requests. Reader implementation follows [PDF.js examples](https://mozilla.github.io/pdf.js/examples/) and uses [DOMPurify](https://github.com/cure53/DOMPurify) to restrict EPUB markup.
