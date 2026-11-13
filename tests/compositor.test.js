import test from "node:test";
import assert from "node:assert/strict";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { drawWhale } from "../src/compositor.js";

const parts = { spout: "red", head: "green", body: "blue", tail: "yellow" };
const solid = (color) => {
  const canvas = createCanvas(600, 600);
  const context = canvas.getContext("2d");
  context.fillStyle = color;
  context.fillRect(0, 0, 600, 600);
  return canvas;
};
const images = Object.fromEntries(
  Object.keys(parts).map((part) => [parts[part], solid(parts[part])]),
);
const pixel = (canvas, x, y) =>
  Array.from(canvas.getContext("2d").getImageData(x, y, 1, 1).data);

test("each selected source supplies its own slice without leaking into another", () => {
  const canvas = createCanvas(1, 1);
  drawWhale(canvas, images, parts, 0, createCanvas);
  assert.deepEqual(pixel(canvas, 100, 100), [255, 0, 0, 255]);
  assert.deepEqual(pixel(canvas, 100, 400), [0, 128, 0, 255]);
  assert.deepEqual(pixel(canvas, 300, 400), [0, 0, 255, 255]);
  assert.deepEqual(pixel(canvas, 500, 400), [255, 255, 0, 255]);
});

test("softened boundaries mix adjacent sources while retaining a solid interior", () => {
  const canvas = createCanvas(600, 600);
  drawWhale(canvas, images, parts, 100, createCanvas);
  const boundary = pixel(canvas, 180, 400);
  assert.ok(
    boundary[1] > 0 && boundary[2] > 0,
    "green and blue should both contribute",
  );
  assert.equal(boundary[3], 255);
  assert.deepEqual(pixel(canvas, 300, 400), [0, 0, 255, 255]);
  assert.deepEqual(pixel(canvas, 300, 100), [255, 0, 0, 255]);
});

test("real vendor artwork exports a decodable 600px PNG with transparent corners", async () => {
  const ids = ["apple", "google", "whatsapp", "facebook"];
  const loaded = Object.fromEntries(
    await Promise.all(
      ids.map(async (id) => [id, await loadImage(`public/whales/${id}.png`)]),
    ),
  );
  const canvas = createCanvas(600, 600);
  drawWhale(
    canvas,
    loaded,
    {
      spout: "apple",
      head: "google",
      body: "whatsapp",
      tail: "facebook",
    },
    20,
    createCanvas,
  );
  const png = canvas.toBuffer("image/png");
  assert.deepEqual(
    Array.from(png.subarray(0, 8)),
    [137, 80, 78, 71, 13, 10, 26, 10],
  );
  const decoded = await loadImage(png);
  assert.equal(decoded.width, 600);
  assert.equal(decoded.height, 600);
  assert.equal(pixel(canvas, 0, 0)[3], 0);
  const pixels = canvas.getContext("2d").getImageData(0, 0, 600, 600).data;
  let visible = 0;
  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index]) visible++;
  }
  assert.ok(
    visible > 30000,
    "the export should contain a substantial visible whale",
  );
  assert.ok(
    visible < 360000,
    "the export should retain a transparent background",
  );
});

test("translated, scaled and rotated slices move their pixels after masking", () => {
  const canvas = createCanvas(600, 600);
  drawWhale(canvas, images, parts, 0, createCanvas, {
    head: { x: 100, y: 0, scaleX: 0.5, scaleY: 0.5, rotation: 90 },
  });
  assert.equal(pixel(canvas, 10, 400)[3], 0);
  assert.deepEqual(pixel(canvas, 180, 393), [0, 128, 0, 255]);
  assert.deepEqual(pixel(canvas, 300, 500), [0, 0, 255, 255]);
});

test("cached rendering matches fresh compositing and invalidates only affected slices", async () => {
  const { createWhaleRenderer } = await import("../src/compositor.js");
  const ids = ["apple", "google", "whatsapp", "facebook"];
  const sources = Object.fromEntries(
    await Promise.all(
      ids.map(async (id) => [id, await loadImage(`public/whales/${id}.png`)]),
    ),
  );
  let allocations = 0;
  const renderer = createWhaleRenderer((width, height) => {
    allocations++;
    return createCanvas(width, height);
  });
  const cached = createCanvas(600, 600);
  const fresh = createCanvas(600, 600);
  let selected = { spout: ids[0], head: ids[1], body: ids[2], tail: ids[3] };
  const check = (softness, transforms = {}) => {
    renderer.render(cached, sources, selected, softness, transforms);
    drawWhale(fresh, sources, selected, softness, createCanvas, transforms);
    assert.deepEqual(
      cached.getContext("2d").getImageData(0, 0, 600, 600).data,
      fresh.getContext("2d").getImageData(0, 0, 600, 600).data,
    );
  };
  check(20);
  assert.equal(allocations, 4);
  check(20, {
    head: { x: 45, y: -32, scaleX: 1.3, scaleY: 0.7, rotation: 37 },
  });
  assert.equal(allocations, 4, "transforms reuse all masked slices");
  selected = { ...selected, body: ids[0] };
  check(20);
  assert.equal(allocations, 5, "only the changed source is remasked");
  check(80);
  assert.equal(
    allocations,
    8,
    "only the three feathered slices change with softness",
  );
  check(150);
  assert.equal(allocations, 11);
  check(100);
  assert.equal(allocations, 11, "equivalent clamped softness reuses layers");
  sources[selected.head] = await loadImage(
    `public/whales/${selected.head}.png`,
  );
  check(100);
  assert.equal(
    allocations,
    12,
    "replacing the image object invalidates its slice",
  );
  renderer.dispose();
  check(100);
  assert.equal(allocations, 16, "disposing releases all four slots");
  assert.equal(pixel(cached, 0, 0)[3], 0);
});
