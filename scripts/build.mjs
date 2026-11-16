import { build } from "vite";
import { cp, mkdir } from "node:fs/promises";
await build();
// Copy only public assets and documentation, never the repository or private data.
await mkdir("dist/assets", { recursive: true });
for (const directory of ["images", "fonts"])
  await cp("assets/" + directory, "dist/assets/" + directory, {
    recursive: true,
  });
for (const directory of ["data", "docs"])
  await cp(directory, "dist/" + directory, {
    recursive: true,
    filter: (source) => !source.endsWith("site-content.js"),
  });
await cp("README.md", "dist/README.md");
