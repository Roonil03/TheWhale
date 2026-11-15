import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import {
  CANVAS_SIZE,
  RENDER_SCALE,
  RENDER_SIZE,
  createWhaleRenderer,
  drawWhale,
} from "../src/compositor.js";

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
/** Read the pixel under an editor-space (0–600) point, whatever the backing scale. */
const pixel = (canvas, x, y) => {
  const scale = canvas.width / CANVAS_SIZE;
  return Array.from(
    canvas
      .getContext("2d")
      .getImageData(Math.floor(x * scale), Math.floor(y * scale), 1, 1).data,
  );
};
const specimens = JSON.parse(
  await readFile("public/whales/manifest.json", "utf8"),
);
const loadSpecimen = (id) =>
  loadImage(`public${specimens.find((item) => item.id === id).file}`);

test("renders a fixed 2x backing store for the 600-unit editor space", () => {
  assert.equal(CANVAS_SIZE, 600);
  assert.equal(RENDER_SCALE, 2);
  assert.equal(RENDER_SIZE, 1200);
  const canvas = createCanvas(1, 1);
  drawWhale(canvas, images, parts, 0, createCanvas);
  assert.equal(canvas.width, RENDER_SIZE);
  assert.equal(canvas.height, RENDER_SIZE);
  const unscaled = createCanvas(1, 1);
  drawWhale(unscaled, images, parts, 0, createCanvas, {}, { scale: 1 });
  assert.equal(unscaled.width, 600);
});

test("each selected source supplies its own slice without leaking into another", () => {
  const canvas = createCanvas(1, 1);
  drawWhale(canvas, images, parts, 0, createCanvas);
  assert.deepEqual(pixel(canvas, 100, 100), [255, 0, 0, 255]);
  assert.deepEqual(pixel(canvas, 100, 400), [0, 128, 0, 255]);
  assert.deepEqual(pixel(canvas, 300, 400), [0, 0, 255, 255]);
  assert.deepEqual(pixel(canvas, 500, 400), [255, 255, 0, 255]);
  // Seams land on exact backing-store pixel boundaries.
  assert.deepEqual(pixel(canvas, 199.5, 400), [0, 128, 0, 255]);
  assert.deepEqual(pixel(canvas, 200, 400), [0, 0, 255, 255]);
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

test("real vendor artwork exports a decodable 1200px PNG with transparent corners", async () => {
  const ids = ["apple", "google", "whatsapp", "facebook"];
  const loaded = Object.fromEntries(
    await Promise.all(ids.map(async (id) => [id, await loadSpecimen(id)])),
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
  assert.equal(decoded.width, RENDER_SIZE);
  assert.equal(decoded.height, RENDER_SIZE);
  assert.equal(pixel(canvas, 0, 0)[3], 0);
  const pixels = canvas
    .getContext("2d")
    .getImageData(0, 0, RENDER_SIZE, RENDER_SIZE).data;
  let visible = 0;
  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index]) visible++;
  }
  const area = RENDER_SIZE * RENDER_SIZE;
  assert.ok(
    visible > area / 12,
    "the export should contain a substantial visible whale",
  );
  assert.ok(
    visible < area,
    "the export should retain a transparent background",
  );
});

test("vector sources are rasterised at backing-store resolution", async () => {
  // A 36-unit Twemoji SVG drawn into a 1200px layer must keep hard edges: a
  // layer rasterised at 600 and then enlarged would show 2px-wide ramps.
  const twitter = await loadSpecimen("twitter");
  const sizes = [];
  const renderer = createWhaleRenderer((width, height) => {
    sizes.push([width, height]);
    return createCanvas(width, height);
  });
  const canvas = createCanvas(1, 1);
  const all = { spout: "t", head: "t", body: "t", tail: "t" };
  renderer.render(canvas, { t: twitter }, all, 0);
  assert.deepEqual(sizes, Array(4).fill([RENDER_SIZE, RENDER_SIZE]));
});

test("tiny raster sources are enlarged as crisp pixel art", () => {
  const tiny = createCanvas(32, 32);
  const context = tiny.getContext("2d");
  context.fillStyle = "#f00";
  context.fillRect(0, 0, 16, 32);
  context.fillStyle = "#00f";
  context.fillRect(16, 0, 16, 32);
  const canvas = createCanvas(1, 1);
  const all = { spout: "x", head: "x", body: "x", tail: "x" };
  drawWhale(canvas, { x: tiny }, all, 0, createCanvas);
  // The red/blue edge sits at x = 300; neighbouring pixels stay pure.
  assert.deepEqual(pixel(canvas, 299.5, 100), [255, 0, 0, 255]);
  assert.deepEqual(pixel(canvas, 300, 100), [0, 0, 255, 255]);
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

test("repeat renders clear in place without reallocating the canvas", () => {
  const target = createCanvas(1, 1);
  let resizes = 0;
  const canvas = {
    get width() {
      return target.width;
    },
    set width(value) {
      resizes++;
      target.width = value;
    },
    get height() {
      return target.height;
    },
    set height(value) {
      resizes++;
      target.height = value;
    },
    getContext: (type) => target.getContext(type),
  };
  const renderer = createWhaleRenderer(createCanvas);
  renderer.render(canvas, images, parts, 0);
  assert.equal(resizes, 2, "the first render sizes the backing store");
  renderer.render(canvas, images, parts, 0, {
    head: { x: 300, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
  });
  renderer.render(canvas, images, parts, 0, {
    head: { x: 300, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
  });
  assert.equal(resizes, 2, "later frames do not reallocate");
  // The head moved away from x = 100, so the previous frame must be cleared.
  assert.equal(pixel(target, 100, 400)[3], 0);
});

test("cached rendering matches fresh compositing and invalidates only affected slices", async () => {
  const ids = ["apple", "google", "whatsapp", "facebook"];
  const sources = Object.fromEntries(
    await Promise.all(ids.map(async (id) => [id, await loadSpecimen(id)])),
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
      cached.getContext("2d").getImageData(0, 0, RENDER_SIZE, RENDER_SIZE)
        .data,
      fresh.getContext("2d").getImageData(0, 0, RENDER_SIZE, RENDER_SIZE).data,
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
  sources[selected.head] = await loadSpecimen(selected.head);
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
