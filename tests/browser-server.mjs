import http from "node:http";
import { PGlite } from "@electric-sql/pglite";
import { migrate } from "../server/db.mjs";
import { createOwner } from "../server/auth.mjs";
import { createAPI } from "../server/api.mjs";
import { createHandler } from "../scripts/serve.mjs";
import { existsSync } from "node:fs";
import path from "node:path";
const db = new PGlite();
const query = async (sql, params) =>
  params === undefined
    ? (await db.exec(sql, { parsers: { 1082: (x) => x } })).at(-1)
    : db.query(sql, params, { parsers: { 1082: (x) => x } });
const pool = { query, connect: async () => ({ query, release() {} }) };
await migrate(pool);
await createOwner(pool, "philine", "browser fixture password");
await createOwner(pool, "restore-test", "browser fixture password");
const config = {
  origin: "http://127.0.0.1:4185",
  importSecret: "browser-fixture-secret-".repeat(3),
  ownerLogin: "philine",
  sessionDays: 7,
};
const api = createAPI(pool, config),
  app = createHandler(api);
if (existsSync(".migration-baseline/pages/index.html")) {
  const baseline = createHandler(api, {
    publicRoot: path.resolve(".migration-baseline"),
  });
  const serve = app.handle.bind(app);
  const server = http.createServer((req, res) => {
    if (req.url.startsWith("/baseline/")) {
      req.url = req.url.slice("/baseline".length);
      baseline(req, res);
    } else serve(req, res);
  });
  server.listen(4185, "127.0.0.1");
  process.on("SIGTERM", () => server.close(() => db.close()));
} else {
  const server = http.createServer(app);
  server.listen(4185, "127.0.0.1");
  process.on("SIGTERM", () => server.close(() => db.close()));
}
