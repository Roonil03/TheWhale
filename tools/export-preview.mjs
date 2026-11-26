// Render the same compositor offline for an inspectable PNG export fixture.
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { drawWhale } from "../src/compositor.js";

const output = process.argv[2];
if (!output) throw new Error("Pass an output PNG path");
const ids = ["apple", "google", "whatsapp", "facebook"];
const images = Object.fromEntries(
  await Promise.all(
    ids.map(async (id) => [
      id,
      await loadImage(
        fileURLToPath(new URL(`../public/whales/${id}.png`, import.meta.url)),
      ),
    ]),
  ),
);
const canvas = createCanvas(600, 600);
drawWhale(
  canvas,
  images,
  {
    spout: "apple",
    head: "google",
    body: "whatsapp",
    tail: "facebook",
  },
  30,
  createCanvas,
);
await writeFile(output, canvas.toBuffer("image/png"));
console.log(`Wrote transparent 600 x 600 PNG to ${output}`);
