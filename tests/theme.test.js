import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

for (const page of ["index.html", "lab.html"]) {
  const html = await readFile(page, "utf8");
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, "Missing theme initialization script");

  for (const [description, value, expected] of [
    ["no preference", null, "dark"],
    ["saved light preference", "light", "light"],
    ["invalid preference", "unexpected", "dark"],
    ["unavailable storage", new Error("unavailable"), "dark"],
  ]) {
    test(`${page}: theme starts ${expected} with ${description}`, () => {
      const meta = { content: "" };
      const document = {
        documentElement: { dataset: {} },
        querySelector(selector) {
          assert.equal(selector, 'meta[name="theme-color"]');
          return meta;
        },
      };
      const localStorage = {
        getItem(key) {
          assert.equal(key, "whale-theme");
          if (value instanceof Error) throw value;
          return value;
        },
      };
      runInNewContext(script, { document, localStorage });
      assert.equal(document.documentElement.dataset.theme, expected);
      assert.equal(meta.content, expected === "light" ? "#f3f8f7" : "#07141e");
    });
  }
}
