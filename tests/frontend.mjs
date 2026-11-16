import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { createServer } from "vite";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { JSDOM } from "jsdom";
const vite = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
});
try {
  const views = await vite.ssrLoadModule("/frontend/views.jsx"),
    templates = await vite.ssrLoadModule("/frontend/templates.jsx");
  for (const [name, View] of Object.entries(views)) {
    const document = new JSDOM(renderToStaticMarkup(React.createElement(View)))
      .window.document;
    assert.ok(
      document.querySelector(
        name === "Layout"
          ? ".site-wrap"
          : name === "Masthead"
            ? ".masthead"
            : "main",
      ),
      name,
    );
    for (const control of document.querySelectorAll("[data-owner-only]"))
      assert.ok(control.hidden, `${name}: private control hidden`);
  }
  const escaped = renderToStaticMarkup(
    React.createElement(templates.EntryTemplate, {
      values: { title: "<script>alert(1)</script>", body: "世界 ♡" },
    }),
  );
  assert.ok(escaped.includes("&lt;script&gt;"));
  assert.ok(escaped.includes("世界 ♡"));
  for (const name of [
    "PostFields",
    "BlogFields",
    "AnimeFields",
    "ProfileFields",
    "TaskFields",
    "DocumentFields",
  ]) {
    const doc = new JSDOM(
      renderToStaticMarkup(
        React.createElement(templates[name], {
          record: { title: "Preserved draft" },
        }),
      ),
    ).window.document;
    if (doc.querySelector('[name="title"]'))
      assert.equal(
        doc.querySelector('[name="title"]').value,
        "Preserved draft",
      );
  }
  const history = JSON.parse(await readFile("data/changelog.json", "utf8"));
  for (const h of history) {
    await access(h.notes);
    assert.ok(h.changes.length);
  }
  for (const name of [
    "index",
    "owner",
    "posts",
    "blog",
    "documents",
    "work",
    "utilities",
    "ultilities",
    "anime",
    "novels",
    "archive",
  ]) {
    const html = await readFile(`dist/pages/${name}.html`, "utf8");
    assert.match(html, /id="root"/);
    assert.doesNotMatch(html, /picturebook\.js|owner\.js|ai2d\.js/);
  }
  await assert.rejects(() => access("dist/.env"));
  await assert.rejects(() => access("dist/server/auth.mjs"));
  console.log(
    "React page rendering, owner visibility, escaped content, form defaults, archive links and build isolation passed.",
  );
} finally {
  await vite.close();
}
