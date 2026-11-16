import { test, expect } from "@playwright/test";
import { sampleEPUB, samplePDF } from "../fixtures/books.mjs";
import { existsSync } from "node:fs";
import { createCanvas, loadImage } from "@napi-rs/canvas";
test("compare home against pre-migration commit", async ({ page }, info) => {
  test.skip(
    !existsSync(".migration-baseline/pages/index.html"),
    "Optional baseline source archive is not present.",
  );
  await page.clock.install({ time: new Date("2026-11-17T08:00:00+07:00") });
  for (const width of [390, 768, 1366]) {
    await page.setViewportSize({ width, height: 1000 });
    const shots = [];
    for (const path of ["/baseline/pages/index.html", "/pages/index.html"]) {
      await page.goto(path);
      await expect(page.locator("#clock")).toContainText("ICT");
      await page.evaluate(() => document.fonts.ready);
      shots.push(
        await page.screenshot({ animations: "disabled", fullPage: true }),
      );
    }
    const images = await Promise.all(shots.map(loadImage));
    expect(images[1].width).toBe(images[0].width);
    expect(images[1].height).toBe(images[0].height);
    const pixels = images.map((image) => {
      const canvas = createCanvas(image.width, image.height),
        context = canvas.getContext("2d");
      context.drawImage(image, 0, 0);
      return context.getImageData(0, 0, image.width, image.height).data;
    });
    let different = 0;
    for (let i = 0; i < pixels[0].length; i += 4)
      if (
        [0, 1, 2].some(
          (c) => Math.abs(pixels[0][i + c] - pixels[1][i + c]) > 30,
        )
      )
        different++;
    await info.attach("baseline-" + width, {
      body: shots[0],
      contentType: "image/png",
    });
    await info.attach("react-" + width, {
      body: shots[1],
      contentType: "image/png",
    });
    expect(
      different / (pixels[0].length / 4),
      `Changed pixels at ${width}px`,
    ).toBeLessThan(0.025);
  }
});
async function login(page, username = "philine") {
  await page.goto("/pages/owner.html");
  await page.getByLabel("Owner login").fill(username);
  await page
    .getByLabel("Password", { exact: true })
    .fill("browser fixture password");
  await page.getByRole("button", { name: "Open my notebook" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-owner", "true");
}
test("all pages load without runtime errors; visual artifacts at target widths", async ({
  page,
}, info) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const route of [
    "index",
    "posts",
    "blog",
    "documents",
    "work",
    "utilities",
    "anime",
    "archive",
    "novels",
    "ultilities",
    "owner",
  ]) {
    await page.goto("/pages/" + route + ".html");
    await expect(page.locator("main")).toBeVisible();
    await page.waitForTimeout(100);
  }
  for (const width of [320, 390, 768, 1366]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/pages/index.html");
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator(".masthead")).toBeVisible();
    await page.screenshot({
      path: info.outputPath("home-" + width + ".png"),
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});
test("utilities and owner editing, failed save retains draft, publication and trash", async ({
  page,
}) => {
  await page.goto("/pages/utilities.html");
  await page.locator("#choices").fill("Tea");
  await page.getByRole("button", { name: "Pick one for me" }).click();
  await expect(page.locator("#pick-result")).toContainText("Tea");
  await page.locator("#count-text").fill("Hello 世界");
  await expect(page.locator("#count-result")).toContainText("2 words");
  await login(page);
  await page.goto("/pages/posts.html");
  await page
    .getByRole("button", {
      name: /Write a little note|Write a page|New note|Write the first page/,
    })
    .first()
    .click();
  await page
    .getByLabel("Title", { exact: true })
    .fill("Browser regression note");
  await page
    .getByLabel("Your words")
    .fill("Unicode 世界 <script>safe text</script>");
  await page.route("**/api/me/records/posts", (r) =>
    r.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ error: "Conflict fixture" }),
    }),
  );
  await page.getByRole("button", { name: "Save this page" }).click();
  await expect(page.locator("#toast")).toContainText("Conflict fixture");
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    "Browser regression note",
  );
  await page.unroute("**/api/me/records/posts");
  await page.getByRole("button", { name: "Save this page" }).click();
  await expect(page.locator("#entries")).toContainText(
    "Browser regression note",
  );
  await page
    .getByRole("button", { name: "Edit page", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Publish saved version" }).click();
  await page.getByRole("button", { name: "Save this page" }).click();
  await page
    .getByRole("button", { name: "Edit page", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Save this page" }).click();
  await expect(page.locator("#entries")).not.toContainText(
    "Browser regression note",
  );
  await page.getByRole("button", { name: "Trash", exact: true }).click();
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(page.locator("#editor")).toContainText("No deleted records");
});
test("library originals, all formats, reader settings and bookmarks survive reopening", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const synth = new EventTarget();
    synth.getVoices = () => [
      {
        voiceURI: "fixture-local",
        name: "Fixture voice",
        lang: "en-US",
        localService: true,
        default: true,
      },
    ];
    window.__spoken = [];
    synth.speak = (u) => window.__spoken.push(u);
    synth.cancel = () => {};
    Object.defineProperty(window, "speechSynthesis", {
      value: synth,
      configurable: true,
    });
    window.SpeechSynthesisUtterance = class {
      constructor(text) {
        this.text = text;
      }
    };
  });
  await login(page);
  await page.goto("/pages/novels.html");
  await page.locator("#novel-files").setInputFiles([
    {
      name: "Reader.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(
        "A little novel for testing font preferences and reading positions. ".repeat(
          100,
        ),
      ),
    },
    {
      name: "Volume.epub",
      mimeType: "application/epub+zip",
      buffer: sampleEPUB(),
    },
    {
      name: "Document.pdf",
      mimeType: "application/pdf",
      buffer: samplePDF(true),
    },
  ]);
  await expect(page.locator("#library-status")).toContainText(
    "3 volumes saved",
  );
  await page.getByRole("button", { name: /Reader · TXT/ }).click();
  await expect(page.locator(".reader-text")).toContainText("A little novel");
  await page.locator("#reader-font").selectOption("verdana");
  await page.locator("#reader-alignment").selectOption("justify");
  await page.locator("#speech-rate").selectOption("1.25");
  await page.locator("#speech-play").click();
  await page.evaluate(() =>
    window.__spoken[0].onboundary({
      name: "word",
      charIndex: 9,
      charLength: 5,
    }),
  );
  await page.getByRole("button", { name: "Keep my place" }).click();
  await expect(page.locator("#toast")).toContainText("Your place is saved");
  const notebook = await (await page.request.get("/api/me/notebook")).json();
  expect(Object.values(notebook.reading)[0].anchor.offset).toBe(9);
  expect(Object.values(notebook.reading)[0].speech.rate).toBe(1.25);
  await page.reload();
  await page.getByRole("button", { name: /Reader · TXT/ }).click();
  await expect(page.locator("#reader-font")).toHaveValue("verdana");
  await expect(page.locator("#reader-alignment")).toHaveValue("justify");
  await expect(page.locator("#speech-rate")).toHaveValue("1.25");
  await page.getByRole("button", { name: /Reader · TXT/ }).click();
  await page.getByRole("button", { name: "Keep my place" }).click();
  await expect(page.locator("#toast")).toContainText("Your place is saved");
  await page.getByRole("button", { name: /Volume · EPUB/ }).click();
  await expect(page.locator(".reader-text")).toContainText("Chapter one");
  await expect(page.locator(".reader-text script")).toHaveCount(0);
  await page.getByRole("button", { name: "Keep my place" }).click();
  await page.getByRole("button", { name: /Document · PDF/ }).click();
  await expect(page.locator(".reader-text canvas")).toBeVisible();
  await expect(page.locator(".pdf-reader-text-layer")).toContainText(
    "Hello novel reader",
  );
  await page.getByRole("button", { name: "Keep my place" }).click();
  await page.getByRole("button", { name: "Remove from shelf" }).click();
  await page.getByRole("button", { name: "Save this page" }).click();
  await expect(page.locator("#book-list")).not.toContainText("Document · PDF");
  await page.getByRole("button", { name: "Trash", exact: true }).click();
  await page.getByRole("combobox", { name: "Section", exact: true }).selectOption("books");
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(page.locator("#book-list")).toContainText("Document · PDF");
});

