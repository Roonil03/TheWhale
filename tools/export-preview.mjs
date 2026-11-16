// Render the same compositor offline for an inspectable PNG export fixture.
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { RENDER_SIZE, drawWhale } from "../src/compositor.js";

const output = process.argv[2];
if (!output) throw new Error("Pass an output PNG path");
const publicFile = (file) =>
  fileURLToPath(new URL(`../public${file}`, import.meta.url));
const specimens = JSON.parse(
  await readFile(publicFile("/whales/manifest.json"), "utf8"),
);
const ids = ["apple", "google", "whatsapp", "facebook"];
const images = Object.fromEntries(
  await Promise.all(
    ids.map(async (id) => [
      id,
      await loadImage(
        publicFile(specimens.find((item) => item.id === id).file),
      ),
    ]),
  ),
);
const canvas = createCanvas(RENDER_SIZE, RENDER_SIZE);
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
console.log(
  `Wrote transparent ${RENDER_SIZE} x ${RENDER_SIZE} PNG to ${output}`,
);
