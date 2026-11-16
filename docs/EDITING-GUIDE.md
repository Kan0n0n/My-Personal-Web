# Editing the site in ordinary HTML

Version 3 update: page markup is now rendered by React in `frontend/views.jsx` and reusable fields/reader markup in `frontend/templates.jsx`. Edit those components instead of generated `dist/` files. Original decorative CSS and artwork remain under `assets/`. The older HTML/template workflow below is historical. See [development and operations](DEVELOPMENT.md).

Since version 1.2.0, the layouts are written directly in the HTML files. JavaScript does not generate or replace entire pages. No build or template compilation is needed.

## Where to change things

| What you want to change | File/location |
| --- | --- |
| Home introduction, headings, starter note, music/weather layout | `pages/index.html`, inside `<main>` or `#widgets` |
| Document-page heading, instructions, search box layout | `pages/documents.html`, inside `<main>` |
| Daily notes page | `pages/posts.html` |
| Blog/story page | `pages/blog.html` |
| Task columns and headings | `pages/work.html` |
| Toolbox | `pages/utilities.html` |
| Anime page and explanation of ratings | `pages/anime.html` |
| Reading room instructions and initial reader placeholder | `pages/novels.html` |
| Archive introduction | `pages/archive.html` |
| Logo, banner image, directory, sidebar, footer | The corresponding sections of each page’s HTML |
| Shape of one post/resource/task/anime card | Named `<template>` in `templates/components.html` |
| Edit forms, backup dialog, reminder form | Form templates in `templates/components.html` |
| Reader controls, empty-list messages, weather result panel | Corresponding templates in `templates/components.html` |
| Extractor layout and result cards | `pages/ultilities.html`, including its four templates near the bottom |
| Colours, fonts, borders, spacing | `assets/css/site.css` |
| Phone/tablet layout | `assets/css/responsive.css` |
| Hover/focus/press effects | `assets/css/animations.css` |
| Storage, search, button behaviour, data formatting | `assets/js/picturebook.js` |

## Example: change a page heading

Open `pages/documents.html`, find the `PAGE CONTENT` comment, and edit:

```html
<h2>The document cabinet</h2>
<p class="muted">Teaching materials, useful references, and things to keep close.</p>
```

You can also add another normal HTML section inside `<main>`:

```html
<section class="paper note">
  <h3>My teaching notes</h3>
  <p>A little space for something I want to remember.</p>
</section>
```

JavaScript will leave it in place, including after saving or editing a record.

## Example: change every document card

Open `templates/components.html` and find:

```html
<template id="document-template">
  <article class="paper">
    <span class="tag" data-field="folder"></span>
    <h3 class="record-heading" data-field="title"></h3>
    <p class="help" data-field="note"></p>
    <!-- Link and edit button follow here. -->
  </article>
</template>
```

Change the element order, add decorative text, change classes, or wrap fields in another container. JavaScript copies this shape once per document, then fills the `data-field` slots with plain text. It never interprets saved writing as HTML.

`<template>` is ordinary browser HTML. Its contents stay invisible until JavaScript clones them. The shared file is fetched once from the local server; it does not duplicate the visible page layout. Its links resolve relative to the page displaying it, so `../assets/` and `../docs/` remain correct.

## Hooks to keep

- Keep `id="main"`, `id="editor"`, `id="toast"`, calendar IDs/classes, and relevant search/list/input IDs. They tell JavaScript where controls and records live.
- Keep `data-page` on `<body>` equal to the page’s existing route (`index`, `documents`, etc.).
- Keep shared `<template id="…">` names and their root element. A cloned component has one root element; wrap multiple top-level elements in a `<div>` if needed.
- Keep `data-field` attributes on data slots and `data-action` attributes on buttons. Button wording/classes may change freely; its action name should remain.
- Keep input `name` values in forms; they map to the stored record fields. Labels/placeholders/classes are editable.
- Keep `data-task-column` values `To do`, `In progress`, and `Done`; displayed headings may change independently. Keep the count/list/empty hooks in each column.
- Keep `data-document-link` and `data-version-link` on their anchors. JavaScript fills their URLs.
- The hidden delete control in the dialog becomes visible only when editing an existing record. The `[hidden]` CSS rule is intentional.

For exact functions and hook behaviour, see [CODE-REFERENCE.md](CODE-REFERENCE.md).

## Saved profile data versus HTML defaults

Ordinary headings, notes, section layouts, and banner copy stay exactly as you edit them in HTML. A few profile values have `data-profile="name"`, `data-profile="bio"`, `data-profile="intro"`, etc. Those are data slots:

- A fresh browser uses the values written in its HTML as visible defaults.
- Once the API loads, your server profile (or the published profile for visitors) fills those marked slots. Old browser notebooks and static snapshots no longer override server content.
- Sign in and use **Edit my corner** to change saved values. An HTML default change does not overwrite the server profile.
- If a particular piece of text should always be fixed HTML, remove that element’s `data-profile` attribute. Its text will no longer be updated by the profile editor.

The dynamic name still produces one span per character for the jumping animation. The static HTML already has the default letter spans, so the original logo also appears before JavaScript loads.

## Shared header/sidebar duplication

The music widget uses `#music-url`, `#music-load`, `#music-cover`, and `#music-listen`, plus the song/artist data-profile slots and `#audio-status`. Keep these hooks if rearranging the card. The listening link opens YouTube in a new tab and stays hidden until a video URL is saved. Metadata comes through `/api/music-info` on the Node server; there is no local file picker or embedded player. Profile editing preserves artwork/link fields even though they have no form inputs.

Each page contains its own complete header, sidebar, navigation, and footer. This is deliberate: you asked for normal editable HTML, and the layout remains visible without JavaScript. To change a common banner or directory across the whole site, update the corresponding sections in all nine main pages. Repeated record shapes/forms are centralised in `templates/components.html`, so those changes need only one edit.

If the repetition becomes inconvenient later, a small build-time include system can generate these ordinary HTML files. No such build step is required now.

## Preview and checks

```sh
npm start
```

Open the same host/port you normally use, e.g. http://127.0.0.1:4173/pages/documents.html. Reload after editing. The template file needs an HTTP server; double-clicking a `file://` page shows its layout but cannot reliably enable notebook features.

Configure PostgreSQL first using the [setup guide](DATABASE-SETUP.md). Run `npm test` after editing hooks or templates; it checks frontend contracts and database/API behaviour, including HTTP routes. Tests cannot judge whether the design looks right; review desktop and phone layouts in a browser.
