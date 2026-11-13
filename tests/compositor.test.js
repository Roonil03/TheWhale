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
