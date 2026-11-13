import test from "node:test";
import assert from "node:assert/strict";
import { createImageLoader } from "../src/image-loader.js";

function fixture() {
  const created = [];
  const loader = createImageLoader(() => {
    const image = {};
    created.push(image);
    return image;
  });
  return { loader, created };
}

test("deduplicates pending requests and reuses successful images", async () => {
  const { loader, created } = fixture();
  const first = loader.load("a", "/a.png");
  assert.equal(loader.load("a", "/a.png"), first);
  assert.equal(created.length, 1);
  created[0].onload();
  assert.equal((await first).status, "ready");
  assert.equal((await loader.load("a", "/a.png")).image, created[0]);
  assert.equal(created.length, 1);
});

test("retains failures until retry and detaches callbacks on disposal", async () => {
  const { loader, created } = fixture();
  const first = loader.load("a", "/a.png");
  created[0].onerror();
  assert.equal((await first).status, "failed");
  assert.equal(loader.load("a", "/a.png"), first);
  loader.retry("a");
  const second = loader.load("a", "/a.png");
  assert.notEqual(second, first);
  assert.equal(created.length, 2);
  loader.dispose();
  assert.equal(created[1].onload, null);
  assert.equal(created[1].onerror, null);
  assert.equal(loader.get("a"), undefined);
});

test("independent in-flight selections settle without replacing each other", async () => {
  const { loader, created } = fixture();
  const a = loader.load("a", "/a.png");
  const b = loader.load("b", "/b.png");
  created[1].onload();
  assert.equal((await b).image, created[1]);
  created[0].onload();
  assert.equal((await a).image, created[0]);
  assert.equal(loader.get("a").status, "ready");
  assert.equal(loader.get("b").status, "ready");
});
