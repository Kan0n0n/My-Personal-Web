import React from "react";
export function EntryTemplate({
  slots = {},
  controls = {},
  profile = {},
  owner = false,
  values = {},
  record = {},
  children,
}) {
  return (
    <article className="paper entry">
      <span className="date" data-field="date">
        {values["date"] ?? ""}
      </span>
      <h3 data-field="title">{values["title"] ?? ""}</h3>
      <p data-field="body">{values["body"] ?? ""}</p>
      <div className="entry-footer">
        <span data-field="tags">{values["tags"] ?? ""}</span>
        <button
          data-owner-only=""
          className="small"
          data-action="edit"
          hidden={!owner}
        >
          {"Edit page"}
        </button>
      </div>
    </article>
  );
}
export function ReaderTemplate({
  slots = {},
  controls = {},
  profile = {},
  owner = false,
  values = {},
  record = {},
  children,
}) {
  return (
    <div>
      <div className="reader-tools">
        <button
          data-owner-only=""
          className="small"
          data-action="bookmark"
          hidden={!owner}
        >
          {"Keep my place"}
        </button>
        <div>
          <button
            data-owner-only=""
            className="small"
            data-action="font-down"
            aria-label="Smaller text"
            hidden={!owner}
          >
            {"A−"}
          </button>
          <button
            data-owner-only=""
            className="small"
            data-action="font-up"
            aria-label="Larger text"
            hidden={!owner}
          >
            {"A+"}
          </button>
          <button
            data-owner-only=""
            className="small"
            data-action="reader-theme"
            hidden={!owner}
          >
            {"Light / dark"}
          </button>
          <label className="reader-font-label">
            {"Novel font\n          "}
            <select
              id="reader-font"
              aria-label="Novel text font"
              {...controls["reader-font"]}
            >
              {slots["reader-font"] ?? (
                <>
                  <option value="georgia">{"Georgia"}</option>
                  <option value="overlock">{"Overlock"}</option>
                  <option value="palatino">{"Palatino"}</option>
                  <option value="arial">{"Arial"}</option>
                  <option value="verdana">{"Verdana"}</option>
                  <option value="monospace">{"Monospace"}</option>
                </>
              )}
            </select>
          </label>
          <label className="reader-font-label">
            {"Alignment\n          "}
            <select
              id="reader-alignment"
              aria-label="Novel text alignment"
              {...controls["reader-alignment"]}
            >
              {slots["reader-alignment"] ?? (
                <>
                  <option value="left">{"Left"}</option>
                  <option value="center">{"Center"}</option>
                  <option value="right">{"Right"}</option>
                  <option value="justify">{"Justify"}</option>
                </>
              )}
            </select>
          </label>
        </div>
      </div>
      <h3 data-field="title">{values["title"] ?? ""}</h3>
      <p className="help" id="bookmark-status" {...controls["bookmark-status"]}>
        {slots["bookmark-status"] ?? <>{"Make yourself comfortable."}</>}
      </p>
      <p
        className="help"
        id="autosave-status"
        role="status"
        {...controls["autosave-status"]}
      >
        {slots["autosave-status"] ?? (
          <>{"Your reading position saves automatically."}</>
        )}
      </p>
      <section className="reader-speech" aria-label="Read novel aloud">
        <div className="speech-controls">
          <button type="button" id="speech-play" {...controls["speech-play"]}>
            {slots["speech-play"] ?? <>{"▶ Read aloud"}</>}
          </button>
          <button
            type="button"
            id="speech-pause"
            disabled={true}
            {...controls["speech-pause"]}
          >
            {slots["speech-pause"] ?? <>{"Pause"}</>}
          </button>
          <button
            type="button"
            id="speech-stop"
            disabled={true}
            {...controls["speech-stop"]}
          >
            {slots["speech-stop"] ?? <>{"Stop"}</>}
          </button>
          <label>
            {"Device voice"}
            <select
              id="speech-voice"
              aria-label="Read-aloud voice"
              {...controls["speech-voice"]}
            >
              {slots["speech-voice"]}
            </select>
          </label>
          <label>
            {"Speed"}
            <select
              id="speech-rate"
              aria-label="Read-aloud speed"
              {...controls["speech-rate"]}
            >
              {slots["speech-rate"] ?? (
                <>
                  <option value="0.5">{"0.5×"}</option>
                  <option value="0.75">{"0.75×"}</option>
                  <option value="1">{"1×"}</option>
                  <option value="1.25">{"1.25×"}</option>
                  <option value="1.5">{"1.5×"}</option>
                  <option value="1.75">{"1.75×"}</option>
                  <option value="2">{"2×"}</option>
                </>
              )}
            </select>
          </label>
          <label className="speech-follow">
            <input
              type="checkbox"
              id="speech-follow"
              defaultChecked
              {...controls["speech-follow"]}
            />
            {" Follow voice"}
          </label>
        </div>
        <p
          className="help"
          id="speech-status"
          role="status"
          {...controls["speech-status"]}
        >
          {slots["speech-status"] ?? (
            <>
              {
                "Choose a device voice. Select a sentence or start from your visible position."
              }
            </>
          )}
        </p>
        <div
          id="speech-highlight-layer"
          aria-hidden="true"
          {...controls["speech-highlight-layer"]}
        >
          {slots["speech-highlight-layer"]}
        </div>
      </section>
      <div
        className="reader-navigation"
        id="format-navigation"
        hidden={true}
        {...controls["format-navigation"]}
      >
        {slots["format-navigation"] ?? (
          <>
            <button
              type="button"
              className="small"
              id="reader-prev"
              {...controls["reader-prev"]}
            >
              {slots["reader-prev"] ?? <>{"← Previous"}</>}
            </button>
            <label>
              {"Title - Page"}
              <select
                id="reader-section"
                aria-label="Title and page"
                {...controls["reader-section"]}
              >
                {slots["reader-section"]}
              </select>
            </label>
            <button
              type="button"
              className="small"
              id="reader-next"
              {...controls["reader-next"]}
            >
              {slots["reader-next"] ?? <>{"Next →"}</>}
            </button>
          </>
        )}
      </div>
      <div className="reader-text" data-field="text">
        {values["text"] ?? ""}
      </div>
      <nav
        className="reader-navigation reader-navigation-bottom"
        id="format-navigation-bottom"
        aria-label="Continue reading"
        hidden={true}
        {...controls["format-navigation-bottom"]}
      >
        {slots["format-navigation-bottom"] ?? (
          <>
            <button
              type="button"
              className="small"
              id="reader-prev-bottom"
              {...controls["reader-prev-bottom"]}
            >
              {slots["reader-prev-bottom"] ?? <>{"← Previous chapter"}</>}
            </button>
            <span
              className="help"
              id="reader-section-bottom"
              aria-live="polite"
              {...controls["reader-section-bottom"]}
            >
              {slots["reader-section-bottom"]}
            </span>
            <button
              type="button"
              className="small"
              id="reader-next-bottom"
              {...controls["reader-next-bottom"]}
            >
              {slots["reader-next-bottom"] ?? <>{"Next chapter →"}</>}
            </button>
            <button
              type="button"
              className="small"
              id="reader-next-title"
              hidden={true}
              {...controls["reader-next-title"]}
            >
              {slots["reader-next-title"] ?? <>{"Next title ⇥"}</>}
            </button>
          </>
        )}
      </nav>
      <div className="record-spacing">
        <button
          data-owner-only=""
          className="small"
          data-action="move-book"
          hidden={!owner}
          onClick={controls.editBook}
        >
          {"Edit title / folder"}
        </button>
        <a
          id="book-download"
          className="button small"
          hidden={true}
          {...controls["book-download"]}
        >
          {slots["book-download"] ?? <>{"Download original"}</>}
        </a>
        <button
          data-owner-only=""
          className="small"
          data-action="remove-book"
          hidden={!owner}
          onClick={controls.removeBook}
        >
          {"Remove from shelf"}
        </button>
      </div>
    </div>
  );
}
export function FolderFields({
  slots = {},
  controls = {},
  profile = {},
  owner = false,
  values = {},
  record = {},
  children,
}) {
  return (
    <div>
      <label>
        {"Series / folder name"}
        <input
          name="title"
          required={true}
          maxLength="500"
          placeholder="e.g. Ascendance of a Bookworm"
          defaultValue={record["title"] ?? ""}
        />
      </label>
    </div>
  );
}
export function BookFolderFields({
  slots = {},
  controls = {},
  profile = {},
  owner = false,
  values = {},
  record = {},
  children,
}) {
  return (
    <div>
      <label>
        {"Volume title"}
        <input
          name="title"
          required={true}
          maxLength="500"
          defaultValue={record["title"] ?? ""}
        />
      </label>
      <label>
        {"Series folder"}
        <select
          name="folderId"
          id="book-folder-choice"
          {...controls["book-folder-choice"]}
          defaultValue={record["folderId"] ?? ""}
        >
          {slots["book-folder-choice"] ?? (
            <>
              <option>{"Unfiled books"}</option>
            </>
          )}
        </select>
      </label>
    </div>
  );
}
export function EmptyPosts({
  slots = {},
  controls = {},
  profile = {},
  owner = false,
  values = {},
  record = {},
  children,
}) {
  return (
    <div className="empty">
      <span className="symbol" aria-hidden="true">
        {"✎"}
      </span>
      <h3>{"A blank page is a beginning"}</h3>
      <p>{"Your words belong here. Start with one little thought."}</p>
      <button data-owner-only="" data-action="new-post" hidden={!owner}>
        {"Write the first page"}
      </button>
    </div>
  );
}
export function EmptyBlogs({
  slots = {},
  controls = {},
  profile = {},
  owner = false,
  values = {},
  record = {},
  children,
}) {
  return (
    <div className="empty">
      <span className="symbol" aria-hidden="true">
        {"✎"}
      </span>
      <h3>{"A blank page is a beginning"}</h3>
      <p>{"Longer thoughts and stories belong here."}</p>
      <button data-owner-only="" data-action="new-blog" hidden={!owner}>
        {"Write the first page"}
      </button>
    </div>
  );
}
export function EmptyDocuments({
  slots = {},
  controls = {},
  profile = {},
  owner = false,
  values = {},
  record = {},
  children,
}) {
  return (
    <div className="empty">
      <span className="symbol" aria-hidden="true">
        {"▤"}
      </span>
      <h3>{"Room for your materials"}</h3>
      <p>{"Add a link to a lesson plan, worksheet, or resource."}</p>
      <button data-owner-only="" data-action="new-document" hidden={!owner}>
        {"Save a material"}
      </button>
    </div>
  );
}
export function EmptyAnime({
  slots = {},
  controls = {},
  profile = {},
  owner = false,
  values = {},
  record = {},
  children,
}) {
  return (
    <div className="empty">
      <span className="symbol" aria-hidden="true">
        {"☆"}
      </span>
      <h3>{"Stories stay with us"}</h3>
      <p>{"Keep your own thoughts, progress, and very personal ratings."}</p>
      <button data-owner-only="" data-action="new-anime" hidden={!owner}>
        {"Log your first anime"}
      </button>
    </div>
  );
}
export function EmptyBooks({
  slots = {},
  controls = {},
  profile = {},
  owner = false,
  values = {},
  record = {},
  children,
}) {
  return <p className="help">{"No stories on this shelf yet."}</p>;
}
export function NoResults({
  slots = {},
  controls = {},
  profile = {},
  owner = false,
  values = {},
  record = {},
  children,
}) {
  return (
    <div className="empty">
      <span className="symbol" aria-hidden="true">
        {"✿"}
      </span>
      <h3>{"No matching pages"}</h3>
      <p>{"Try another word or filter."}</p>
    </div>
  );
}
export function ProfileFields({
  slots = {},
  controls = {},
  profile = {},
  owner = false,
  values = {},
  record = {},
  children,
}) {
  return (
    <div>
      <p className="help">
        {"Leave optional text empty to use the page’s default text."}
      </p>
      <label>
        {"Profile visibility"}
        <select name="is_public" defaultValue={record["is_public"] ?? "false"}>
          <option>{"Private"}</option>
          <option>{"Public"}</option>
        </select>
      </label>
      <p className="help">
        {
          "Music of the Day is always visible to visitors. Only you can change it."
        }
      </p>
      <label>
        {"Your name"}
        <input
          name="name"
          required={true}
          defaultValue={record["name"] ?? ""}
        />
      </label>
      <label>
        {"A little introduction"}
        <textarea name="bio" defaultValue={record["bio"] ?? ""}></textarea>
      </label>
      <label>
        {"Current status"}
        <input name="status" defaultValue={record["status"] ?? ""} />
      </label>
      <label>
        {"Welcome note"}
        <textarea name="intro" defaultValue={record["intro"] ?? ""}></textarea>
      </label>
      <label>
        {"Currently watching"}
        <input name="watching" defaultValue={record["watching"] ?? ""} />
      </label>
      <label>
        {"Currently playing"}
        <input name="playing" defaultValue={record["playing"] ?? ""} />
      </label>
      <label>
        {"Currently doing"}
        <input name="doing" defaultValue={record["doing"] ?? ""} />
      </label>
      <label>
        {"Music of the day — title"}
        <input name="song" defaultValue={record["song"] ?? ""} />
      </label>
      <label>
        {"Artist / credit"}
        <input name="artist" defaultValue={record["artist"] ?? ""} />
      </label>
    </div>
  );
}
export function InterestsFields({
  slots = {},
  controls = {},
  profile = {},
  owner = false,
  values = {},
  record = {},
  children,
}) {
  return (
    <div>
      <label>
        {"Currently watching"}
        <input name="watching" defaultValue={record["watching"] ?? ""} />
      </label>
      <label>
        {"Currently playing"}
        <input name="playing" defaultValue={record["playing"] ?? ""} />
      </label>
      <label>
        {"Currently doing"}
        <input name="doing" defaultValue={record["doing"] ?? ""} />
      </label>
    </div>
  );
}
export function PostFields({
  slots = {},
  controls = {},
  profile = {},
  owner = false,
  values = {},
  record = {},
  children,
}) {
  return (
    <div>
      <label>
        {"Title"}
        <input
          name="title"
          required={true}
          defaultValue={record["title"] ?? ""}
        />
      </label>
      <label>
        {"Date"}
        <input
          name="date"
          type="date"
          required={true}
          defaultValue={record["date"] ?? ""}
        />
      </label>
      <label>
        {"Your words"}
        <textarea
          name="body"
          required={true}
          defaultValue={record["body"] ?? ""}
        ></textarea>
      </label>
      <label>
        {"Tags / little labels"}
        <input name="tags" defaultValue={record["tags"] ?? ""} />
      </label>
    </div>
  );
}
export function BlogFields({
  slots = {},
  controls = {},
  profile = {},
  owner = false,
  values = {},
  record = {},
  children,
}) {
  return (
    <div>
      <label>
        {"Title"}
        <input
          name="title"
          required={true}
          defaultValue={record["title"] ?? ""}
        />
      </label>
      <label>
        {"Date"}
        <input
          name="date"
          type="date"
          required={true}
          defaultValue={record["date"] ?? ""}
        />
      </label>
      <label>
        {"Shelf"}
        <select name="category" defaultValue={record["category"] ?? "Blog"}>
          <option>{"Blog"}</option>
          <option>{"Story"}</option>
        </select>
      </label>
      <label>
        {"Your words"}
        <textarea
          name="body"
          required={true}
          defaultValue={record["body"] ?? ""}
        ></textarea>
      </label>
      <label>
        {"Tags / little labels"}
        <input name="tags" defaultValue={record["tags"] ?? ""} />
      </label>
    </div>
  );
}
export function TaskFields({
  slots = {},
  controls = {},
  profile = {},
  owner = false,
  values = {},
  record = {},
  children,
}) {
  return (
    <div>
      <label>
        {"Task"}
        <input
          name="title"
          required={true}
          defaultValue={record["title"] ?? ""}
        />
      </label>
      <label>
        {"Notes"}
        <textarea name="note" defaultValue={record["note"] ?? ""}></textarea>
      </label>
      <label>
        {"Due date (optional)"}
        <input name="due" type="date" defaultValue={record["due"] ?? ""} />
      </label>
      <label>
        {"Progress"}
        <select name="status" defaultValue={record["status"] ?? "To do"}>
          <option>{"To do"}</option>
          <option>{"In progress"}</option>
          <option>{"Done"}</option>
        </select>
      </label>
    </div>
  );
}
export function DocumentFields({
  slots = {},
  controls = {},
  profile = {},
  owner = false,
  values = {},
  record = {},
  children,
}) {
  return (
    <div>
      <label>
        {"Title"}
        <input
          name="title"
          required={true}
          defaultValue={record["title"] ?? ""}
        />
      </label>
      <label>
        {"Material link (https://…)"}
        <input
          name="url"
          type="url"
          required={true}
          defaultValue={record["url"] ?? ""}
        />
      </label>
      <label>
        {"Folder / subject"}
        <input name="folder" defaultValue={record["folder"] ?? ""} />
      </label>
      <label>
        {"A little description"}
        <textarea name="note" defaultValue={record["note"] ?? ""}></textarea>
      </label>
    </div>
  );
}
export function AnimeFields({
  slots = {},
  controls = {},
  profile = {},
  owner = false,
  values = {},
  record = {},
  children,
}) {
  return (
    <div>
      <label>
        {"Anime title"}
        <input
          name="title"
          required={true}
          defaultValue={record["title"] ?? ""}
        />
      </label>
      <label>
        {"Status"}
        <select name="status" defaultValue={record["status"] ?? "Watching"}>
          <option>{"Watching"}</option>
          <option>{"Completed"}</option>
          <option>{"On hold"}</option>
          <option>{"Plan to watch"}</option>
        </select>
      </label>
      <label>
        {"My rating"}
        <select name="rating" defaultValue={record["rating"] ?? "1"}>
          <option>{"1"}</option>
          <option>{"2"}</option>
          <option>{"3"}</option>
          <option>{"4"}</option>
          <option>{"5"}</option>
        </select>
      </label>
      <label>
        {"Episodes watched"}
        <input
          name="episodes"
          type="number"
          min="0"
          defaultValue={record["episodes"] ?? "0"}
        />
      </label>
      <label>
        {"Log date"}
        <input
          name="date"
          type="date"
          required={true}
          defaultValue={record["date"] ?? ""}
        />
      </label>
      <label>
        {"My thoughts"}
        <textarea name="body" defaultValue={record["body"] ?? ""}></textarea>
      </label>
      <label>
        {"Contains spoilers?"}
        <select name="spoilers" defaultValue={record["spoilers"] ?? "No"}>
          <option>{"No"}</option>
          <option>{"Yes"}</option>
        </select>
      </label>
    </div>
  );
}
export function ReminderFields({
  slots = {},
  controls = {},
  profile = {},
  owner = false,
  values = {},
  record = {},
  children,
}) {
  return (
    <div>
      <div data-event-list="">{slots.events}</div>
      <label>
        {"New reminder"}
        <input
          name="title"
          required={true}
          defaultValue={record["title"] ?? ""}
        />
      </label>
    </div>
  );
}
export function ConfirmationFields({
  slots = {},
  controls = {},
  profile = {},
  owner = false,
  values = {},
  record = {},
  children,
}) {
  return <p data-confirm-message="">{values.message}</p>;
}
export function WeatherResult({
  slots = {},
  controls = {},
  profile = {},
  owner = false,
  values = {},
  record = {},
  children,
}) {
  return (
    <div>
      <div className="weather">
        <span className="weather-icon" data-field="icon">
          {values["icon"] ?? ""}
        </span>
        <p>
          <strong data-field="temperature">
            {values["temperature"] ?? ""}
          </strong>
          {" · "}
          <span data-field="label">{values["label"] ?? ""}</span>
          <br />
          <small data-field="updated">{values["updated"] ?? ""}</small>
        </p>
      </div>
      <button className="small record-heading" data-action="weather-refresh">
        {"Refresh"}
      </button>
      <button className="small" data-action="weather-place">
        {"Change place"}
      </button>
    </div>
  );
}
export function WeatherError({
  slots = {},
  controls = {},
  profile = {},
  owner = false,
  values = {},
  record = {},
  children,
}) {
  return (
    <div>
      <p className="help" data-field="message">
        {values["message"] ?? "The forecast is unavailable right now."}
      </p>
      <button className="small" data-action="weather-refresh">
        {"Try again"}
      </button>
      <button className="small" data-action="weather-place">
        {"Choose place"}
      </button>
    </div>
  );
}
export function WeatherPlaceFields({
  slots = {},
  controls = {},
  profile = {},
  owner = false,
  values = {},
  record = {},
  children,
}) {
  return (
    <div>
      <label>
        {"City or town"}
        <input
          name="place"
          required={true}
          minLength="2"
          maxLength="100"
          placeholder="City or town name"
          defaultValue={record["place"] ?? ""}
        />
      </label>
      <p className="help">
        {
          "Search sends the place name to Open-Meteo. Choose the matching region and country. This choice lasts for this page visit."
        }
      </p>
      <div
        id="weather-matches"
        aria-live="polite"
        {...controls["weather-matches"]}
      >
        {slots["weather-matches"]}
      </div>
    </div>
  );
}
