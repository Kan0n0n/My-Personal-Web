import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4185",
    viewport: { width: 1366, height: 1000 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node tests/browser-server.mjs",
    url: "http://127.0.0.1:4185/pages/index.html",
    reuseExistingServer: false,
  },
});
