import React, { useState, useEffect, useRef } from "react";
import { NovelsPage } from "./views.jsx";
import { EmptyBooks, BookFolderFields, FolderFields } from "./templates.jsx";
import Reader from "./Reader.jsx";
import { request } from "./api.js";
import { loadBookCover } from "../assets/js/novel-formats.mjs";

export default function Library({
  owner,
  ready,
  refreshToken,
  reading,
  onReading,
  notify,
  open,
  confirm,
}) {
  const [books, setBooks] = useState([]),
    [folders, setFolders] = useState([]),
    [folder, setFolder] = useState(""),
    [query, setQuery] = useState(""),
    [active, setActive] = useState(null),
    [status, setStatus] = useState("Choose a series folder before importing."),
    [uploading, setUploading] = useState(false),
    [preview, setPreview] = useState(null);
  const reader = useRef(null),
    epoch = useRef(0),
    timer = useRef(null),
    previewURL = useRef(null),
    live = useRef(true);
  async function load() {
    if (!owner) return;
    const fs = await request("/api/me/folders"),
      all = [];
    for (let offset = 0; ; offset += 500) {
      const batch = await request(
        `/api/me/records/books?limit=500&offset=${offset}`,
      );
      all.push(...batch);
      if (batch.length < 500) break;
    }
    if (live.current) {
      setFolders(fs);
      setFolder((previous) =>
        !previous || previous === "unfiled" || fs.some((f) => f.id === previous)
          ? previous
          : "",
      );
      setBooks(
        all.sort((a, b) =>
          a.title.localeCompare(b.title, undefined, { numeric: true }),
        ),
      );
    }
  }
  useEffect(() => {
    live.current = true;
    if (owner) load().catch((e) => notify(e.message));
    else {
      setBooks([]);
      setFolders([]);
      setActive(null);
    }
    return () => {
      live.current = false;
      hidePreview();
    };
  }, [owner, refreshToken]);
  function hidePreview() {
    epoch.current++;
    clearTimeout(timer.current);
    if (previewURL.current) URL.revokeObjectURL(previewURL.current);
    previewURL.current = null;
    setPreview(null);
  }
  function showPreview(book, event) {
    hidePreview();
    if (!["pdf", "epub"].includes(book.format)) return;
    const token = epoch.current,
      rect = event.currentTarget.getBoundingClientRect();
    timer.current = setTimeout(async () => {
      if (!live.current || token !== epoch.current) return;
      setPreview({
        book,
        left: Math.max(8, Math.min(window.innerWidth - 238, rect.right + 12)),
        top: Math.max(8, Math.min(window.innerHeight - 390, rect.top)),
        message: "Loading cover…",
      });
      try {
        const blob = await loadBookCover(book);
        if (!live.current || token !== epoch.current) return;
        const url = blob ? URL.createObjectURL(blob) : null;
        previewURL.current = url;
        setPreview((p) => ({
          ...p,
          url,
          message: blob ? "" : "No embedded cover available.",
        }));
      } catch {
        if (token === epoch.current)
          setPreview((p) => ({ ...p, message: "Cover preview unavailable." }));
      }
    }, 200);
  }
  const run = (fn) =>
    Promise.resolve()
      .then(fn)
      .catch((e) => notify(e.message));
  async function choose(book) {
    hidePreview();
    await reader.current?.close();
    setActive({ ...book, sessionKey: crypto.randomUUID() });
  }
  function options() {
    return (
      <>
        <option value="">Unfiled books</option>
        {folders.map((f) => (
          <option key={f.id} value={f.id}>
            {f.title}
          </option>
        ))}
      </>
    );
  }
  function editBook() {
    const b = books.find((b) => b.id === active?.id) || active;
    if (!b) return;
    open({
      title: "Organize this volume",
      Fields: ({ record }) => (
        <BookFolderFields
          record={record}
          controls={{
            "book-folder-choice": { defaultValue: b.folderId || "" },
          }}
          slots={{ "book-folder-choice": options() }}
        />
      ),
      record: b,
      submit: async (data) => {
        const updated = await request("/api/me/records/books/" + b.id, "PUT", {
          ...b,
          ...data,
          folderId: data.folderId || null,
        });
        await load();
        setActive((previous) => ({
          ...updated,
          sessionKey: previous?.sessionKey,
        }));
      },
    });
  }
  function editFolder(rename) {
    const f = rename ? folders.find((f) => f.id === folder) : null;
    if (rename && !f) return;
    open({
      title: rename ? "Rename series folder" : "A folder for your series",
      Fields: FolderFields,
      record: f || {},
      submit: async (data) => {
        const result = await request(
          "/api/me/folders" + (f ? "/" + f.id : ""),
          f ? "PUT" : "POST",
          { ...data, ...(f ? { revision: f.revision } : {}) },
        );
        await load();
        setFolder(result.id);
      },
    });
  }
  async function upload(event) {
    const input = event.target,
      files = Array.from(input.files || []).filter((f) =>
        /\.(txt|md|pdf|epub)$/i.test(f.name),
      );
    if (uploading) return;
    if (!files.length) {
      notify("Choose PDF, EPUB, TXT, or Markdown files.");
      return;
    }
    setUploading(true);
    let count = 0;
    const currentFolders = [...folders];
    try {
      for (const file of files) {
        const format = file.name.split(".").pop().toLowerCase(),
          binary = ["pdf", "epub"].includes(format);
        if (!file.size || file.size > (binary ? 50 : 10) * 1024 * 1024)
          throw Error(
            `${file.name}: choose a nonempty file up to ${binary ? 50 : 10} MiB.`,
          );
        setStatus(`Uploading ${count + 1} of ${files.length}: ${file.name}`);
        const sourcePath = file.webkitRelativePath || file.name,
          directory = sourcePath.split("/").slice(0, -1).join(" / ");
        let folderId = folders.find((f) => f.id === folder)?.id || null;
        if (!folderId && folder !== "unfiled" && directory) {
          let f = currentFolders.find((f) => f.title === directory);
          if (!f) {
            f = await request("/api/me/folders", "POST", { title: directory });
            currentFolders.push(f);
          }
          folderId = f.id;
        }
        const data = {
          title: file.name.replace(/\.(txt|md|pdf|epub)$/i, ""),
          format,
          sourcePath,
          folderId,
        };
        if (binary) {
          const res = await fetch(
            "/api/me/books/upload?" +
              new URLSearchParams({ ...data, folderId: folderId || "" }),
            {
              method: "POST",
              credentials: "same-origin",
              headers: {
                "Content-Type":
                  format === "pdf" ? "application/pdf" : "application/epub+zip",
              },
              body: file,
            },
          );
          const result = await res.json();
          if (!res.ok) {
            if (res.status === 401)
              window.dispatchEvent(new Event("session-expired"));
            throw Error(result.error || "Upload failed.");
          }
        } else
          await request("/api/me/records/books", "POST", {
            ...data,
            text: await file.text(),
          });
        count++;
      }
      setStatus(`${count} volumes saved to your private library.`);
    } catch (e) {
      setStatus(
        `${count} books saved. ${e.message} Remaining files were not uploaded.`,
      );
    } finally {
      input.value = "";
      setUploading(false);
      await load().catch((e) => notify(e.message));
    }
  }
  async function remove() {
    const b = books.find((b) => b.id === active?.id);
    if (!b) return;
    confirm(
      "Take this book off the shelf?",
      "The server copy moves to trash. Your original file stays in its folder.",
      async () => {
        await reader.current?.close();
        await request(`/api/me/records/books/${b.id}/trash`, "POST", {
          revision: b.revision,
        });
        setActive(null);
        await load();
      },
    );
  }
  const records = books.filter(
      (b) =>
        b.title.toLowerCase().includes(query.toLowerCase()) &&
        (!folder ||
          (folder === "unfiled" ? !b.folderId : b.folderId === folder)),
    ),
    selected = folders.find((f) => f.id === folder);
  const slots = {
    "library-status": status,
    "library-folder": (
      <>
        <option value="">All books</option>
        <option value="unfiled">Unfiled books</option>
        {folders.map((f) => (
          <option key={f.id} value={f.id}>
            {f.title}
          </option>
        ))}
      </>
    ),
    "book-list": !owner ? (
      <p className="help">Sign in to open your private library.</p>
    ) : records.length ? (
      records.map((b) => (
        <div
          className="book-shelf-item"
          key={b.id}
          onMouseEnter={(e) => showPreview(b, e)}
          onMouseLeave={hidePreview}
          onFocus={(e) => showPreview(b, e)}
          onBlur={hidePreview}
          onKeyDown={(e) => {
            if (e.key === "Escape") hidePreview();
          }}
        >
          <button className="book-button" onClick={() => run(() => choose(b))}>
            <span>
              ♧ {b.title} · {b.format.toUpperCase()}
            </span>
            <small className="block">
              {folders.find((f) => f.id === b.folderId)?.title || "Unfiled"} ·{" "}
              {reading[b.id]
                ? Math.round(reading[b.id].progress || 0) + "% read"
                : "A fresh page"}
            </small>
          </button>
        </div>
      ))
    ) : ready ? (
      <EmptyBooks />
    ) : (
      "Opening the shelf…"
    ),
    reader:
      active && owner ? (
        <Reader
          key={active.sessionKey}
          book={active}
          saved={reading[active.id]}
          controller={reader}
          onReading={onReading}
          notify={notify}
          edit={editBook}
          remove={remove}
        />
      ) : (
        <div className="empty">
          <span className="symbol">♧</span>
          <h3>Just one more chapter</h3>
          <p>Import your stories, then choose a book from the shelf.</p>
        </div>
      ),
  };
  const controls = {
    "book-search": { value: query, onChange: (e) => setQuery(e.target.value) },
    "library-folder": {
      value: folder,
      onChange: (e) => setFolder(e.target.value),
    },
    "novel-folder": { onChange: upload, disabled: !owner || uploading },
    "novel-files": { onChange: upload, disabled: !owner || uploading },
    "rename-folder": { disabled: !selected },
    "remove-folder": { disabled: !selected },
  };
  return (
    <div
      style={{ display: "contents" }}
      onClick={(e) => {
        const a = e.target.closest("[data-action]")?.dataset.action;
        if (!a) return;
        if (["new-folder", "rename-folder", "remove-folder"].includes(a)) {
          e.stopPropagation();
          if (!owner) return;
          if (a === "remove-folder" && selected)
            confirm(
              "Remove this series folder?",
              "Books move to Unfiled. No books or bookmarks are deleted.",
              async () => {
                await request(`/api/me/folders/${selected.id}/remove`, "POST", {
                  revision: selected.revision,
                });
                setFolder("unfiled");
                await load();
              },
            );
          else editFolder(a === "rename-folder");
        }
      }}
    >
      <NovelsPage owner={owner} slots={slots} controls={controls} />
      {preview && (
        <aside
          className="book-cover-preview"
          role="tooltip"
          style={{ left: preview.left, top: preview.top }}
        >
          <strong>{preview.book.title}</strong>
          {preview.url && (
            <img src={preview.url} alt={"Cover of " + preview.book.title} />
          )}
          <span className="help">{preview.message}</span>
        </aside>
      )}
    </div>
  );
}
