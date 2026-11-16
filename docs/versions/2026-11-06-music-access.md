# Version 2.0.2 — Music input and sign-in guidance

6 November 2026

The home music input was silently disabled for signed-out visitors. It now accepts pasted links at any time, while saving still requires the owner session. Added visible sign-in guidance beside the input; login loads the notebook in place so the pasted link is preserved. Expired-session responses restore the signed-out control state.

Hardened cover/listening URL assignments against `file:` URLs and removed the obsolete file-protocol allowance from the URL helper. The reported browser `file:///` warning could not be traced to a literal reference in the project; this change prevents the music widget from assigning such a saved URL.

Verification: 27 frontend/static scenarios, 13 embedded PostgreSQL/API scenarios, and 7 mocked music API scenarios pass. Added checks for guest input, sign-in enabling save while retaining the pasted URL, local-file URL rejection, and expired sessions. No browser-session credentials or user content were changed.
