import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

const dist = path.resolve("dist");
const html = await readFile(path.join(dist, "index.html"), "utf8");
const base = "/TheWhale/";

assert.match(html, /<meta\s+name="description"\s+content="[^"]+"/);
assert.match(
  html,
  /<link rel="canonical" href="https:\/\/roonil03\.github\.io\/TheWhale\/"/,
);
assert.match(
  html,
  /<meta\s+property="og:image"\s+content="https:\/\/roonil03\.github\.io\/TheWhale\/og\.png"/,
);
assert.match(html, /<script type="application\/ld\+json">/);

const labHtml = await readFile(path.join(dist, "lab.html"), "utf8");
const pageTitle = (contents) => contents.match(/<title>([^<]+)<\/title>/)?.[1];
assert.ok(pageTitle(labHtml), "Missing lab page title");
assert.notEqual(
  pageTitle(labHtml),
  pageTitle(html),
  "Lab needs its own page title",
);
assert.match(
  labHtml,
  /<link rel="canonical" href="https:\/\/roonil03\.github\.io\/TheWhale\/lab\.html"/,
);

for (const [page, contents] of [
  ["index.html", html],
  ["lab.html", labHtml],
]) {
  const bundles = [
    ...contents.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g),
  ].map((match) => match[1]);
  assert.ok(
    bundles.some((url) => url.endsWith(".js")),
    `Missing JavaScript bundle in ${page}`,
  );
  assert.ok(
    bundles.some((url) => url.endsWith(".css")),
    `Missing stylesheet in ${page}`,
  );
  for (const url of bundles) {
    assert.ok(
      url.startsWith(`${base}assets/`),
      `Invalid Pages asset URL: ${url}`,
    );
    await access(path.join(dist, url.slice(base.length)));
  }
}

for (const asset of [
  "favicon.svg",
  "og.png",
  "fonts/space-grotesk-latin.woff2",
  "whale-blueprint.svg",
  "wasm/whale-worker.js",
  "wasm/wasm_exec.js",
]) {
  await access(path.join(dist, asset));
}
const wasm = await readFile(path.join(dist, "wasm/whale.wasm"));
assert.ok(WebAssembly.validate(wasm), "Invalid built whale WebAssembly module");
const specimens = JSON.parse(
  await readFile(path.join(dist, "whales/manifest.json"), "utf8"),
);
assert.ok(specimens.length > 0, "Missing built specimens");
for (const { file } of specimens) {
  assert.match(file, /^\/whales\/[a-z0-9-]+\.(png|svg)$/);
  await access(path.join(dist, file.slice(1)));
}
console.log(
  "Production metadata, Pages bundle paths, and static assets verified.",
);
