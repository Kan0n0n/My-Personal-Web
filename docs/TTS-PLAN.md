# Lightweight read-aloud plan — approved and implemented

Approved by the owner on 7 November 2026 and implemented in version 2.3.0. Requested approach: free browser/device voices, no API key and no application-managed GPU or downloaded speech model. Playback, highlighting, page progression, PDF text, saved preferences, and cancellation have automated coverage. Actual browser audio/highlight verification remains pending because the browser access host is unavailable.

## Proposed behavior

1. Add Play, Pause/Resume, Stop, a voice picker, reading speed, and a Follow voice toggle inside the novel reader. List installed/local voices first and identify local availability. Start only when the owner presses Play; never autoplay on opening a book.
2. Read the current EPUB/TXT/MD page from the visible text position or selected sentence. Keep only the current page and a small next-page queue in memory. Feed short sentence utterances to avoid long-utterance stalls.
3. Highlight the word reported by speech boundary events. If the selected voice does not deliver reliable word boundaries, highlight the active sentence and label that mode clearly. Use DOM ranges/CSS highlights where supported; keep source text and bookmark offsets unchanged. Do not invent word timings.
4. Optionally scroll the current spoken word/sentence into view, advance to the next page when it finishes, and keep highlighting synchronized. Manual page/novel changes cancel old playback before loading new content. Stop at the end of the book; never start another volume automatically.
5. Connect reading progress to the existing save queue: save the spoken location at a bounded interval and on pause/stop/page change. Keep my place saves immediately. As confirmed by the user, the most recent successful automatic or manual save is the reopening position.
6. PDF needs an additional text layer matching its canvas so highlighting can follow visible words. Use the PDF's existing text when available; show a clear unavailable message for scanned/image-only pages. No OCR/model download is proposed. Check reading order on representative PDFs rather than assuming extraction order is always correct.

## Quality and resource limits

Voice quality comes from the voices installed/exposed by the browser and operating system. This approach cannot promise cloud AI voice quality. Prefer voices reporting `localService=true` for offline use; do not silently send novel text to a remote voice service. If no local voices exist, report that clearly and leave reading controls usable.

No audio files or full-book buffers are generated. No new model runtime, API key, paid service, or GPU setup is installed. Highlight only while speaking, with event-driven updates rather than a permanent animation loop.

Pause/resume and boundary reporting vary between voices/browsers. Verify the actual available voices in the user's browser before claiming word-level timing. Sentence highlighting is the practical fallback. Abrupt browser termination can still interrupt the final progress request.

## Implementation and verification sequence

1. Add the reader controls and a cancellable speech state machine; verify installed voices and basic sentence playback.
2. Add range-based word/sentence highlighting and optional follow scrolling for EPUB/TXT/MD.
3. Connect page transitions, saved positions, and voice/speed preferences. Test manual saves during playback, stale speech callbacks, session expiry, and switching volumes.
4. Add PDF text-layer support and test selectable-text PDFs, multilingual text, and image-only PDFs.
5. Check actual browser audio/highlight alignment and memory behavior over several pages. Automated voice mocks can verify state transitions but cannot establish audio quality or timing accuracy.

The first implementation should be accepted only after Play/Pause/Stop, page advancement, fallback highlighting, and cleanup on navigation work in the user's browser.

Sources: [Web Speech synthesis interfaces and voice locality](https://webaudio.github.io/web-speech-api/#speechsynthesisvoice), [boundary events](https://webaudio.github.io/web-speech-api/#eventdef-speechsynthesisutterance-boundary), [browser compatibility caveat](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisUtterance/boundary_event).
