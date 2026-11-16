import React from "react";
export function IndexPage({
  slots = {},
  controls = {},
  profile = {},
  owner = false,
  values = {},
  record = {},
  children,
}) {
  return (
    <main id="main" className="column" tabIndex="-1" {...controls["main"]}>
      {slots["main"] ?? (
        <>
          <section className="paper intro tape">
            <div className="eyebrow">{"You’re right where you should be"}</div>
            <h2>{"A little life, between the pages."}</h2>
            <div className="long-text" data-profile="intro">
              {profile["intro"] ??
                "Welcome to my little corner of the internet. A home for ordinary days, unfinished ideas, and all the stories I want to keep close.\n\nThis picture book is slowly finding its pages again. Make yourself comfortable, have a look around, and stay a little while. ♡"}
            </div>
            <p className="signature">
              {"With love, "}
              <span data-profile="name">{profile["name"] ?? "Philine"}</span>
              {" ♡"}
            </p>
            <div className="separator">{"✦ ✿ ✦"}</div>
          </section>
          <div className="section-heading">
            <h2>{"Notes from everyday life"}</h2>
            <a href="posts.html">{"All the little moments ↗"}</a>
          </div>
          <article
            className="paper entry"
            id="starter-note"
            {...controls["starter-note"]}
          >
            {slots["starter-note"] ?? (
              <>
                <span className="date">
                  {"A fresh beginning · starter note"}
                </span>
                <h3>{"Picking up the pieces, making a home."}</h3>
                <p>
                  {
                    "The old site left behind a few little treasures: some handwritten letters, a familiar face, and a starry background. This is where the next chapter begins."
                  }
                </p>
                <div className="entry-footer">
                  <span>{"✿ A place for your first memory"}</span>
                  <button
                    data-owner-only=""
                    className="small"
                    data-action="new-post"
                    hidden={!owner}
                  >
                    {"Write a little note ↗"}
                  </button>
                </div>
              </>
            )}
          </article>
          <div className="column" id="home-posts" {...controls["home-posts"]}>
            {slots["home-posts"]}
          </div>
          <section className="paper note">
            <span className="eyebrow">{"The site is growing"}</span>
            <p
              style={{
                marginTop: "8px",
                marginRight: "0px",
                marginBottom: "0px",
                marginLeft: "0px",
              }}
            >
              {
                "New shelves, fresh pages, and a place for every small obsession. "
              }
              <a href="archive.html">{"Peek at the changelog ↗"}</a>
            </p>
          </section>
        </>
      )}
    </main>
  );
}
export function PostsPage({
  slots = {},
  controls = {},
  profile = {},
  owner = false,
  values = {},
  record = {},
  children,
}) {
  return (
    <main id="main" className="column wide" tabIndex="-1" {...controls["main"]}>
      {slots["main"] ?? (
        <>
          <div className="page-heading">
            <div>
              <div className="eyebrow">{"A page in my picture book"}</div>
              <h2>{"The everyday pages"}</h2>
              <p className="muted">
                {"Little moments that might otherwise slip away."}
              </p>
            </div>
            <button
              data-owner-only=""
              className="primary"
              data-action="new-post"
              hidden={!owner}
            >
              {"+ New note"}
            </button>
          </div>
          <div className="toolbar">
            <input
              id="entry-search"
              type="search"
              aria-label="Search entries"
              placeholder="Look for a thought…"
              {...controls["entry-search"]}
            />
          </div>
          <div className="column" id="entries" {...controls["entries"]}>
            {slots["entries"] ?? (
              <>
                <div className="empty">
                  <span className="symbol" aria-hidden="true">
                    {"✎"}
                  </span>
                  <h3>{"A blank page is a beginning"}</h3>
                  <p>
                    {"Your words belong here. Start with one little thought."}
                  </p>
                  <button
                    data-owner-only=""
                    data-action="new-post"
                    hidden={!owner}
                  >
                    {"Write the first page"}
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </main>
  );
}
export function BlogPage({
  slots = {},
  controls = {},
  profile = {},
  owner = false,
  values = {},
  record = {},
  children,
}) {
  return (
    <main id="main" className="column wide" tabIndex="-1" {...controls["main"]}>
      {slots["main"] ?? (
        <>
          <div className="page-heading">
            <div>
              <div className="eyebrow">{"A page in my picture book"}</div>
              <h2>{"Ink & imagination"}</h2>
              <p className="muted">
                {
                  "Longer thoughts, unfinished stories, and words finding their way."
                }
              </p>
            </div>
            <button
              data-owner-only=""
              className="primary"
              data-action="new-blog"
              hidden={!owner}
            >
              {"+ Write something"}
            </button>
          </div>
          <div className="toolbar">
            <input
              id="entry-search"
              type="search"
              aria-label="Search entries"
              placeholder="Look for a thought…"
              {...controls["entry-search"]}
            />
            <select
              id="entry-filter"
              aria-label="Entry type"
              {...controls["entry-filter"]}
            >
              {slots["entry-filter"] ?? (
                <>
                  <option value="">{"All pages"}</option>
                  <option>{"Blog"}</option>
                  <option>{"Story"}</option>
                </>
              )}
            </select>
          </div>
          <div className="column" id="entries" {...controls["entries"]}>
            {slots["entries"] ?? (
              <>
                <div className="empty">
                  <span className="symbol" aria-hidden="true">
                    {"✎"}
                  </span>
                  <h3>{"A blank page is a beginning"}</h3>
                  <p>
                    {"Your words belong here. Start with one little thought."}
                  </p>
                  <button
                    data-owner-only=""
                    data-action="new-blog"
                    hidden={!owner}
                  >
                    {"Write the first page"}
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </main>
  );
}
export function DocumentsPage({
  slots = {},
  controls = {},
  profile = {},
  owner = false,
  values = {},
  record = {},
  children,
}) {
  return (
    <main id="main" className="column wide" tabIndex="-1" {...controls["main"]}>
      {slots["main"] ?? (
        <>
          <div className="page-heading">
            <div>
              <div className="eyebrow">{"A page in my picture book"}</div>
              <h2>{"The document cabinet"}</h2>
              <p className="muted">
                {
                  "Teaching materials, useful references, and things to keep close."
                }
              </p>
            </div>
            <button
              data-owner-only=""
              className="primary"
              data-action="new-document"
              hidden={!owner}
            >
              {"+ Save a link"}
            </button>
          </div>
          <section className="paper note">
            <h3>{"A shelf for now, a cloud later."}</h3>
            <p>
              {
                "Save links to your materials in any cloud service. A direct cloud connection can be added later; this version keeps an organised list of links."
              }
            </p>
          </section>
          <div className="toolbar">
            <input
              id="doc-search"
              type="search"
              aria-label="Search documents"
              placeholder="Find a title or folder…"
              {...controls["doc-search"]}
            />
          </div>
          <div className="grid-two" id="documents" {...controls["documents"]}>
            {slots["documents"] ?? (
              <>
                <div className="empty">
                  <span className="symbol" aria-hidden="true">
                    {"▤"}
                  </span>
                  <h3>{"Room for your materials"}</h3>
                  <p>
                    {"Add a link to a lesson plan, worksheet, or resource."}
                  </p>
                  <button
                    data-owner-only=""
                    data-action="new-document"
                    hidden={!owner}
                  >
                    {"Save a material"}
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </main>
  );
}
export function WorkPage({
  slots = {},
  controls = {},
  profile = {},
  owner = false,
  values = {},
  record = {},
  children,
}) {
  return (
    <main id="main" className="column wide" tabIndex="-1" {...controls["main"]}>
      {slots["main"] ?? (
        <>
          <div className="page-heading">
            <div>
              <div className="eyebrow">{"A page in my picture book"}</div>
              <h2>{"One thing at a time"}</h2>
              <p className="muted">
                {"A gentle place to give your work a little structure."}
              </p>
            </div>
            <button
              data-owner-only=""
              className="primary"
              data-action="new-task"
              hidden={!owner}
            >
              {"+ Add a task"}
            </button>
          </div>
          <div className="task-board">
            <section className="task-column" data-task-column="To do">
              {slots["task-To do"]}
            </section>
            <section className="task-column" data-task-column="In progress">
              {slots["task-In progress"]}
            </section>
            <section className="task-column" data-task-column="Done">
              {slots["task-Done"]}
            </section>
          </div>
        </>
      )}
    </main>
  );
}
export function UtilitiesPage({
  slots = {},
  controls = {},
  profile = {},
  owner = false,
  values = {},
  record = {},
  children,
}) {
  return (
    <main id="main" className="column wide" tabIndex="-1" {...controls["main"]}>
      {slots["main"] ?? (
        <>
          <div className="page-heading">
            <div>
              <div className="eyebrow">{"A page in my picture book"}</div>
              <h2>{"The little toolbox"}</h2>
              <p className="muted">
                {"Useful experiments and small helpers, gathered in one place."}
              </p>
            </div>
          </div>
          <div className="grid-two">
            <article className="paper">
              <span className="eyebrow">{"From the original site"}</span>
              <h3 style={{ marginTop: "12px" }}>{"AI2D Relation Extractor"}</h3>
              <p>{"Turn diagrams into relationships and a knowledge graph."}</p>
              <p className="help">
                {
                  "The original page is preserved. Analysis needs your original server at localhost:5000, which was not included in the surviving files."
                }
              </p>
              <a className="button primary" href="ultilities.html">
                {"Open the original tool ↗"}
              </a>
            </article>
            <article className="paper">
              <span className="eyebrow">{"A little help deciding"}</span>
              <h3 style={{ marginTop: "12px" }}>{"Leave it to chance"}</h3>
              <label>
                {"One choice per line"}
                <textarea
                  id="choices"
                  placeholder="Read a chapter\nMake some tea\nTake a little walk"
                  {...controls["choices"]}
                >
                  {slots["choices"]}
                </textarea>
              </label>
              <button data-action="pick">{"Pick one for me"}</button>
              <p
                id="pick-result"
                role="status"
                style={{ marginTop: "13px" }}
                {...controls["pick-result"]}
              >
                {slots["pick-result"]}
              </p>
            </article>
            <article className="paper">
              <span className="eyebrow">{"Words, counted"}</span>
              <h3 style={{ marginTop: "12px" }}>
                {"A writer’s little counter"}
              </h3>
              <label>
                {"Your text"}
                <textarea
                  id="count-text"
                  placeholder="Let your words wander…"
                  {...controls["count-text"]}
                >
                  {slots["count-text"]}
                </textarea>
              </label>
              <p id="count-result" role="status" {...controls["count-result"]}>
                {slots["count-result"] ?? <>{"0 words · 0 characters"}</>}
              </p>
            </article>
            <article className="paper note" data-owner-only="" hidden={!owner}>
              <h3>{"Keep a spare copy"}</h3>
              <p>
                {
                  "Back up your server notebook or import your old browser notebook. Existing browser data remains available for export."
                }
              </p>
              <button data-owner-only="" data-action="backup" hidden={!owner}>
                {"Open backup & import"}
              </button>
            </article>
          </div>
        </>
      )}
    </main>
  );
}
export function AnimePage({
  slots = {},
  controls = {},
  profile = {},
  owner = false,
  values = {},
  record = {},
  children,
}) {
  return (
    <main id="main" className="column wide" tabIndex="-1" {...controls["main"]}>
      {slots["main"] ?? (
        <>
          <div className="page-heading">
            <div>
              <div className="eyebrow">{"A page in my picture book"}</div>
              <h2>{"After the end credits"}</h2>
              <p className="muted">
                {"Not a critic. Just a person who felt something."}
              </p>
            </div>
            <button
              data-owner-only=""
              className="primary"
              data-action="new-anime"
              hidden={!owner}
            >
              {"+ Log an anime"}
            </button>
          </div>
          <section className="paper note">
            <h3>{"My kind of rating"}</h3>
            <p>
              {
                "1 — not for me   ·   2 — a few nice moments   ·   3 — glad I watched"
              }
              <br />
              {"4 — close to my heart   ·   5 — lives in my head, rent free"}
            </p>
          </section>
          <div className="toolbar">
            <input
              id="anime-search"
              type="search"
              aria-label="Search anime"
              placeholder="Find an anime…"
              {...controls["anime-search"]}
            />
            <select
              id="anime-filter"
              aria-label="Watch status"
              {...controls["anime-filter"]}
            >
              {slots["anime-filter"] ?? (
                <>
                  <option value="">{"Every chapter"}</option>
                  <option>{"Watching"}</option>
                  <option>{"Completed"}</option>
                  <option>{"On hold"}</option>
                  <option>{"Plan to watch"}</option>
                </>
              )}
            </select>
          </div>
          <div className="grid-two" id="anime-list" {...controls["anime-list"]}>
            {slots["anime-list"] ?? (
              <>
                <div className="empty">
                  <span className="symbol" aria-hidden="true">
                    {"☆"}
                  </span>
                  <h3>{"Stories stay with us"}</h3>
                  <p>
                    {
                      "Keep your own thoughts, progress, and very personal ratings."
                    }
                  </p>
                  <button
                    data-owner-only=""
                    data-action="new-anime"
                    hidden={!owner}
                  >
                    {"Log your first anime"}
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </main>
  );
}
export function NovelsPage({
  slots = {},
  controls = {},
  profile = {},
  owner = false,
  values = {},
  record = {},
  children,
}) {
  return (
    <main id="main" className="column wide" tabIndex="-1" {...controls["main"]}>
      {slots["main"] ?? (
        <>
          <div className="page-heading">
            <div>
              <div className="eyebrow">{"A page in my picture book"}</div>
              <h2>{"The reading room"}</h2>
              <p className="muted">
                {"A quiet shelf for the stories you bring with you."}
              </p>
            </div>
          </div>
          <section className="paper note">
            <h3>{"Your books, in your own little corner."}</h3>
            <p>
              {
                "Bring your PDF, EPUB, TXT, and Markdown novels. Group volumes in a series folder, then choose a volume to read. Files are saved in your private library; your originals stay unchanged. PDF / EPUB: up to 50 MiB each. Text: up to 10 MiB. Re-importing creates another copy."
              }
            </p>
            <div className="toolbar" style={{ marginBottom: "0px" }}>
              <label
                data-owner-only=""
                className="file-label button"
                hidden={!owner}
              >
                {"Import a folder"}
                <input
                  id="novel-folder"
                  type="file"
                  webkitdirectory=""
                  multiple={true}
                  {...controls["novel-folder"]}
                />
              </label>
              <label
                data-owner-only=""
                className="file-label button"
                hidden={!owner}
              >
                {"Choose novel files"}
                <input
                  id="novel-files"
                  type="file"
                  accept=".pdf,.epub,.txt,.md"
                  multiple={true}
                  {...controls["novel-files"]}
                />
              </label>
            </div>
            <p
              className="help"
              id="library-status"
              role="status"
              {...controls["library-status"]}
            >
              {slots["library-status"] ?? (
                <>
                  {
                    "Choose a series folder below before importing to put all selected volumes there."
                  }
                </>
              )}
            </p>
          </section>
          <div className="reading-layout">
            <aside className="paper">
              <div className="paper-title">
                {"On my shelf "}
                <span>{"♧"}</span>
              </div>
              <input
                id="book-search"
                type="search"
                placeholder="Find a book…"
                aria-label="Search books"
                {...controls["book-search"]}
              />
              <label className="library-folder-label">
                {"Series folder"}
                <select
                  id="library-folder"
                  aria-label="Series folder"
                  {...controls["library-folder"]}
                >
                  {slots["library-folder"] ?? (
                    <>
                      <option value="">{"All books"}</option>
                      <option value="unfiled">{"Unfiled books"}</option>
                    </>
                  )}
                </select>
              </label>
              <div
                className="library-folder-actions"
                data-owner-only=""
                hidden={!owner}
              >
                <button className="small" data-action="new-folder">
                  {"New folder"}
                </button>
                <button
                  className="small"
                  data-action="rename-folder"
                  id="rename-folder"
                  disabled={true}
                  {...controls["rename-folder"]}
                >
                  {slots["rename-folder"] ?? <>{"Rename"}</>}
                </button>
                <button
                  className="small"
                  data-action="remove-folder"
                  id="remove-folder"
                  disabled={true}
                  {...controls["remove-folder"]}
                >
                  {slots["remove-folder"] ?? <>{"Remove folder"}</>}
                </button>
              </div>
              <div
                className="novel-list"
                id="book-list"
                style={{ marginTop: "13px" }}
                {...controls["book-list"]}
              >
                {slots["book-list"] ?? <>{"Opening the shelf…"}</>}
              </div>
            </aside>
            <section
              className="paper reader"
              id="reader"
              {...controls["reader"]}
            >
              {slots["reader"] ?? (
                <>
                  <div className="empty">
                    <span className="symbol" aria-hidden="true">
                      {"♧"}
                    </span>
                    <h3>{"Just one more chapter"}</h3>
                    <p>
                      {
                        "Import your stories, then choose a book from the shelf."
                      }
                    </p>
                  </div>
                </>
              )}
            </section>
          </div>
          <aside
            id="book-cover-preview"
            className="book-cover-preview"
            role="tooltip"
            hidden={true}
            {...controls["book-cover-preview"]}
          >
            {slots["book-cover-preview"] ?? (
              <>
                <strong id="book-cover-title" {...controls["book-cover-title"]}>
                  {slots["book-cover-title"]}
                </strong>
                <img
                  id="book-cover-image"
                  alt="Novel cover"
                  hidden={true}
                  {...controls["book-cover-image"]}
                />
                <span
                  id="book-cover-status"
                  className="help"
                  role="status"
                  {...controls["book-cover-status"]}
                >
                  {slots["book-cover-status"]}
                </span>
              </>
            )}
          </aside>
        </>
      )}
    </main>
  );
}
export function ArchivePage({
  slots = {},
  controls = {},
  profile = {},
  owner = false,
  values = {},
  record = {},
  children,
}) {
  return (
    <main id="main" className="column wide" tabIndex="-1" {...controls["main"]}>
      {slots["main"] ?? (
        <>
          <div className="page-heading">
            <div>
              <div className="eyebrow">{"A page in my picture book"}</div>
              <h2>{"The story of this place"}</h2>
              <p className="muted">
                {"Every little change leaves a footprint."}
              </p>
            </div>
          </div>
          <section className="paper note">
            <h3>{"A living picture book"}</h3>
            <p>
              {"This archive reads from "}
              <a href="../data/changelog.json">{"data/changelog.json"}</a>
              {". Each entry points to its version notes. The "}
              <a href="../README.md">{"README"}</a>
              {" explains how to add a chapter whenever the code changes."}
            </p>
          </section>
          <div id="timeline" className="timeline" {...controls["timeline"]}>
            {slots["timeline"] ?? (
              <>
                <p>{"Opening the archive…"}</p>
              </>
            )}
          </div>
        </>
      )}
    </main>
  );
}
export function UltilitiesPage({
  slots = {},
  controls = {},
  profile = {},
  owner = false,
  values = {},
  record = {},
  children,
}) {
  return (
    <main id="main" className="paper" tabIndex="-1" {...controls["main"]}>
      {slots["main"] ?? (
        <>
          <section
            className="utility-panel active"
            id="ai2d-rel-extract"
            {...controls["ai2d-rel-extract"]}
          >
            {slots["ai2d-rel-extract"] ?? (
              <>
                <div className="paper-title">
                  {"AI2D Relation Extractor "}
                  <span>{"✿"}</span>
                </div>
                <div className="ai2d-controls">
                  <label
                    htmlFor="imageInput"
                    className="custom-file-upload"
                    id="fileLabel"
                    {...controls["fileLabel"]}
                  >
                    {slots["fileLabel"] ?? <>{"↑ Choose Image"}</>}
                  </label>
                  <input
                    type="file"
                    id="imageInput"
                    accept="image/png,image/jpeg"
                    {...controls["imageInput"]}
                  />
                  <button
                    id="analyzeButton"
                    className="ai2d-analyze-btn"
                    {...controls["analyzeButton"]}
                  >
                    {slots["analyzeButton"] ?? <>{"✧ Analyze Diagram"}</>}
                  </button>
                </div>
                <p
                  id="status"
                  className="ai2d-status"
                  role="status"
                  {...controls["status"]}
                >
                  {slots["status"]}
                </p>
                <div
                  className="ai2d-results-grid"
                  id="image-gallery"
                  {...controls["image-gallery"]}
                >
                  {slots["image-gallery"]}
                </div>
              </>
            )}
          </section>
        </>
      )}
    </main>
  );
}
export function Layout({ widgets = false, page = "index", ...props }) {
  const {
    slots = {},
    controls = {},
    profile = {},
    owner = false,
    values = {},
    record = {},
    children,
  } = props;
  return (
    <div className="site-wrap">
      <div className="topline">
        <span>
          {"✿ welcome to "}
          <span data-profile="name">{profile["name"] ?? "Philine"}</span>
          {"’s little corner of the internet! ✿"}
        </span>
        <span id="clock" {...controls["clock"]}>
          {slots["clock"]}
        </span>
      </div>
      <Masthead profile={profile} />
      <div className="ticker">
        {"✿   You found a quiet corner of the internet. Welcome, wanderer.   ✿"}
      </div>
      <div className="layout">
        <aside className="column left-column">
          <section className="paper calendar-paper">
            <div className="paper-title">
              {"days to remember "}
              <span>{"❀"}</span>
            </div>
            <div id="calendar" {...controls["calendar"]}>
              {slots["calendar"] ?? (
                <>
                  <div className="calendar-bar">
                    <button
                      className="small"
                      data-action="month-prev"
                      aria-label="Previous month"
                    >
                      {"‹"}
                    </button>
                    <strong>{"Calendar"}</strong>
                    <button
                      className="small"
                      data-action="month-next"
                      aria-label="Next month"
                    >
                      {"›"}
                    </button>
                  </div>
                  <div className="calendar">
                    <span className="day-name">{"S"}</span>
                    <span className="day-name">{"M"}</span>
                    <span className="day-name">{"T"}</span>
                    <span className="day-name">{"W"}</span>
                    <span className="day-name">{"T"}</span>
                    <span className="day-name">{"F"}</span>
                    <span className="day-name">{"S"}</span>
                  </div>
                  <p className="calendar-note">
                    {"✿ Click a day to keep a little reminder."}
                  </p>
                </>
              )}
            </div>
          </section>
          <section className="paper directory">
            <div className="paper-title">
              {"directory "}
              <span>{"✿"}</span>
            </div>
            <nav className="navigation" aria-label="Main navigation">
              <a
                href="index.html"
                aria-current={page === "index" ? "page" : undefined}
              >
                <span aria-hidden="true">{"⌂"}</span>
                {"Home"}
              </a>
              <a
                href="posts.html"
                aria-current={page === "posts" ? "page" : undefined}
              >
                <span aria-hidden="true">{"✎"}</span>
                {"Daily life"}
              </a>
              <a
                href="blog.html"
                aria-current={page === "blog" ? "page" : undefined}
              >
                <span aria-hidden="true">{"❧"}</span>
                {"Blog & stories"}
              </a>
              <a
                href="documents.html"
                aria-current={page === "documents" ? "page" : undefined}
              >
                <span aria-hidden="true">{"▤"}</span>
                {"Documents"}
              </a>
              <a
                href="work.html"
                aria-current={page === "work" ? "page" : undefined}
              >
                <span aria-hidden="true">{"☑"}</span>
                {"Work"}
              </a>
              <a
                href="utilities.html"
                aria-current={page === "utilities" ? "page" : undefined}
              >
                <span aria-hidden="true">{"⚒"}</span>
                {"Utilities"}
              </a>
              <a
                href="anime.html"
                aria-current={page === "anime" ? "page" : undefined}
              >
                <span aria-hidden="true">{"☆"}</span>
                {"Anime log"}
              </a>
              <a
                href="novels.html"
                aria-current={page === "novels" ? "page" : undefined}
              >
                <span aria-hidden="true">{"♧"}</span>
                {"Reading room"}
              </a>
              <a
                href="archive.html"
                aria-current={page === "archive" ? "page" : undefined}
              >
                <span aria-hidden="true">{"↺"}</span>
                {"Archive"}
              </a>
            </nav>
          </section>
          <section className="paper profile">
            <img
              className="avatar"
              src="../assets/images/Philine-P5V6.webp"
              alt="Philine’s illustrated avatar"
            />
            <h2>
              {"Hello, I’m "}
              <span data-profile="name">{profile["name"] ?? "Philine"}</span>
              {"."}
            </h2>
            <p data-profile="bio">
              {profile["bio"] ??
                "A collector of stories, little moments, and things worth keeping."}
            </p>
            <span className="tag">
              {"✿ "}
              <span data-profile="status">
                {profile["status"] ?? "Putting my little world back together"}
              </span>
            </span>
            <p className="muted">{"This is my little digital home."}</p>
            <button
              data-owner-only=""
              className="small"
              data-action="profile"
              hidden={!owner}
            >
              {"Edit my corner"}
            </button>
          </section>
          <section className="paper note">
            <h3>{"A note to self"}</h3>
            <p>{"A website doesn’t have to be finished to feel like home."}</p>
          </section>
          <section className="paper tiny-card">
            <div className="paper-title">
              {"little paths "}
              <span>{"↗"}</span>
            </div>
            <div className="tiny-links">
              <a
                href="posts.html"
                aria-current={page === "posts" ? "page" : undefined}
              >
                {"✎ Letters from everyday life"}
              </a>
              <a
                href="novels.html"
                aria-current={page === "novels" ? "page" : undefined}
              >
                {"♧ Get lost in a book"}
              </a>
              <a
                href="archive.html"
                aria-current={page === "archive" ? "page" : undefined}
              >
                {"↺ Watch this place grow"}
              </a>
            </div>
            <div className="badge-row">
              <span className="web-badge">
                {"HANDMADE"}
                <br />
                {"WITH LOVE"}
              </span>
              <span className="web-badge pink">
                {"SMALL WEB"}
                <br />
                {"BIG HEART"}
              </span>
            </div>
            <small>{"Best enjoyed at your own pace."}</small>
          </section>
        </aside>
        {children}
        {widgets && (
          <aside
            className="column right-column"
            id="widgets"
            {...controls["widgets"]}
          >
            {slots["widgets"] ?? (
              <>
                <section className="paper">
                  <div className="paper-title">
                    {"Music of the day "}
                    <span>{"♫"}</span>
                  </div>
                  <div className="track">
                    <img
                      id="music-cover"
                      className="music-cover"
                      src="../assets/images/Philine-P5V6.webp"
                      alt="Music artwork"
                      {...controls["music-cover"]}
                    />
                    <div>
                      <strong data-profile="song">
                        {profile["song"] ?? "Your music of the day"}
                      </strong>
                      <small data-profile="artist">
                        {profile["artist"] ??
                          "Choose a track from your collection"}
                      </small>
                    </div>
                  </div>
                  <div className="music-line">
                    <a
                      className="button small"
                      id="music-listen"
                      target="_blank"
                      rel="noopener noreferrer"
                      hidden={true}
                      {...controls["music-listen"]}
                    >
                      {slots["music-listen"] ?? <>{"▶ Listen on YouTube ↗"}</>}
                    </a>
                  </div>
                  <p
                    className="music-caption"
                    id="audio-status"
                    {...controls["audio-status"]}
                  >
                    {slots["audio-status"] ?? (
                      <>{"A soundtrack for this little moment."}</>
                    )}
                  </p>
                  <div data-owner-only="" hidden={!owner}>
                    <label>
                      {"\n              YouTube link\n              "}
                      <input
                        id="music-url"
                        type="url"
                        placeholder="https://www.youtube.com/watch?v=..."
                        {...controls["music-url"]}
                      />
                    </label>
                    <button
                      id="music-load"
                      type="button"
                      disabled={true}
                      {...controls["music-load"]}
                    >
                      {slots["music-load"] ?? <>{"Load music"}</>}
                    </button>
                    <p
                      className="help"
                      style={{
                        marginTop: "6px",
                        marginRight: "0px",
                        marginBottom: "0px",
                        marginLeft: "0px",
                        fontSize: "10px",
                      }}
                    >
                      {
                        "Your saved song is visible to everyone. Only you can change it. Listening opens YouTube in a new tab."
                      }
                    </p>
                  </div>
                </section>
                <section className="paper">
                  <div className="paper-title">
                    {"In my little world "}
                    <button
                      type="button"
                      className="small"
                      data-action="interests"
                      data-owner-only=""
                      aria-label="Edit watching, playing and doing"
                      hidden={!owner}
                    >
                      {"✎"}
                    </button>
                  </div>
                  <div className="currently">
                    <span className="symbol" aria-hidden="true">
                      {"▻"}
                    </span>
                    <p>
                      <small>{"Watching"}</small>
                      <span data-profile="watching">
                        {profile["watching"] ?? "Cardcaptor Sakura"}
                      </span>
                    </p>
                    <span className="symbol" aria-hidden="true">
                      {"♧"}
                    </span>
                    <p>
                      <small>{"Playing"}</small>
                      <span data-profile="playing">
                        {profile["playing"] ?? "Skyrim"}
                      </span>
                    </p>
                    <span className="symbol" aria-hidden="true">
                      {"✎"}
                    </span>
                    <p>
                      <small>{"Doing"}</small>
                      <span data-profile="doing">
                        {profile["doing"] ?? "Rebuilding this picture book"}
                      </span>
                    </p>
                  </div>
                </section>
                <section className="paper">
                  <div className="paper-title">
                    {"Outside my window "}
                    <span>{"☁"}</span>
                  </div>
                  <div id="weather" {...controls["weather"]}>
                    {slots["weather"] ?? (
                      <>
                        <div className="weather">
                          <span className="weather-icon">{"☀"}</span>
                          <p>
                            {"A little look outside."}
                            <br />
                            <small>{"Weather for your chosen location"}</small>
                          </p>
                        </div>
                        <button
                          className="small"
                          style={{ marginTop: "12px" }}
                          data-action="weather"
                        >
                          {"Use my location"}
                        </button>
                        <button className="small" data-action="weather-place">
                          {"Choose place"}
                        </button>
                      </>
                    )}
                  </div>
                  <small>
                    <a
                      href="https://open-meteo.com/"
                      target="_blank"
                      rel="noopener"
                    >
                      {"Weather by Open-Meteo"}
                    </a>
                  </small>
                </section>
              </>
            )}
          </aside>
        )}
      </div>
      <footer className="footer">
        <span>
          {"Made with care, a few loose threads, and a lot of heart. ♡"}
        </span>
        <span data-owner-only="" hidden={!owner}>
          <button data-owner-only="" data-action="logout" hidden={!owner}>
            {"Sign out"}
          </button>
          {" · "}
          <button data-owner-only="" data-action="backup" hidden={!owner}>
            {"Backup & import"}
          </button>
          <button data-owner-only="" data-action="trash" hidden={!owner}>
            {"Trash"}
          </button>
        </span>
        <span>
          <a href="../README.md">{"Readme"}</a>
          {" · "}
          <a href="../docs/PROJECT-REPORT.md">{"Site report"}</a>
        </span>
      </footer>
    </div>
  );
}

export function Masthead({ profile = {} }) {
  return (
    <header className="masthead">
      <div className="eyebrow">{"A personal corner of the world wide web"}</div>
      <h1>
        <a
          className="wordmark"
          href="index.html"
          aria-label={(profile.name || "Philine") + "’s Picture Book — home"}
        >
          <span className="wordmark-name" aria-hidden="true">
            {Array.from(profile.name || "Philine", (letter, i) => (
              <span key={i} className="logo-char" style={{ "--order": i }}>
                {letter === " " ? "\u00a0" : letter}
              </span>
            ))}
            <span className="logo-suffix">’s</span>
          </span>
          <span className="wordmark-book" aria-hidden="true">
            {"Picture Book"}
          </span>
        </a>
      </h1>
      <p>
        {"Ordinary days, extraordinary stories."}
        <br />
        {"A little home, somewhere between the pages."}
      </p>
      <a
        className="mascot-link"
        href="index.html"
        aria-label="Return home with the book-loving mascot"
      >
        <img
          className="mascot"
          src="../assets/images/rzmcsb_trans_rel.png"
          alt="A little book-loving character with a walking book"
        />
      </a>
      <span className="theme-stamp">{"✧ handmade on the small web ✧"}</span>
    </header>
  );
}
