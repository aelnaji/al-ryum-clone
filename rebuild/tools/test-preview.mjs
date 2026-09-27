import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";

const base = process.env.PREVIEW_URL || "http://localhost:3200";
let server;
if (!process.env.PREVIEW_URL) {
  const exported = path.resolve(import.meta.dirname, "../out");
  const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".json": "application/json" };
  server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, base).pathname);
    const file = path.resolve(exported, "." + (pathname === "/" ? "/index.html" : pathname));
    if (!file.startsWith(exported + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(3200, resolve));
}
const output = path.resolve(import.meta.dirname, "../test-results");
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--enable-webgl", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const results = [];
async function test(name, run) {
  try { await run(); results.push({ name, pass: true }); }
  catch (error) { results.push({ name, pass: false, error: error.message }); }
}
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
const requests = [];
page.on("pageerror", error => errors.push(error.message));
page.on("request", request => requests.push(request.url()));
await page.goto(base);
await page.locator('[data-triangles]').waitFor();

await test("One real WebGL canvas; new geometry rendered", async () => {
  assert.equal(await page.locator("canvas").count(), 1);
  assert.ok(Number(await page.locator(".scene-host").getAttribute("data-triangles")) > 100);
  assert.equal(await page.locator(".scene-host").getAttribute("data-draw-calls"), "4");
});
await test("No legacy engines or media requests", async () => {
  assert.equal(requests.some(url => /\/assets\/|\.mp4|frame_\d+|al-ryum-.*\.js/.test(url)), false);
});
await test("Desktop opening copy stays above chapter controls", async () => {
  const panel = await page.locator(".hero-panel").boundingBox();
  const controls = await page.locator(".stage-bottom").boundingBox();
  assert.ok(panel && controls && panel.y + panel.height < controls.y);
});
await test("All migrated business sentences match original bundle", async () => {
  const source = fs.readFileSync(path.resolve(import.meta.dirname, "../../assets/index-v10-timeline.js"), "utf8");
  const copy = await page.locator(".hero-description,.body-copy").allTextContents();
  for (const sentence of copy) assert.ok(source.includes(sentence), `Missing source wording: ${sentence}`);
  assert.ok(source.includes("Innovation is in our blueprint."));
  assert.ok(source.includes("We don’t just build."));
});
await page.screenshot({ path: path.join(output, "desktop-opening.png") });
await test("Scroll drives geometry and second chapter", async () => {
  await page.getByRole("button", { name: "02 Construction" }).click();
  await page.waitForFunction(() => {
    const value = Number(document.querySelector(".scene-host")?.getAttribute("data-progress"));
    return value > 0.41 && value < 0.46;
  });
  assert.equal(await page.locator(".experience").getAttribute("data-chapter"), "2");
  assert.equal(await page.locator(".innovation-panel").isVisible(), true);
  await page.screenshot({ path: path.join(output, "desktop-middle.png") });
});
await test("Third chapter and reverse scroll", async () => {
  await page.getByRole("button", { name: "03 Who We Are" }).click();
  await page.waitForFunction(() => Number(document.querySelector(".scene-host")?.getAttribute("data-progress")) > 0.84);
  assert.equal(await page.locator(".experience").getAttribute("data-chapter"), "3");
  assert.equal(await page.locator(".about-panel").isVisible(), true);
  await page.screenshot({ path: path.join(output, "desktop-about.png") });
  await page.getByRole("button", { name: "01 Al Ryum" }).click();
  await page.waitForFunction(() => Number(document.querySelector(".scene-host")?.getAttribute("data-progress")) < 0.02);
});
await test("Honest stage gate; dialog closes with Escape", async () => {
  await page.getByRole("button", { name: "Our Projects", exact: true }).click();
  assert.equal(await page.locator("dialog").isVisible(), true);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("dialog").isVisible(), false);
});
await test("Motion toggle exposes all copy without pinned scrolling", async () => {
  await page.getByRole("button", { name: "Reduce motion", exact: true }).click();
  await page.locator(".static-mode").waitFor();
  assert.equal(await page.locator(".story-panel:visible").count(), 3);
  assert.equal(await page.locator("canvas").count(), 1);
  await page.getByRole("button", { name: "Enable motion", exact: true }).click();
  await page.waitForFunction(() => !document.querySelector(".experience")?.classList.contains("static-mode"));
});
await test("No runtime errors or duplicate element IDs", async () => {
  assert.deepEqual(errors, []);
  assert.equal(await page.evaluate(() => { const ids = [...document.querySelectorAll("[id]")].map(el => el.id); return ids.length - new Set(ids).size; }), 0);
});

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2, hasTouch: true });
await mobile.goto(base);
await mobile.locator('[data-triangles]').waitFor();
await test("Mobile: no overflow, all copy fits, menu works", async () => {
  assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await mobile.screenshot({ path: path.join(output, "mobile-opening.png") });
  await mobile.getByRole("button", { name: "Open menu", exact: true }).click();
  await mobile.getByRole("button", { name: "Who We Are", exact: true }).click();
  await mobile.waitForFunction(() => Number(document.querySelector(".scene-host")?.getAttribute("data-progress")) > 0.84);
  const bounds = await mobile.locator(".about-panel").boundingBox();
  assert.ok(bounds && bounds.y >= 82 && bounds.y + bounds.height <= 780, JSON.stringify(bounds));
  await mobile.screenshot({ path: path.join(output, "mobile-about.png") });
});
const reduced = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
await reduced.goto(base);
await test("OS reduced-motion preference is respected", async () => {
  await reduced.locator(".static-mode").waitFor();
  assert.equal(await reduced.locator(".story-panel:visible").count(), 3);
  assert.ok(await reduced.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
});
const fallback = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await fallback.addInitScript(() => {
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(type, ...args) {
    if (String(type).includes("webgl")) return null;
    return original.call(this, type, ...args);
  };
});
await fallback.goto(base);
await test("WebGL unavailable: brand fallback and readable opening", async () => {
  await fallback.locator(".scene-fallback").waitFor();
  assert.equal(await fallback.locator("h1").isVisible(), true);
  assert.equal(await fallback.locator("canvas").count(), 0);
});
const noJs = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
await noJs.goto(base);
await test("Server-rendered business copy exists without JavaScript", async () => {
  assert.equal(await noJs.locator("h1").isVisible(), true);
  assert.equal(await noJs.locator(".story-panel:visible").count(), 3);
  assert.ok((await noJs.locator("body").textContent()).includes("For over 35 years"));
});
const inventory = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "../audit/source-inventory.json"), "utf8"));
await test("Original repository files are unchanged", async () => {
  const crypto = await import("node:crypto");
  for (const file of inventory.files) {
    const data = fs.readFileSync(path.resolve(import.meta.dirname, "../..", file.path));
    assert.equal(crypto.createHash("sha256").update(data).digest("hex"), file.sha256, file.path);
  }
});
await browser.close();
if (server) await new Promise(resolve => server.close(resolve));
fs.writeFileSync(path.join(output, "results.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
process.exitCode = results.some(result => !result.pass) ? 1 : 0;
