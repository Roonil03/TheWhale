import test from "node:test";
import assert from "node:assert/strict";
import { initialMix, shareUrl } from "../src/mixer.js";

const items = [
  { id: "apple" },
  { id: "google" },
  { id: "twitter" },
  { id: "openmoji" },
];

test("initial mix uses defaults for invalid selections and clamps softness", () => {
  assert.deepEqual(initialMix(items, "?spout=google&head=unknown&seam=150"), {
    parts: {
      spout: "google",
      head: "google",
      body: "twitter",
      tail: "openmoji",
    },
    softness: 100,
  });
  assert.equal(initialMix(items, "?seam=-5").softness, 0);
  assert.equal(initialMix(items, "?seam=invalid").softness, 20);
});

test("share links restore the mix and preserve unrelated URL parameters", () => {
  const parts = {
    spout: "apple",
    head: "twitter",
    body: "google",
    tail: "openmoji",
  };
  const url = new URL(
    shareUrl("https://example.com/TheWhale/?ref=friend#lab", parts, 42),
  );
  assert.equal(url.searchParams.get("ref"), "friend");
  assert.equal(url.hash, "#lab");
  assert.deepEqual(initialMix(items, url.search), { parts, softness: 42 });
});

test("editor links round-trip transforms and ignore malformed values", async () => {
  const { parseEditorRecipe, shareEditorUrl } = await import("../src/mixer.js");
  const state = parseEditorRecipe(items);
  state.transforms.head = {
    x: 25,
    y: -10,
    scaleX: 2,
    scaleY: 0.5,
    rotation: 45,
  };
  const url = new URL(
    shareEditorUrl("https://example.com/lab.html?ref=a", state),
  );
  assert.deepEqual(parseEditorRecipe(items, url.search), state);
  assert.equal(url.searchParams.get("ref"), "a");
  const malformed = parseEditorRecipe(items, "?head=apple&transforms=%7Bbad");
  assert.equal(malformed.parts.head, "apple");
  assert.equal(malformed.transforms.head.scaleX, 1);
  const invalid = new URLSearchParams({
    transforms: JSON.stringify({
      head: { x: 9999, scaleX: "bad" },
      bogus: { x: 1 },
    }),
  });
  const restored = parseEditorRecipe(items, invalid.toString());
  assert.equal(restored.transforms.head.x, 600);
  assert.equal(restored.transforms.head.scaleX, 1);
  assert.equal(restored.transforms.bogus, undefined);
  assert.equal(
    new URL(
      shareEditorUrl(url.href, parseEditorRecipe(items)),
    ).searchParams.has("transforms"),
    false,
  );
});
