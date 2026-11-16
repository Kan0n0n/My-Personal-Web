# Version 2.2.0 — Font choices and automatic reading positions

Removed the shelf Rename control at the owner's request; Edit title / folder remains inside the reader. The new novel-font selector changes only reading text and saves per-book preferences. PDF font changes are disabled because PDF pages are canvas images; zoom is retained.

Migration 003 adds a font-family field and JSON viewport anchor to reading_progress. Automatic saves use the existing authenticated revision-checked progress endpoint. Saves run after scrolling settles, periodically, before page changes, on book switches, and on tab hiding/closing. Queued writes are serialized; Keep my place cancels pending older automatic writes and saves immediately. The user's clarified preference is that the latest confirmed save wins, rather than pinning manual bookmarks. Conflicts/session expiry stop automatic overwrites and report errors.

Text anchors capture the first visible character and its vertical position; reopening waits for fonts/images and restores that position where possible, with ratio fallback. Existing page locators and bookmarks are retained. Backups include font/anchor fields. Exact placement across different layouts and completion of an abrupt shutdown's final request are best-effort.

TTS remains unimplemented pending approval of the [browser/device voice plan](../TTS-PLAN.md). No speech service, API key, GPU runtime, or model has been installed.

Validation: 40 frontend/static, 15 database/API, 7 music, 22 reader/cover, and 8 autosave/anchor scenarios passed (92 total). Checks cover font isolation/reopening, database persistence/validation, debounce/serialization, manual save priority, latest automatic save behavior, conflicts, retry, close flushing, and viewport restoration. The local migration was applied and the app restarted. Real interactive browser layout/audio verification remains separate.
