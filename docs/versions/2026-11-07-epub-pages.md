# Version 2.1.2 — Title - Page navigation

EPUB reading now uses short content pages rather than entire spine sections. Each text page contains up to 1,800 characters, with separate illustration pages. Dropdown entries show the actual TOC title followed by the continuous book-wide page number. Headings and source-file boundaries no longer invent chapter names. EPUB 3 and NCX titles are matched to both file and fragment anchors. Unlisted source files retain the surrounding TOC title; a book without usable navigation uses its book title.

Basic markup is preserved while long text nodes split at word boundaries where possible. Illustration height is capped at 75vh. Page breaks are based on content, so fonts and screen width do not renumber the book; a page is not necessarily one viewport or an original print page. Font controls and PDF behavior remain intact.

Top/bottom previous/next buttons navigate pages. A bottom Next title button jumps to the next distinct TOC title. Page bookmarks store source section and text offset, while existing section/scroll bookmarks reopen on a nearby page. No database migration or re-upload is needed.

Validation: 16 reader scenarios cover TOC-only names, continuous numbering, long paragraphs without text loss, multiple TOC anchors in a single file, legacy/new bookmarks, stable numbering after font changes, bottom navigation, EPUB sanitization, and real PDF rendering. Existing frontend/API/music checks also pass. The local PostgreSQL service was stopped during this update, so an additional read-only check against the previously uploaded EPUB could not run.
