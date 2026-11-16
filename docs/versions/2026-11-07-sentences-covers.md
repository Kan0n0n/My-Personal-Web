# Version 2.1.3 — Whole sentences, saved titles, and cover previews

EPUB pagination now segments the sanitized reading text into Unicode sentences before distributing it across pages. Inline markup does not create sentence boundaries. A sentence that cannot fit moves to the next page; a sentence longer than the 1,800-character target stays intact on an oversized page. This removes hard character/word cuts while retaining content-based page numbering and source-offset bookmarks.

Shelf entries now expose Rename directly. The existing title/folder dialog writes through the revision-checked PostgreSQL metadata update, refreshes the shelf, and updates the reader heading only when that volume is open. Original contents and bookmarks are unchanged.

Hover/focus previews appear beside shelf books after a short delay. EPUB cover-image manifest properties, EPUB 2 cover metadata, and sanitized cover-page image fallback are supported. PDF covers use a first-page thumbnail. Requests use the authenticated private file endpoint, fetch no external artwork, and cache at most 20 object URLs. Leaving a book, clicking it, pressing Escape, or losing owner access hides the preview. Missing/unsupported covers show a message. No database migration or book re-upload is necessary.

Validation: 40 frontend/static scenarios, 15 database/API scenarios, 7 music scenarios, and 21 reader/cover scenarios passed (83 total). Checks cover persisted renaming and revision conflicts, preserved contents/progress, sentence boundaries across markup, oversized sentences/words without cuts, EPUB cover sources, and real PDF thumbnail rendering. Interactive browser placement remains unverified because the browser access host is unavailable.