test("profile, music, weather, task, resource and anime forms preserve their contracts", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  await page.getByRole("button", { name: "Edit my corner" }).click();
  await page.getByLabel("Your name").fill("Private fixture name");
  await page.getByRole("button", { name: "Save this page" }).click();
  await expect(page.locator(".profile")).toContainText("Private fixture name");
  await page.route("**/api/music-info?*", (r) =>
    r.fulfill({
      json: {
        title: "Test soundtrack",
        author_name: "Fixture artist",
        thumbnail_url: "https://example.com/cover.jpg",
      },
    }),
  );
  await page.locator("#music-url").fill("https://youtu.be/M7lc1UVf-VE");
  await page.locator("#music-load").click();
  await expect(page.locator("#audio-status")).toContainText(
    "saved for everyone",
  );
  await page.route("https://geocoding-api.open-meteo.com/**", (r) =>
    r.fulfill({
      json: {
        results: [
          {
            name: "Test Town",
            country: "Test Country",
            latitude: 10,
            longitude: 106,
          },
        ],
      },
    }),
  );
  await page.route("https://api.open-meteo.com/**", (r) =>
    r.fulfill({ json: { current: { temperature_2m: 29.4, weather_code: 2 } } }),
  );
  await page.locator('[data-action="weather-place"]').first().click();
  await page.getByLabel("City or town").fill("Test Town");
  await page.getByRole("button", { name: "Save this page" }).click();
  await page.getByRole("button", { name: "Test Town, Test Country" }).click();
  await expect(page.locator("#weather")).toContainText("29°C");
  await page.goto("/pages/work.html");
  await page.locator('[data-action="new-task"]').first().click();
  await page.getByLabel("Task", { exact: true }).fill("Private task fixture");
  await page.getByRole("button", { name: "Save this page" }).click();
  await expect(page.locator(".task-board")).toContainText(
    "Private task fixture",
  );
  await page.locator(".task select").selectOption("Done");
  await expect(page.locator('[data-task-column="Done"]')).toContainText(
    "Private task fixture",
  );
  await page.goto("/pages/documents.html");
  await page.locator('[data-action="new-document"]').first().click();
  await page.getByLabel("Title", { exact: true }).fill("Fixture resource");
  await page.getByLabel("Material link").fill("https://example.com/resource");
  await page.getByRole("button", { name: "Save this page" }).click();
  await expect(page.locator("#documents a")).toHaveAttribute(
    "href",
    "https://example.com/resource",
  );
  await page.goto("/pages/anime.html");
  await page.locator('[data-action="new-anime"]').first().click();
  await page.getByLabel("Anime title").fill("Fixture anime");
  await page.getByLabel("Contains spoilers?").selectOption("Yes");
  await page.getByRole("button", { name: "Save this page" }).click();
  await expect(page.locator("#anime-list")).toContainText("spoilers inside");
  await page.context().clearCookies();
  await page.goto("/pages/index.html");
  await expect(page.locator("body")).toHaveAttribute("data-owner", "false");
  await expect(page.locator(".profile")).not.toContainText(
    "Private fixture name",
  );
  await expect(page.locator('[data-profile="song"]')).toContainText(
    "Test soundtrack",
  );
  await page.goto("/pages/work.html");
  await expect(page.locator(".task-board")).not.toContainText(
    "Private task fixture",
  );
  expect(errors).toEqual([]);
});

