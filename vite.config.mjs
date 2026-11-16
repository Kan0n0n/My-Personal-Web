import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { readdir } from "node:fs/promises";
import path from "node:path";
export default defineConfig({
  plugins: [react(), tailwind()],
  publicDir: false,
  server: {
    middlewareMode: true,
    fs: {
      strict: true,
      allow: ["frontend", "assets", "pages", "node_modules"].map((p) =>
        path.resolve(p),
      ),
      deny: [
        "**/.env",
        "**/.env.*",
        "**/.git/**",
        "**/server/**",
        "**/scripts/**",
        "**/backups/**",
      ],
    },
  },
  build: {
    rollupOptions: {
      input: Object.fromEntries(
        (await readdir("pages"))
          .filter((n) => n.endsWith(".html"))
          .map((n) => [n, "pages/" + n]),
      ),
    },
  },
});
