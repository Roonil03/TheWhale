import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { createCanvas, loadImage } from "@napi-rs/canvas";

const publicDir = path.resolve("public");
const specimens = JSON.parse(
  await readFile(path.join(publicDir, "whales/manifest.json"), "utf8"),
);

test("specimens have unique ids, attribution and existing local images", async () => {
  assert.ok(Array.isArray(specimens) && specimens.length > 0);
  const ids = new Set();
  for (const specimen of specimens) {
    assert.match(specimen.id, /^[a-z0-9-]+$/);
    assert.ok(!ids.has(specimen.id), `Duplicate specimen: ${specimen.id}`);
    ids.add(specimen.id);
    for (const field of ["name", "source", "license", "version"]) {
      assert.ok(
        typeof specimen[field] === "string" && specimen[field].trim(),
        `${specimen.id}: missing ${field}`,
      );
    }
    assert.equal(new URL(specimen.source).protocol, "https:");
    assert.match(specimen.file, /^\/whales\/[a-z0-9-]+\.(png|svg)$/);
    await access(path.join(publicDir, specimen.file.slice(1)));
  }
});

test("all specimen artwork decodes, has visible pixels, and is visually distinct", async () => {
  const fingerprints = new Map();
  for (const specimen of specimens) {
    const imagePath = path.join(publicDir, specimen.file.slice(1));
    const bytes = await readFile(imagePath);
    if (specimen.file.endsWith(".svg")) {
      const svg = bytes.toString("utf8");
      assert.doesNotMatch(
        svg,
        /<(?:script|foreignObject|iframe)\b|\son[a-z]+\s*=/i,
        `${specimen.id}: active SVG content`,
      );
      assert.doesNotMatch(
        svg,
        /(?:href|xlink:href)\s*=\s*["'](?:https?:|data:|javascript:)/i,
        `${specimen.id}: external SVG content`,
      );
    }
    const image = await loadImage(bytes);
    assert.ok(
      image.width >= 16 && image.height >= 16,
      `${specimen.id}: invalid dimensions`,
    );
    const canvas = createCanvas(128, 128);
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0, 128, 128);
    const pixels = context.getImageData(0, 0, 128, 128).data;
    let visible = 0;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index]) visible++;
    }
    assert.ok(visible > 100, `${specimen.id}: empty artwork`);
    const fingerprint = createHash("sha256").update(pixels).digest("hex");
    assert.ok(
      !fingerprints.has(fingerprint),
      `${specimen.id}: duplicates ${fingerprints.get(fingerprint)}`,
    );
    fingerprints.set(fingerprint, specimen.id);
  }
});