test("backup preview and restore into an empty account", async ({ page }) => {
  await login(page);
  const response = await page.request.get("/api/me/export");
  expect(response.ok()).toBeTruthy();
  const backup = await response.json();
  expect(backup.books.length).toBeGreaterThanOrEqual(3);
  await page.context().clearCookies();
  await login(page, "restore-test");
  await page.getByRole("button", { name: "Backup & import" }).click();
  await page.getByLabel("Preview a Picture Book backup").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(page.locator("#editor")).toContainText("Import this preview");
  await page.getByRole("button", { name: "Import this preview" }).click();
  await expect(page.locator("#toast")).toContainText("saved on the server");
  const restored = await (await page.request.get("/api/me/export")).json();
  expect(restored.books.map((b) => b.title)).toEqual(
    backup.books.map((b) => b.title),
  );
  expect(restored.notebook.tasks[0].title).toBe("Private task fixture");
});

test("extractor frontend handles mocked analysis and zoom", async ({
  page,
}) => {
  await page.route("http://localhost:5000/api/analyze", (r) =>
    r.fulfill({
      headers: { "Access-Control-Allow-Origin": "*" },
      json: {
        json_data: { image_id: "fixture.png", blobs: [], relationships: [] },
        images: { relationships: "javascript:alert(1)" },
      },
    }),
  );
  await page.route("https://unpkg.com/**", (r) =>
    r.fulfill({
      contentType: "text/javascript",
      body: "window.vis={Network:class{destroy(){}}};",
    }),
  );
  await page.goto("/pages/ultilities.html");
  await page.locator("#imageInput").setInputFiles({
    name: "diagram.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jM1sAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await page.locator("#analyzeButton").click();
  await expect(page.locator("#status")).toHaveText("Analysis complete!");
  await expect(page.locator(".ai2d-json-card")).toContainText("fixture.png");
  await expect(page.locator('[src^="javascript:"]')).toHaveCount(0);
  await page.locator(".ai2d-result-card img").first().click();
  await expect(
    page.getByRole("dialog", { name: "Enlarged diagram" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Enlarged diagram" }),
  ).not.toBeVisible();
});
