import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import { createServer } from "vite";
import { createHandler } from "../scripts/serve.mjs";
const vite = await createServer(),
  server = http.createServer(
    createHandler(
      (req, res) => {
        res.end("{}");
      },
      { publicRoot: process.cwd(), vite },
    ),
  );
try {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + server.address().port;
  assert.match(
    await (await fetch(base + "/pages/index.html")).text(),
    /\/frontend\/main.jsx/,
  );
  assert.equal((await fetch(base + "/frontend/main.jsx")).status, 200);
  const worker = await fetch(base + "/assets/vendor/pdf.worker.mjs");
  assert.equal(worker.status, 200);
  assert.match(worker.headers.get("content-type"), /javascript/);
  for (const file of ["server/auth.mjs", ".env", "scripts/owner.mjs"]) {
    const response = await fetch(
      base + "/@fs/" + path.resolve(file).replaceAll("\\", "/"),
    );
    assert.ok(
      [403, 404].includes(response.status),
      "Dev server must not expose " + file,
    );
  }
  console.log(
    "Vite same-origin development entry, React source and private-file isolation passed.",
  );
} finally {
  await vite.close();
  await new Promise((resolve) => server.close(resolve));
}
