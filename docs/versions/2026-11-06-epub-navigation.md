# Version 2.1.1 — Named chapters and bottom navigation

The EPUB reader previously labeled all spine sections with generic chapter/section numbers. It now resolves titles from EPUB 3's navigation document, then EPUB 2 NCX, and then sanitized chapter headings. Nested navigation and relative/fragment links are matched to the corresponding spine file. Normal external NCX DOCTYPE declarations are stripped without fetching a DTD; custom entities remain unsupported. A missing or malformed table of contents falls back without blocking reading.

Previous/next controls now appear below each EPUB section and PDF page as well as above it. Both sets share rendering state, disable during navigation, and disable at the first/last section. Chapter changes scroll to the new text. Original spine order and numeric bookmark locations remain intact; multiple TOC anchors inside one spine file still share one reading section.

Reader regression checks cover EPUB 3 names, nested EPUB 2 NCX with a DOCTYPE, heading fallback, malformed navigation fallback, bottom-button state/navigation, PDF page labels, and bookmark restoration. The owner's existing EPUB was checked read-only: 56 sections, with 36 titles resolved from navigation/headings. No original books or reading positions were modified.

Navigation parsing follows the [EPUB navigation specification](https://www.w3.org/TR/epub-33/#sec-nav-toc) and [legacy NCX package definition](https://www.w3.org/publishing/epub32/epub-packages.html#sec-opf2-ncx).
