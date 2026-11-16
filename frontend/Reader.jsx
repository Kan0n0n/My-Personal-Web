import React, { memo, useEffect, useRef, useState } from "react";
import { ReaderTemplate } from "./templates.jsx";
import { request } from "./api.js";
import { openFormatReader } from "../assets/js/novel-formats.mjs";
import {
  captureAnchor,
  restoreAnchor,
  createReadingSession,
} from "../assets/js/reading-position.mjs";
import { createSpeechReader } from "../assets/js/reader-speech.mjs";

const fonts = {
  georgia: "Georgia, serif",
  overlock: "Overlock, sans-serif",
  palatino: "Palatino Linotype, Book Antiqua, serif",
  arial: "Arial, sans-serif",
  verdana: "Verdana, sans-serif",
  monospace: "Consolas, monospace",
};
export default memo(function Reader({
  book,
  saved = {},
  onReading,
  notify,
  edit,
  remove,
  controller,
}) {
  const root = useRef(null),
    initial = useRef(saved),
    callbacks = useRef({ onReading, notify }),
    [error, setError] = useState("");
  callbacks.current = { onReading, notify };
  useEffect(() => {
    let alive = true,
      format,
      speech,
      session,
      heartbeat;
    const element = root.current.parentElement,
      $ = (s) => element.querySelector(s),
      text = $(".reader-text"),
      position = { ...initial.current };
    const status = (message) => {
      if (alive) $("#autosave-status").textContent = message;
    };
    const flush = () => session?.flush(),
      schedule = () => session?.schedule(),
      hidden = () => {
        if (document.visibilityState === "hidden") flush();
      };
    const before = () => flush(),
      after = () => schedule();
    const stop = () => {
      speech?.destroy();
      format?.destroy();
      clearInterval(heartbeat);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", hidden);
      element.removeEventListener("reader-before-page-change", before);
      element.removeEventListener("reader-page-change", after);
    };
    async function initialize() {
      try {
        text.style.fontSize = (Number(position.font) || 18) + "px";
        text.style.fontFamily = fonts[position.fontFamily] || fonts.georgia;
        text.style.textAlign = position.alignment || "left";
        element.classList.toggle("dark", position.theme === "dark");
        $("#reader-font").value = position.fontFamily || "georgia";
        $("#reader-alignment").value = position.alignment || "left";
        $("#reader-font").disabled = $("#reader-alignment").disabled =
          book.format === "pdf";
        if (["pdf", "epub"].includes(book.format)) {
          const link = $("#book-download");
          link.hidden = false;
          link.href = `/api/me/books/${book.id}/file`;
          link.download = book.title + "." + book.format;
          format = await openFormatReader({
            book,
            container: text,
            root: element,
            saved: position,
            isCurrent: () => alive,
          });
        } else {
          const data = await request(`/api/me/books/${book.id}/content`);
          if (!alive) return;
          text.textContent = data.text;
        }
        if (!alive) {
          format?.destroy();
          return;
        }
        if (position.anchor && Object.keys(position.anchor).length)
          await restoreAnchor(text, position.anchor);
        else if (!format && position.progress)
          window.scrollTo(
            0,
            window.scrollY +
              text.getBoundingClientRect().top +
              (Math.max(0, text.offsetHeight - window.innerHeight) *
                position.progress) /
                100,
          );
        if (!alive) return;
        session = createReadingSession({
          capture: () => {
            if (!alive) return null;
            const top = window.scrollY + text.getBoundingClientRect().top;
            return {
              ...(format
                ? format.position()
                : {
                    progress: Math.min(
                      100,
                      Math.max(
                        0,
                        ((window.scrollY - top) /
                          Math.max(1, text.offsetHeight - window.innerHeight)) *
                          100,
                      ),
                    ),
                  }),
              font: parseInt(text.style.fontSize),
              theme: element.classList.contains("dark") ? "dark" : "light",
              fontFamily: $("#reader-font").value,
              alignment: $("#reader-alignment").value,
              speech: speech?.preferences() || position.speech || {},
              anchor: speech?.anchor() || captureAnchor(text),
            };
          },
          revision: () => position.revision,
          write: async (data) => {
            const result = await request(
              `/api/me/books/${book.id}/progress`,
              "PUT",
              data,
              { keepalive: true },
            );
            Object.assign(position, result);
            callbacks.current.onReading(book.id, result);
          },
          status,
        });
        controller.current = {
          flush: () => session.flush(),
          close: () => session.close(),
        };
        speech = createSpeechReader({
          root: element,
          container: text,
          kind: book.format,
          preferences: position.speech,
          getOffset: () => captureAnchor(text).offset || 0,
          nextPage: async () => {
            await session.flush();
            return alive && format ? format.advance() : false;
          },
          onPosition: schedule,
          flush,
          onPreferences: schedule,
          isCurrent: () => alive,
        });
        heartbeat = setInterval(flush, 15000);
        window.addEventListener("scroll", schedule, { passive: true });
        window.addEventListener("pagehide", flush);
        document.addEventListener("visibilitychange", hidden);
        element.addEventListener("reader-before-page-change", before);
        element.addEventListener("reader-page-change", after);
        for (const [id, property, values] of [
          ["reader-font", "fontFamily", fonts],
          ["reader-alignment", "textAlign", null],
        ])
          $("#" + id).onchange = async (e) => {
            const anchor = captureAnchor(text);
            text.style[property] = values
              ? values[e.target.value]
              : e.target.value;
            await restoreAnchor(text, anchor);
            if (alive) schedule();
          };
      } catch (e) {
        if (alive) {
          setError(e.message);
          status(
            "Position not saved. Open the book successfully before saving.",
          );
        }
      }
    }
    const click = async (e) => {
      const action = e.target.closest("[data-action]")?.dataset.action;
      if (
        !action ||
        !["bookmark", "font-up", "font-down", "reader-theme"].includes(action)
      )
        return;
      e.stopPropagation();
      try {
        if (!session) throw Error("Wait for the book to finish opening.");
        if (action === "bookmark") {
          await session.saveNow();
          callbacks.current.notify("Your place is saved.");
        } else if (action === "reader-theme") {
          element.classList.toggle("dark");
          schedule();
        } else {
          if (book.format === "pdf")
            speech?.stop("Zoom changed. Press Read aloud to continue.");
          const anchor = captureAnchor(text);
          text.style.fontSize =
            Math.min(
              30,
              Math.max(
                14,
                parseInt(text.style.fontSize) + (action === "font-up" ? 2 : -2),
              ),
            ) + "px";
          await format?.resize?.();
          await restoreAnchor(text, anchor);
          schedule();
        }
      } catch (e) {
        callbacks.current.notify(e.message);
      }
    };
    element.addEventListener("click", click);
    initialize();
    return () => {
      session?.close();
      alive = false;
      controller.current = null;
      stop();
      element.removeEventListener("click", click);
    };
  }, [book.id]);
  return (
    <div ref={root}>
      {error && <p role="alert">Could not open this book. {error}</p>}
      <ReaderTemplate
        owner
        values={{ title: book.title, text: "Opening your book…" }}
        controls={{ editBook: edit, removeBook: remove }}
      />
    </div>
  );
});
