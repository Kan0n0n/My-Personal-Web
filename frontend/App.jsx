import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import * as V from "./views.jsx";
import * as T from "./templates.jsx";
import defaults from "./defaults.json";
import {
  request,
  safeURL,
  localDate,
  dateLabel,
  download,
  legacyExport,
} from "./api.js";
const Library = lazy(() => import("./Library.jsx"));
const Extractor = lazy(() => import("./Extractor.jsx"));

const blank = {
  profile: {},
  posts: [],
  blogs: [],
  tasks: [],
  documents: [],
  anime: [],
  events: [],
  reading: {},
};
const kinds = {
  posts: ["A little moment", T.PostFields],
  blogs: ["A page of words", T.BlogFields],
  tasks: ["One thing to do", T.TaskFields],
  documents: ["A material to keep", T.DocumentFields],
  anime: ["After the end credits", T.AnimeFields],
};
const route =
  location.pathname.split("/").pop().replace(".html", "") || "index";
export default function App() {
  const [state, setState] = useState(blank),
    [owner, setOwner] = useState(false),
    [ready, setReady] = useState(false),
    [notebookRevision, setNotebookRevision] = useState(0),
    [message, setMessage] = useState(""),
    [dialog, setDialog] = useState(null);
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState(""),
    [month, setMonth] = useState(() => {
      const d = new Date();
      d.setDate(1);
      return d;
    }),
    [versions, setVersions] = useState([]),
    [clock, setClock] = useState("");
  const [choices, setChoices] = useState(""),
    [pick, setPick] = useState(""),
    [count, setCount] = useState(""),
    [music, setMusic] = useState(""),
    [audio, setAudio] = useState("A soundtrack for this little moment."),
    [busy, setBusy] = useState(false);
  const [weather, setWeather] = useState(null),
    weatherEpoch = useRef(0),
    weatherPlace = useRef(null),
    dialogRef = useRef(null),
    returnFocus = useRef(null);
  const profile = { ...defaults, ...state.profile };
  for (const k of Object.keys(defaults))
    if (typeof profile[k] === "string" && !profile[k].trim())
      profile[k] = defaults[k];
  async function reload() {
    const session = await request("/api/auth/session");
    setOwner(session.authenticated);
    const data = await request(
      session.authenticated ? "/api/me/notebook" : "/api/public/notebook",
    );
    setState({ ...blank, ...data });
    setNotebookRevision((value) => value + 1);
    return data;
  }
  useEffect(() => {
    let live = true;
    async function load() {
      try {
        const s = await request("/api/auth/session");
        const data = await request(
          s.authenticated ? "/api/me/notebook" : "/api/public/notebook",
        );
        if (live) {
          setOwner(s.authenticated);
          setState({ ...blank, ...data });
          setReady(true);
        }
      } catch (e) {
        if (live) {
          setMessage(e.message);
          setReady(true);
        }
      }
    }
    load();
    const expired = () => {
      setOwner(false);
      setDialog(null);
    };
    window.addEventListener("session-expired", expired);
    return () => {
      live = false;
      window.removeEventListener("session-expired", expired);
    };
  }, []);
  useEffect(() => {
    document.body.dataset.owner = String(owner);
  }, [owner]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 5000);
    return () => clearTimeout(timer);
  }, [message]);
  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleString("en-GB", {
          timeZone: "Asia/Ho_Chi_Minh",
          weekday: "short",
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }) + " · ICT",
      );
    tick();
    const timer = setInterval(tick, 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (route !== "archive") return;
    const controller = new AbortController();
    fetch("/data/changelog.json", { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw Error("Archive unavailable");
        return r.json();
      })
      .then(setVersions)
      .catch((e) => {
        if (e.name !== "AbortError") setMessage(e.message);
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const d = dialogRef.current;
    if (dialog) {
      returnFocus.current = document.activeElement;
      if (!d.open) d.showModal();
    } else if (d?.open) {
      d.close();
      returnFocus.current?.focus();
    }
  }, [dialog]);
  const run = (fn) =>
    Promise.resolve()
      .then(fn)
      .catch((e) => setMessage(e.message));
  function open(spec) {
    setDialog({ ...spec, key: crypto.randomUUID() });
  }
  async function saveRecord(key, data, old) {
    await request(
      `/api/me/records/${key}${old ? "/" + old.id : ""}`,
      old ? "PUT" : "POST",
      { ...data, ...(old ? { revision: old.revision } : {}) },
    );
    await reload();
  }
  function confirm(title, message, submit) {
    open({ title, Fields: T.ConfirmationFields, values: { message }, submit });
  }
  function edit(key, id) {
    const old = state[key].find((r) => r.id === id);
    open({
      title: kinds[key][0],
      Fields: kinds[key][1],
      record: {
        date: localDate(),
        rating: "3",
        episodes: "0",
        ...old,
        ...(key === "anime" ? { spoilers: old?.spoilers ? "Yes" : "No" } : {}),
      },
      collection: key,
      old,
      submit: async (data) => {
        if (key === "anime") data.spoilers = data.spoilers === "Yes";
        await saveRecord(key, data, old);
      },
    });
  }
  function editProfile(interests = false) {
    open({
      title: interests ? "In my little world" : "Make yourself at home",
      Fields: interests ? T.InterestsFields : T.ProfileFields,
      record: profile,
      submit: async (data) => {
        await request("/api/me/profile", "PUT", {
          ...profile,
          ...data,
          ...("is_public" in data
            ? { is_public: data.is_public === "true" }
            : {}),
        });
        await reload();
      },
    });
  }
  function editDay(date) {
    open({
      title: dateLabel(date),
      Fields: T.ReminderFields,
      slots: {
        events: state.events
          .filter((r) => r.date === date)
          .map((r) => (
            <p key={r.id}>
              {r.title}{" "}
              <button
                type="button"
                onClick={() =>
                  run(async () => {
                    await request(
                      `/api/me/records/events/${r.id}/trash`,
                      "POST",
                      { revision: r.revision },
                    );
                    await reload();
                    setDialog(null);
                  })
                }
              >
                Remove
              </button>
            </p>
          )),
      },
      submit: (data) => saveRecord("events", { title: data.title, date }),
    });
  }
  async function loadWeather(latitude, longitude, name) {
    const epoch = ++weatherEpoch.current;
    setWeather({ message: "Looking outside…" });
    try {
      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        Math.abs(latitude) > 90 ||
        Math.abs(longitude) > 180
      )
        throw Error("Invalid location.");
      weatherPlace.current = { latitude, longitude, name };
      const u = new URL("https://api.open-meteo.com/v1/forecast");
      u.search = new URLSearchParams({
        latitude,
        longitude,
        current: "temperature_2m,weather_code",
        timezone: "auto",
        temperature_unit: "celsius",
      });
      const r = await fetch(u, { signal: AbortSignal.timeout(12000) });
      if (!r.ok) throw Error("Weather service unavailable.");
      const c = (await r.json()).current;
      if (
        !c ||
        !Number.isFinite(c.temperature_2m) ||
        !Number.isInteger(c.weather_code)
      )
        throw Error("The weather response was incomplete.");
      const code = c.weather_code,
        label =
          code === 0
            ? "Clear skies"
            : code <= 3
              ? "A few clouds"
              : [45, 48].includes(code)
                ? "Fog outside"
                : code <= 57
                  ? "Drizzle outside"
                  : code <= 67
                    ? "Rain outside"
                    : code <= 77
                      ? "Snow outside"
                      : code <= 82
                        ? "Passing showers"
                        : code <= 86
                          ? "Snow showers"
                          : code >= 95
                            ? "Stormy skies"
                            : "Current weather";
      if (epoch === weatherEpoch.current)
        setWeather({
          icon: code <= 3 ? "☀" : "☁",
          temperature: Math.round(c.temperature_2m) + "°C",
          label,
          updated:
            name +
            " · " +
            (c.time?.match(/T(\d{2}:\d{2})/)?.[1] || "updated now"),
        });
    } catch (e) {
      if (epoch === weatherEpoch.current) setWeather({ message: e.message });
    }
  }
  function getWeather() {
    if (!navigator.geolocation) {
      setWeather({
        message: "Browser location is unavailable. Choose a city instead.",
      });
      return;
    }
    setWeather({ message: "Looking outside…" });
    const epoch = ++weatherEpoch.current;
    navigator.geolocation.getCurrentPosition(
      (p) => {
        if (epoch === weatherEpoch.current)
          loadWeather(
            p.coords.latitude,
            p.coords.longitude,
            "Browser location" +
              (p.coords.accuracy >= 1000
                ? ` (approx. ${Math.ceil(p.coords.accuracy / 1000)} km accuracy)`
                : ""),
          );
      },
      (e) => {
        if (epoch === weatherEpoch.current)
          setWeather({
            message:
              e.code === 1
                ? "Location permission was denied. Choose a city instead."
                : "Could not find your location. Choose a city instead.",
          });
      },
      { timeout: 10000, maximumAge: 60000 },
    );
  }
  function choosePlace() {
    open({
      title: "Weather for a place",
      Fields: T.WeatherPlaceFields,
      submit: async (data) => {
        const u = new URL("https://geocoding-api.open-meteo.com/v1/search");
        u.search = new URLSearchParams({
          name: data.place.trim(),
          count: 5,
          language: "en",
          format: "json",
        });
        const r = await fetch(u, { signal: AbortSignal.timeout(12000) });
        if (!r.ok) throw Error("Place search unavailable.");
        const places = (await r.json()).results || [];
        setDialog((d) => ({
          ...d,
          slots: {
            "weather-matches": places.length
              ? places
                  .filter(
                    (p) =>
                      typeof p.name === "string" &&
                      Number.isFinite(p.latitude) &&
                      Number.isFinite(p.longitude),
                  )
                  .map((p) => {
                    const name = [p.name, p.admin1, p.country]
                      .filter(Boolean)
                      .join(", ");
                    return (
                      <button
                        type="button"
                        className="small block"
                        key={name}
                        onClick={() => {
                          setDialog(null);
                          loadWeather(p.latitude, p.longitude, name);
                        }}
                      >
                        {name}
                      </button>
                    );
                  })
              : "No matching place. Try another spelling.",
          },
        }));
        return false;
      },
    });
  }
  async function loadMusic() {
    setBusy(true);
    try {
      const u = new URL(music.trim());
      const id =
        u.hostname === "youtu.be"
          ? u.pathname.split("/")[1]
          : ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(
                u.hostname,
              )
            ? u.searchParams.get("v")
            : null;
      if (
        !["http:", "https:"].includes(u.protocol) ||
        !/^[\w-]{11}$/.test(id || "")
      )
        throw Error("Use a YouTube watch link or youtu.be link.");
      const data = await request("/api/music-info?videoId=" + id);
      if (
        ["title", "author_name", "thumbnail_url"].some(
          (k) => typeof data[k] !== "string" || !data[k].trim(),
        ) ||
        safeURL(data.thumbnail_url) === "#"
      )
        throw Error("Incomplete video information.");
      await request("/api/me/profile", "PUT", {
        ...profile,
        song: data.title,
        artist: data.author_name,
        musicCover: data.thumbnail_url,
        musicUrl: "https://www.youtube.com/watch?v=" + id,
      });
      await reload();
      setAudio(
        "Music of the Day saved for everyone to see. Use Listen on YouTube to play it.",
      );
    } catch (e) {
      setAudio(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function action(event) {
    const b = event.target.closest("[data-action]");
    if (!b) return;
    const a = b.dataset.action,
      k = b.dataset.key,
      id = b.dataset.id;
    if (a === "month-prev" || a === "month-next") {
      setMonth(
        (d) =>
          new Date(
            d.getFullYear(),
            d.getMonth() + (a === "month-next" ? 1 : -1),
            1,
          ),
      );
      return;
    }
    if (a === "weather" || a === "weather-refresh") {
      const p = weatherPlace.current;
      p ? loadWeather(p.latitude, p.longitude, p.name) : getWeather();
      return;
    }
    if (a === "weather-place") {
      choosePlace();
      return;
    }
    if (a === "pick") {
      const list = choices
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      setPick(
        list.length
          ? "✿ " + list[Math.floor(Math.random() * list.length)]
          : "Add a few choices first.",
      );
      return;
    }
    if (a === "close") {
      setDialog(null);
      return;
    }
    if (!owner) throw Error("Sign in to use your private notebook.");
    if (a === "logout") {
      await request("/api/auth/logout", "POST", {});
      location.reload();
      return;
    }
    if (a === "profile" || a === "interests") {
      editProfile(a === "interests");
      return;
    }
    const keys = {
      "new-post": "posts",
      "new-blog": "blogs",
      "new-task": "tasks",
      "new-document": "documents",
      "new-anime": "anime",
    };
    if (keys[a]) {
      edit(keys[a]);
      return;
    }
    if (a === "edit") {
      edit(k, id);
      return;
    }
    if (a === "day") {
      editDay(b.dataset.date);
      return;
    }
    if (a === "backup") {
      open({
        title: "Keep a spare copy",
        content: <Backup reload={reload} notify={setMessage} />,
      });
      return;
    }
    if (a === "trash") {
      open({
        title: "Recover a page",
        content: <Trash reload={reload} notify={setMessage} />,
      });
      return;
    }
  }
  function editButton(key, id) {
    return owner ? (
      <button className="small" data-action="edit" data-key={key} data-id={id}>
        Edit page
      </button>
    ) : null;
  }
  function entry(r, key, full = false) {
    const body = r.body || "";
    return (
      <article className="paper entry" key={r.id}>
        <span className="date">
          {dateLabel(r.date)}
          {r.category ? " · " + r.category : ""}
        </span>
        <h3>{r.title}</h3>
        <p className={full ? "full-entry" : ""}>
          {full || body.length <= 240 ? body : body.slice(0, 240) + "…"}
        </p>
        <div className="entry-footer">
          <span>{r.tags || "a little piece of life"}</span>
          {editButton(key, r.id)}
        </div>
      </article>
    );
  }
  const slots = {
    clock,
    "home-posts": state.posts.slice(0, 3).map((r) => entry(r, "posts")),
    "pick-result": pick,
    "count-result": `${count.trim().split(/\s+/u).filter(Boolean).length} words · ${Array.from(count).length} characters`,
    "audio-status": audio,
  };
  const controls = {};
  for (const id of ["entry-search", "doc-search", "anime-search"])
    controls[id] = { value: query, onChange: (e) => setQuery(e.target.value) };
  for (const id of ["entry-filter", "anime-filter"])
    controls[id] = {
      value: filter,
      onChange: (e) => setFilter(e.target.value),
    };
  controls["starter-note"] = { hidden: state.posts.length > 0 };
  controls.choices = {
    value: choices,
    onChange: (e) => setChoices(e.target.value),
  };
  controls["count-text"] = {
    value: count,
    onChange: (e) => setCount(e.target.value),
  };
  controls["music-url"] = {
    value: music,
    disabled: !owner,
    onChange: (e) => setMusic(e.target.value),
  };
  controls["music-load"] = { disabled: !owner || busy, onClick: loadMusic };
  controls["music-cover"] = {
    src:
      safeURL(profile.musicCover || "") === "#" || !profile.musicCover
        ? "../assets/images/Philine-P5V6.webp"
        : safeURL(profile.musicCover),
    alt: "Music artwork",
  };
  controls["music-listen"] = {
    hidden: !profile.musicUrl || safeURL(profile.musicUrl) === "#",
    href: safeURL(profile.musicUrl || ""),
  };
  slots.calendar = (
    <>
      <div className="calendar-bar">
        <button
          className="small"
          data-action="month-prev"
          aria-label="Previous month"
        >
          ‹
        </button>
        <strong>
          {month.toLocaleDateString("en-GB", {
            month: "long",
            year: "numeric",
          })}
        </strong>
        <button
          className="small"
          data-action="month-next"
          aria-label="Next month"
        >
          ›
        </button>
      </div>
      <div className="calendar">
        {["S", "M", "T", "W", "T", "F", "S"].map((s, i) => (
          <span className="day-name" key={"h" + i}>
            {s}
          </span>
        ))}
        {Array.from(
          {
            length: new Date(month.getFullYear(), month.getMonth(), 1).getDay(),
          },
          (_, i) => (
            <span key={"b" + i} />
          ),
        )}
        {Array.from(
          {
            length: new Date(
              month.getFullYear(),
              month.getMonth() + 1,
              0,
            ).getDate(),
          },
          (_, i) => {
            const d = localDate(
                new Date(month.getFullYear(), month.getMonth(), i + 1),
              ),
              n = state.events.filter((r) => r.date === d).length;
            return (
              <button
                key={d}
                disabled={!owner}
                data-action="day"
                data-date={d}
                aria-label={dateLabel(d) + (n ? `, ${n} reminders` : "")}
                className={[
                  d === localDate() ? "today" : "",
                  n ? "has-event" : "",
                ].join(" ")}
              >
                {i + 1}
              </button>
            );
          },
        )}
      </div>
      <p className="calendar-note">✿ Click a day to keep a little reminder.</p>
    </>
  );
  if (weather)
    slots.weather = weather.message ? (
      <T.WeatherError values={weather} />
    ) : (
      <T.WeatherResult values={weather} />
    );
  const search = (r) =>
    `${r.title} ${r.body || ""} ${r.tags || ""} ${r.folder || ""}`
      .toLowerCase()
      .includes(query.toLowerCase());
  if (["posts", "blog"].includes(route)) {
    const key = route === "blog" ? "blogs" : "posts",
      list = state[key].filter(
        (r) => search(r) && (!filter || r.category === filter),
      );
    slots.entries = list.length ? (
      list.map((r) => entry(r, key, true))
    ) : state[key].length ? (
      <T.NoResults />
    ) : key === "blogs" ? (
      <T.EmptyBlogs owner={owner} />
    ) : (
      <T.EmptyPosts owner={owner} />
    );
  }
  if (route === "documents") {
    const list = state.documents.filter(search);
    slots.documents = list.length ? (
      list.map((r) => (
        <article className="paper" key={r.id}>
          <span className="tag">{r.folder || "Unsorted"}</span>
          <h3 className="record-heading">{r.title}</h3>
          <p className="help">{r.note}</p>
          <a
            className="button"
            href={safeURL(r.url)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open material ↗
          </a>{" "}
          {editButton("documents", r.id)}
        </article>
      ))
    ) : state.documents.length ? (
      <T.NoResults />
    ) : (
      <T.EmptyDocuments owner={owner} />
    );
  }
  for (const status of ["To do", "In progress", "Done"]) {
    const list = state.tasks.filter((r) => r.status === status);
    slots["task-" + status] = (
      <>
        <h3>
          {status} <small>({list.length})</small>
        </h3>
        {list.map((r) => (
          <article className="paper task" key={r.id}>
            <strong>{r.title}</strong>
            <p>{r.note}</p>
            <small>{r.due ? "Due " + dateLabel(r.due) : ""}</small>
            <label>
              Move to
              <select
                value={r.status}
                onChange={(e) => {
                  const status = e.target.value;
                  run(() => saveRecord("tasks", { ...r, status }, r));
                }}
              >
                {["To do", "In progress", "Done"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            {editButton("tasks", r.id)}
          </article>
        ))}
        {!list.length && <p className="help">A little breathing room.</p>}
      </>
    );
  }
  if (route === "anime") {
    const list = state.anime.filter(
      (r) => search(r) && (!filter || r.status === filter),
    );
    slots["anime-list"] = list.length ? (
      list.map((r) => (
        <article className="paper" key={r.id}>
          <span className="tag">{r.status}</span>
          <h3 className="record-heading">{r.title}</h3>
          <p className="rating" aria-label={`${r.rating || 0} out of 5 hearts`}>
            {"♥".repeat(r.rating || 0) + "♡".repeat(5 - (r.rating || 0))}
          </p>
          <p className="help">{r.episodes || 0} episodes watched</p>
          <details>
            <summary>
              My thoughts{r.spoilers ? " · spoilers inside" : ""}
            </summary>
            <p className="long-text">{r.body}</p>
          </details>
          <div className="entry-footer">
            <small>{r.date}</small>
            {editButton("anime", r.id)}
          </div>
        </article>
      ))
    ) : state.anime.length ? (
      <T.NoResults />
    ) : (
      <T.EmptyAnime owner={owner} />
    );
  }
  slots.timeline = versions.length ? (
    versions.map((v) => (
      <article className="paper" key={v.version}>
        <span className="eyebrow">
          {v.date} · {v.version}
        </span>
        <h3>{v.title}</h3>
        <ul>
          {v.changes.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
        <a href={safeURL("../" + v.notes)}>Read the version notes ↗</a>
      </article>
    ))
  ) : (
    <p>Loading archive…</p>
  );
  const Page =
    V[route[0].toUpperCase() + route.slice(1) + "Page"] || V.IndexPage;
  return (
    <div style={{ display: "contents" }} onClick={(e) => run(() => action(e))}>
      {route === "owner" ? (
        <Owner ready={ready} owner={owner} />
      ) : route === "ultilities" ? (
        <Suspense fallback={<p>Opening the tool…</p>}>
          <Extractor />
        </Suspense>
      ) : (
        <>
          <a className="skip" href="#main">
            Skip to content
          </a>
          <V.Layout
            page={route}
            widgets={route === "index"}
            profile={profile}
            owner={owner}
            controls={controls}
            slots={slots}
          >
            {route === "novels" ? (
              <Suspense
                fallback={
                  <main className="column wide">Opening the library…</main>
                }
              >
                <Library
                  owner={owner}
                  ready={ready}
                  reading={state.reading}
                  refreshToken={notebookRevision}
                  onReading={(id, value) =>
                    setState((s) => ({
                      ...s,
                      reading: { ...s.reading, [id]: value },
                    }))
                  }
                  notify={setMessage}
                  open={open}
                  confirm={confirm}
                />
              </Suspense>
            ) : (
              <Page
                profile={profile}
                owner={owner}
                controls={controls}
                slots={slots}
              />
            )}
          </V.Layout>
        </>
      )}
      <dialog
        ref={dialogRef}
        id="editor"
        aria-label={dialog?.title || "Notebook editor"}
        onCancel={() => setDialog(null)}
      >
        {dialog &&
          (dialog.content || (
            <Editor
              key={dialog.key}
              spec={dialog}
              owner={owner}
              close={() => setDialog(null)}
              notify={setMessage}
              confirm={confirm}
              reload={reload}
            />
          ))}
      </dialog>
      <div
        id="toast"
        role="status"
        style={{ display: message ? "block" : "none" }}
      >
        {message}
      </div>
    </div>
  );
}
function Editor({ spec, owner, close, notify, confirm, reload }) {
  const [busy, setBusy] = useState(false);
  const Fields = spec.Fields;
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (
        (await spec.submit(
          Object.fromEntries(new FormData(e.currentTarget)),
        )) !== false
      )
        close();
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  }
  const old = spec.old,
    key = spec.collection;
  return (
    <form onSubmit={submit}>
      <div className="dialog-head">
        <h2>{spec.title}</h2>
        <button type="button" onClick={close} aria-label="Close dialog">
          ×
        </button>
      </div>
      <Fields
        record={spec.record || {}}
        values={spec.values || {}}
        slots={spec.slots || {}}
        owner={owner}
      />
      <div className="dialog-actions">
        {old && ["posts", "blogs", "anime"].includes(key) && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              confirm(
                "Change publication?",
                "This changes the saved version. Unsaved changes are not included.",
                async () => {
                  await request(
                    `/api/me/records/${key}/${old.id}/${old.publication_state === "published" ? "unpublish" : "publish"}`,
                    "POST",
                    { revision: old.revision },
                  );
                  await reload();
                },
              )
            }
          >
            {old.publication_state === "published"
              ? "Unpublish"
              : "Publish saved version"}
          </button>
        )}
        {old && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              confirm(
                "Move this page to trash?",
                "You can restore it from Trash.",
                async () => {
                  await request(
                    `/api/me/records/${key}/${old.id}/trash`,
                    "POST",
                    { revision: old.revision },
                  );
                  await reload();
                },
              )
            }
          >
            Delete
          </button>
        )}
        <button type="button" onClick={close}>
          Cancel
        </button>
        <button className="primary" type="submit" disabled={busy}>
          {busy
            ? "Saving…"
            : old?.publication_state === "published"
              ? "Save published changes"
              : "Save this page"}
        </button>
      </div>
    </form>
  );
}
function Owner({ ready, owner }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (owner) location.replace("index.html");
  }, [owner]);
  return (
    <main className="owner-entry">
      <section className="paper">
        <h1>My corner</h1>
        <p id="owner-status" role="status">
          {error ||
            (!ready
              ? "Checking this browser…"
              : "Use your owner login. This browser will remember your session.")}
        </p>
        <form
          id="owner-login"
          hidden={!ready}
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await request(
                "/api/auth/login",
                "POST",
                Object.fromEntries(new FormData(e.currentTarget)),
              );
              location.replace("index.html");
            } catch (e) {
              setError(e.message);
              setBusy(false);
            }
          }}
        >
          <label>
            Owner login
            <input
              name="login"
              autoComplete="username"
              required
              maxLength={64}
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={1024}
            />
          </label>
          <button type="submit" className="primary" disabled={busy}>
            Open my notebook
          </button>
        </form>
        <p>
          <a href="index.html">Return to the picture book</a>
        </p>
      </section>
    </main>
  );
}
function Backup({ reload, notify }) {
  const [source, setSource] = useState("legacy-browser"),
    [preview, setPreview] = useState(null),
    [busy, setBusy] = useState(false);
  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section>
      <div className="dialog-head">
        <h2>Keep a spare copy</h2>
        <button data-action="close" aria-label="Close dialog">
          ×
        </button>
      </div>
      <p>
        Download a private backup of active records, settings and original
        books. Trash is excluded.
      </p>
      <button
        disabled={busy}
        className="primary"
        onClick={() =>
          run(async () =>
            download(
              `philine-picturebook-${localDate()}.json`,
              JSON.stringify(await request("/api/me/export"), null, 2),
            ),
          )
        }
      >
        Download a backup
      </button>
      <hr />
      <h3>Pages for the wider world</h3>
      <button
        disabled={busy}
        onClick={() =>
          run(async () => {
            const { profile, posts, blogs, anime } = await request(
              "/api/public/notebook",
            );
            download(
              "site-content.js",
              "window.PICTUREBOOK_PUBLIC = " +
                JSON.stringify(
                  { profile, posts, blogs, anime },
                  null,
                  2,
                ).replace(/</g, "\\u003c") +
                ";\n",
              "text/javascript",
            );
          })
        }
      >
        Export public pages
      </button>
      <hr />
      <h3>Move your old notebook</h3>
      <button disabled={busy} onClick={() => run(legacyExport)}>
        Export old browser data
      </button>
      <label>
        Import source name
        <input
          value={source}
          onChange={(e) => {
            setSource(e.target.value);
            setPreview(null);
          }}
          maxLength={80}
        />
      </label>
      <label>
        Preview a Picture Book backup
        <input
          type="file"
          accept=".json,application/json"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files[0];
            setPreview(null);
            if (file)
              run(async () => {
                if (file.size > 60 * 1024 * 1024)
                  throw Error("Backup exceeds the 60 MiB upload limit.");
                const backup = JSON.parse(await file.text()),
                  result = await request("/api/me/import/preview", "POST", {
                    source: source.trim(),
                    backup,
                  });
                setPreview({ backup, result });
              });
          }}
        />
      </label>
      <p className="help">
        Import initializes an empty, unedited notebook. It never replaces
        existing records. Limit: 60 MiB.
      </p>
      {preview && (
        <>
          <p>
            {Object.entries(preview.result.counts)
              .map(([k, v]) => `${v} ${k}`)
              .join(", ")}
            . {preview.result.message}
          </p>
          <button
            disabled={busy}
            className="primary"
            onClick={() =>
              run(async () => {
                await request("/api/me/import/commit", "POST", {
                  backup: preview.backup,
                  token: preview.result.token,
                });
                await reload();
                setPreview(null);
                notify("Your picture book is saved on the server.");
              })
            }
          >
            Import this preview
          </button>
        </>
      )}
    </section>
  );
}
function Trash({ reload, notify }) {
  const [key, setKey] = useState("posts"),
    [offset, setOffset] = useState(0),
    [records, setRecords] = useState([]),
    [version, setVersion] = useState(0),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    request(`/api/me/records/${key}?trash=true&limit=100&offset=${offset}`)
      .then((r) => {
        if (live) setRecords(r);
      })
      .catch((e) => {
        if (live) notify(e.message);
      });
    return () => {
      live = false;
    };
  }, [key, offset, version]);
  return (
    <section>
      <div className="dialog-head">
        <h2>Recover a page</h2>
        <button data-action="close" aria-label="Close dialog">
          ×
        </button>
      </div>
      <label>
        Section
        <select
          value={key}
          onChange={(e) => {
            setKey(e.target.value);
            setOffset(0);
          }}
        >
          {[
            "posts",
            "blogs",
            "tasks",
            "documents",
            "anime",
            "events",
            "books",
          ].map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
      </label>
      <div aria-live="polite">
        {records.length
          ? records.map((r) => (
              <p key={r.id}>
                {r.title}{" "}
                <button
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await request(
                        `/api/me/records/${key}/${r.id}/restore`,
                        "POST",
                        { revision: r.revision },
                      );
                      await reload();
                      setVersion((v) => v + 1);
                    } catch (e) {
                      notify(e.message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Restore
                </button>
              </p>
            ))
          : "No deleted records in this section."}
      </div>
      <p className="help">Restoring a published page makes it public again.</p>
      <button
        disabled={!offset || busy}
        onClick={() => setOffset((o) => o - 100)}
      >
        Previous
      </button>
      <button
        disabled={records.length < 100 || busy}
        onClick={() => setOffset((o) => o + 100)}
      >
        Next
      </button>
    </section>
  );
}
