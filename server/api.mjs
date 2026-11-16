import express from "express";
import { session, login, logout, cookie, createLoginLimiter } from "./auth.mjs";
import { HttpError, fail, plain, descriptor } from "./model.mjs";
import * as store from "./store.mjs";
import { importService } from "./import.mjs";
import { transaction } from "./db.mjs";
import { MAX_BOOK_BYTES } from "./book-files.mjs";

export function json(res, status, data, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  res.end(JSON.stringify(data));
}
export async function readBody(req, max) {
  if (Number(req.headers["content-length"]) > max)
    fail("Request is too large.", 413);
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > max) fail("Request is too large.", 413);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
export async function readJSON(req, max = 2 * 1024 * 1024) {
  if (
    (req.headers["content-type"] ?? "")
      .split(";", 1)[0]
      .trim()
      .toLowerCase() !== "application/json"
  )
    fail("Use application/json.", 415);
  const bytes = await readBody(req, max);
  try {
    const value = JSON.parse(bytes.toString("utf8"));
    if (!plain(value)) fail("Expected a JSON object.");
    return value;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    fail("Invalid JSON.");
  }
}
export async function music(req, res, url, fetcher = fetch) {
  if (req.method !== "GET")
    return json(res, 405, { error: "Use a GET request." }, { Allow: "GET" });
  const videoId = url.searchParams.get("videoId");
  if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId))
    return json(res, 400, { error: "A valid YouTube video ID is required." });
  const endpoint = new URL("https://www.youtube.com/oembed");
  endpoint.searchParams.set(
    "url",
    `https://www.youtube.com/watch?v=${videoId}`,
  );
  endpoint.searchParams.set("format", "json");
  try {
    const response = await fetcher(endpoint, {
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw Error("Unavailable");
    const data = await response.json();
    if (
      ["title", "author_name", "thumbnail_url"].some(
        (k) => typeof data[k] !== "string" || !data[k],
      )
    )
      throw Error("Invalid metadata");
    return json(res, 200, {
      title: data.title,
      author_name: data.author_name,
      thumbnail_url: data.thumbnail_url,
    });
  } catch {
    return json(res, 502, {
      error: "Could not retrieve video information. Try another link.",
    });
  }
}
export function createAPI(pool, config) {
  const router = express.Router(),
    imports = importService(pool, config.importSecret),
    limitLogin = createLoginLimiter(),
    secure = new URL(config.origin).protocol === "https:";
  const url = (req) => new URL(req.url, "http://localhost");
  router.use(async (req, res, next) => {
    if (!["GET", "POST", "PUT"].includes(req.method))
      fail("Method not allowed.", 405);
    if (req.method !== "GET") {
      if (req.headers.origin !== config.origin)
        fail("This request must come from the configured site origin.", 403);
      if (req.headers["sec-fetch-site"] === "cross-site")
        fail("Cross-site request rejected.", 403);
    }
    next();
  });
  router.all("/api/music-info", (req, res) => music(req, res, url(req)));
  router.post("/api/auth/login", async (req, res) => {
    limitLogin(req.socket.remoteAddress);
    const b = await readJSON(req, 4096),
      token = await login(pool, b.login, b.password, config.sessionDays);
    json(
      res,
      200,
      { ok: true },
      { "Set-Cookie": cookie(token, secure, config.sessionDays * 86400) },
    );
  });
  router.use(async (req, res, next) => {
    req.owner = await session(pool, req);
    next();
  });
  router.get("/api/auth/session", (req, res) =>
    json(res, 200, {
      authenticated: !!req.owner,
      login: req.owner?.login_name ?? null,
    }),
  );
  router.post("/api/auth/logout", async (req, res) => {
    await logout(pool, req);
    json(res, 200, { ok: true }, { "Set-Cookie": cookie("", secure, 0) });
  });
  router.get("/api/public/notebook", async (req, res) => {
    const owner = (
      await pool.query(
        "SELECT id FROM accounts WHERE login_name=$1 AND disabled_at IS NULL",
        [config.ownerLogin],
      )
    ).rows[0];
    json(res, 200, await store.notebook(pool, owner?.id, true));
  });
  router.use("/api/me", async (req, res, next) => {
    if (!req.owner) fail("Sign in to use your private notebook.", 401);
    next();
  });
  router.post("/api/me/books/upload", async (req, res) => {
    if (
      !["application/pdf", "application/epub+zip"].includes(
        req.headers["content-type"],
      )
    )
      fail("Upload a PDF or EPUB file.");
    const bytes = await readBody(req, MAX_BOOK_BYTES),
      params = url(req).searchParams,
      format = params.get("format");
    if (
      req.headers["content-type"] !==
      (format === "pdf" ? "application/pdf" : "application/epub+zip")
    )
      fail("File type does not match its format.");
    json(
      res,
      201,
      await store.uploadBook(
        pool,
        req.owner.id,
        {
          title: params.get("title"),
          format,
          sourcePath: params.get("sourcePath") ?? "",
          folderId: params.get("folderId") || null,
        },
        bytes,
      ),
    );
  });
  router.get("/api/me/folders", async (req, res) =>
    json(res, 200, await store.folders(pool, req.owner.id)),
  );
  router.post("/api/me/folders", async (req, res) =>
    json(
      res,
      201,
      await store.saveFolder(pool, req.owner.id, null, await readJSON(req)),
    ),
  );
  router.put("/api/me/folders/:id", async (req, res) =>
    json(
      res,
      200,
      await store.saveFolder(
        pool,
        req.owner.id,
        req.params.id,
        await readJSON(req),
      ),
    ),
  );
  router.post("/api/me/folders/:id/remove", async (req, res) =>
    json(
      res,
      200,
      await store.removeFolder(
        pool,
        req.owner.id,
        req.params.id,
        await readJSON(req),
      ),
    ),
  );
  router.get("/api/me/notebook", async (req, res) =>
    json(
      res,
      200,
      await transaction(pool, async (c) => {
        await c.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
        return store.notebook(c, req.owner.id);
      }),
    ),
  );
  router.put("/api/me/profile", async (req, res) =>
    json(
      res,
      200,
      await store.updateProfile(pool, req.owner.id, await readJSON(req)),
    ),
  );
  router.get("/api/me/export", async (req, res) =>
    json(res, 200, await store.exportBackup(pool, req.owner.id)),
  );
  router.post("/api/me/import/preview", async (req, res) => {
    const b = await readJSON(req, 64 * 1024 * 1024);
    json(res, 200, imports.preview(req.owner.id, b.source, b.backup));
  });
  router.post("/api/me/import/commit", async (req, res) => {
    const b = await readJSON(req, 64 * 1024 * 1024);
    json(res, 200, await imports.commit(req.owner.id, b.backup, b.token));
  });
  router.get("/api/me/books/:id/content", async (req, res) =>
    json(res, 200, await store.content(pool, req.owner.id, req.params.id)),
  );
  router.put("/api/me/books/:id/progress", async (req, res) =>
    json(
      res,
      200,
      await store.progress(
        pool,
        req.owner.id,
        req.params.id,
        await readJSON(req),
      ),
    ),
  );
  router.get("/api/me/books/:id/file", async (req, res) => {
    const file = await store.bookFile(pool, req.owner.id, req.params.id);
    res.writeHead(200, {
      "Content-Type":
        file.format === "pdf" ? "application/pdf" : "application/epub+zip",
      "Content-Length": file.bytes.length,
      "Content-Disposition": 'attachment; filename="book.' + file.format + '"',
      "Cache-Control": "no-store",
      "Content-Security-Policy": "sandbox; default-src 'none'",
    });
    res.end(file.bytes);
  });
  router.get("/api/me/records/:key", async (req, res) => {
    const params = url(req).searchParams,
      limit = Number(params.get("limit") ?? 500),
      offset = Number(params.get("offset") ?? 0);
    descriptor(req.params.key);
    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 500 ||
      !Number.isInteger(offset) ||
      offset < 0
    )
      fail("Invalid pagination.");
    json(
      res,
      200,
      await store.list(pool, req.owner.id, req.params.key, {
        trash: params.get("trash") === "true",
        limit,
        offset,
      }),
    );
  });
  router.post("/api/me/records/:key", async (req, res) =>
    json(
      res,
      201,
      await store.createRecord(
        pool,
        req.owner.id,
        req.params.key,
        await readJSON(
          req,
          req.params.key === "books" ? 12 * 1024 * 1024 : 2 * 1024 * 1024,
        ),
      ),
    ),
  );
  router.put("/api/me/records/:key/:id", async (req, res) =>
    json(
      res,
      200,
      await store.updateRecord(
        pool,
        req.owner.id,
        req.params.key,
        req.params.id,
        await readJSON(req),
      ),
    ),
  );
  router.post("/api/me/records/:key/:id/:action", async (req, res) =>
    json(
      res,
      200,
      await store.recordAction(
        pool,
        req.owner.id,
        req.params.key,
        req.params.id,
        req.params.action,
        await readJSON(req),
      ),
    ),
  );
  for (const route of [
    "/api/me/folders",
    "/api/me/folders/:id",
    "/api/me/folders/:id/remove",
    "/api/me/books/:id/content",
    "/api/me/books/:id/file",
    "/api/me/books/:id/progress",
    "/api/me/records/:key",
    "/api/me/records/:key/:id",
    "/api/me/records/:key/:id/:action",
  ])
    router.all(route, async () => fail("Method not allowed.", 405));
  router.use((req, res) => json(res, 404, { error: "API route not found." }));
  router.use((error, req, res, next) => {
    if (error instanceof HttpError)
      return json(res, error.status, { error: error.message });
    if (
      ["23505", "23503", "23514", "22007", "22008", "22P02"].includes(
        error.code,
      )
    )
      return json(res, 409, {
        error:
          "The record violates a data constraint. Reload and review your input.",
      });
    console.error("Database/API operation failed.", error.code ?? error.name);
    json(res, 503, {
      error:
        "The database is unavailable or the request could not be completed. No save was confirmed.",
    });
  });
  return router;
}
