import express from "express";
import http from "node:http";
import { readFile, stat, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { database } from "../server/db.mjs";
import { createAPI } from "../server/api.mjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const pageNames = new Set([
  "index",
  "posts",
  "blog",
  "documents",
  "work",
  "utilities",
  "ultilities",
  "anime",
  "novels",
  "archive",
]);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export function createHandler(
  api,
  { publicRoot = path.join(root, "dist"), vite = null } = {},
) {
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });
  app.use((req, res, next) =>
    req.url.startsWith("/api/") ? api(req, res, next) : next(),
  );
  if (vite)
    app.use((req, res, next) => {
      const pathname = new URL(req.url, "http://localhost").pathname;
      if (pathname.startsWith("/assets/vendor/")) return next();
      if (
        /^\/(frontend|assets|pages|node_modules)\//.test(pathname) ||
        pathname.startsWith("/@")
      )
        return vite.middlewares(req, res, next);
      next();
    });
  app.use(async function handleRequest(req, res) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    try {
      const url = new URL(req.url, "http://localhost"),
        requested = decodeURIComponent(url.pathname);

      if (!["GET", "HEAD"].includes(req.method)) {
        res.writeHead(405, { Allow: "GET, HEAD" });
        res.end();
        return;
      }
      const oldPage = requested.match(/^\/([a-z]+)\.html$/)?.[1];
      if (requested === "/" || (oldPage && pageNames.has(oldPage))) {
        res.writeHead(302, {
          Location: `/pages/${oldPage || "index"}.html${url.search}`,
        });
        res.end();
        return;
      }
      const relative = requested.replace(/^\//, "");
      // Explicitly expose browser builds only, never the dependency directory.
      const vendor = {
        "assets/vendor/pdf.mjs": "pdfjs-dist/build/pdf.mjs",
        "assets/vendor/pdf.worker.mjs": "pdfjs-dist/build/pdf.worker.mjs",
        "assets/vendor/fflate.mjs": "fflate/esm/browser.js",
        "assets/vendor/purify.mjs": "dompurify/dist/purify.es.mjs",
      };
      const pdfAsset = relative.match(
        /^assets\/vendor\/pdfjs\/(cmaps|standard_fonts|wasm)\/([a-zA-Z0-9_.-]+)$/,
      );
      const dependency =
        vendor[relative] ||
        (pdfAsset ? `pdfjs-dist/${pdfAsset[1]}/${pdfAsset[2]}` : null);
      if (dependency) {
        const data = await readFile(
          path.join(root, "node_modules", dependency),
        );
        res.writeHead(200, {
          "Content-Type": /\.m?js$/.test(relative)
            ? "text/javascript; charset=utf-8"
            : relative.endsWith(".wasm")
              ? "application/wasm"
              : "application/octet-stream",
          "Cache-Control": "no-cache",
        });
        res.end(req.method === "HEAD" ? undefined : data);
        return;
      }
      const allowed =
        relative === "index.html" ||
        relative === "README.md" ||
        /^(assets|pages|templates|data|docs)\//.test(relative);
      if (
        !allowed ||
        relative.split(/[\\/]/).some((p) => p.startsWith(".") || p === "..") ||
        relative.includes("\0") ||
        relative.includes("\\")
      ) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      const file = await realpath(path.resolve(publicRoot, relative)),
        realRoot = await realpath(publicRoot),
        inside = path.relative(realRoot, file);
      if (inside.startsWith("..") || path.isAbsolute(inside)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      const type =
        path.extname(file) === ".mjs"
          ? "text/javascript; charset=utf-8"
          : types[path.extname(file).toLowerCase()];
      if (!type || !(await stat(file)).isFile())
        throw Error("Not a public file");
      const data = await readFile(file);
      res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-cache" });
      res.end(req.method === "HEAD" ? undefined : data);
    } catch {
      if (!res.headersSent) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Page not found");
      } else res.end();
    }
  });
  return app;
}
export function configuration(env = process.env) {
  const origin = new URL(env.APP_ORIGIN || "http://127.0.0.1:4173").origin;
  const importSecret = env.IMPORT_SIGNING_SECRET ?? "";
  if (importSecret.length < 32 || importSecret.includes("CHANGE_ME"))
    throw Error(
      "Set IMPORT_SIGNING_SECRET to at least 32 random characters in .env.",
    );
  if (env.NODE_ENV === "production" && !origin.startsWith("https:"))
    throw Error("Production APP_ORIGIN must use HTTPS.");
  const sessionDays = Number(env.SESSION_DAYS ?? 7);
  if (!Number.isFinite(sessionDays) || sessionDays < 1 || sessionDays > 90)
    throw Error("SESSION_DAYS must be between 1 and 90.");
  return {
    origin,
    importSecret,
    ownerLogin: env.SITE_OWNER_LOGIN || "philine",
    sessionDays,
  };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  let pool;
  try {
    const config = configuration();
    pool = database();
    await pool.query("SELECT name FROM schema_migrations LIMIT 1");
    const development = process.argv.includes("--dev");
    let vite;
    if (development) {
      const { createServer } = await import("vite");
      vite = await createServer();
    } else {
      try {
        await stat(path.join(root, "dist/pages/index.html"));
      } catch {
        throw Error("Set up the frontend build: run npm run build first.");
      }
    }
    const server = http.createServer(
      createHandler(createAPI(pool, config), {
        publicRoot: development ? root : path.join(root, "dist"),
        vite,
      }),
    );
    server.requestTimeout = 120000;
    server.headersTimeout = 15000;
    server.listen(
      Number(process.env.PORT || 4173),
      process.env.HOST || "127.0.0.1",
      () => console.log(`Picture Book: ${config.origin}/pages/index.html`),
    );
    server.on("error", () => {
      console.error("Could not start HTTP server. Check HOST/PORT.");
      process.exitCode = 1;
      pool.end();
    });
    const stop = () =>
      server.close(async () => {
        await vite?.close();
        await pool.end();
      });
    process.on("SIGTERM", stop);
    process.on("SIGINT", stop);
  } catch (error) {
    console.error(
      error.message?.startsWith("Set ") ||
        error.message?.startsWith("Production") ||
        error.message?.startsWith("SESSION_DAYS")
        ? error.message
        : "Database startup failed. Check .env and run npm run db:migrate.",
    );
    await pool?.end();
    process.exitCode = 1;
  }
}
