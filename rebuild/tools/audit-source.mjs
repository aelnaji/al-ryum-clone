import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { chromium } from "playwright";

const root = path.resolve(import.meta.dirname, "../..");
const out = path.resolve(import.meta.dirname, "../audit");
fs.mkdirSync(out, { recursive: true });
const files = [];
function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if ([".git", "rebuild"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) scan(full);
    else {
      const data = fs.readFileSync(full);
      files.push({ path: path.relative(root, full), bytes: data.length, sha256: crypto.createHash("sha256").update(data).digest("hex") });
    }
  }
}
scan(root);
const extensions = {};
for (const file of files) {
  const ext = path.extname(file.path);
  extensions[ext] = (extensions[ext] || 0) + 1;
}
const modules = files.filter(f => /\.(js|css|html)$/.test(f.path)).map(file => {
  const text = fs.readFileSync(path.join(root, file.path), "utf8");
  return { ...file,
    rafReferences: (text.match(/requestAnimationFrame/g) || []).length,
    mutationObserverReferences: (text.match(/MutationObserver/g) || []).length,
    assetReferences: [...new Set([...text.matchAll(/["'`](\/assets\/[^"'`\s<>]+)["'`]/g)].map(m => m[1]))],
  };
});
fs.writeFileSync(path.join(out, "source-inventory.json"), JSON.stringify({ baseline: "7af5f16", count: files.length, totalBytes: files.reduce((s, f) => s + f.bytes, 0), extensions, files, modules }, null, 2));

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const routes = ["/", "/about", "/services", "/contact", "/projects", "/solutions/engineering", "/projects/1"];
const snapshots = [];
for (const route of routes) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.route("**/*", async request => {
    if (request.request().isNavigationRequest()) return request.fulfill({ status: 200, contentType: "text/html", body: html });
    if (/\.mp4|\/frames\/|hero-0817-astra/.test(request.request().url())) return request.abort();
    return request.continue();
  });
  await page.goto(`http://localhost:3100${route}`, { waitUntil: "domcontentloaded" });
  await page.locator("#root h1,#root h2").first().waitFor({ state: "attached", timeout: 20000 });
  const snapshot = await page.evaluate(() => {
    const ids = [...document.querySelectorAll("[id]")].map(e => e.id);
    return {
      text: document.querySelector("#root")?.textContent || "",
      visibleText: document.querySelector("#root")?.innerText || "",
      headings: [...document.querySelectorAll("h1,h2,h3")].map(e => e.textContent),
      links: [...document.querySelectorAll("#root a")].map(e => ({ label: e.textContent, href: e.getAttribute("href") })),
      duplicateIds: [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))],
    };
  });
  snapshots.push({ route, ...snapshot, runtimeErrors: errors, note: "Video/frame requests blocked during content capture; not a media-performance test." });
  fs.writeFileSync(path.join(out, "content-snapshots.json"), JSON.stringify(snapshots, null, 2));
  await page.close();
}
await browser.close();
fs.writeFileSync(path.join(out, "content-snapshots.json"), JSON.stringify(snapshots, null, 2));
console.log(JSON.stringify({ files: files.length, megabytes: Math.round(files.reduce((s, f) => s + f.bytes, 0) / 1e6), extensions, routes: snapshots.map(s => ({ route: s.route, characters: s.text.length, duplicateIds: s.duplicateIds, errors: s.runtimeErrors })) }, null, 2));
