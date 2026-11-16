# Version 3.1.0 — A softer directory and scrolling widgets

Replaced the directory's left selection stripe and text arrow with a white line on the right edge. A rounded white center curves into the selected row. The existing green highlight, accessible current-page label and keyboard focus outlines remain. Phone navigation reserves space for the marker.

Widgets and content cards that begin below the viewport gently rise 22 pixels and fade in once when scrolled into view. Initially visible content and the directory stay steady. Newly rendered cards are observed as well. Reader surfaces are excluded to preserve fixed speech highlights. Keyboard focus immediately reveals a card, and reduced-motion preferences disable the effect, including when changed while the page is open. Without observer support content stays visible.

Browser regression checks cover marker color/shape, one-time reveal completion, reduced-motion behavior and existing page workflows. The historical home comparison disables motion to compare the underlying layout.
