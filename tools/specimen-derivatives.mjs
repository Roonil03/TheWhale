// Record native specimen dimensions in the manifest and write lighter display
// copies of large raster originals. The originals in public/whales are never
// modified: their bytes and SHA-256 hashes stay as documented. Display copies
// are for the gallery grid only; the splice lab always loads the original.
//
//   node tools/specimen-derivatives.mjs          update manifest and public/whales/display
//   node tools/specimen-derivatives.mjs --check  exit 1 if anything is stale
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const publicDir = path.join(root, "public");
const manifestPath = path.join(publicDir, "whales/manifest.json");
const displayDir = path.join(publicDir, "whales/display");

/** Only rasters at least this large get a display copy. */
export const DISPLAY_MIN_SIZE = 256;
/** Display copies keep native size up to this edge (the grid shows ~170 CSS px, so 512 covers 3x). */
export const DISPLAY_MAX_SIZE = 512;
/** WebP quality for display copies. */
export const DISPLAY_QUALITY = 90;
/** A display copy is kept only when it is at most this fraction of the original's bytes. */
export const DISPLAY_MAX_RATIO = 0.7;
/** Rasters at or below this edge are treated as pixel art and shown with nearest-neighbour scaling. */
export const PIXELATED_MAX_SIZE = 64;

/** Read width/height from a PNG IHDR and report whether it is an animated PNG. */
export function pngInfo(bytes) {
  if (bytes.readUInt32BE(12) !== 0x49484452) throw new Error("Not a PNG");
  let animated = false;
  for (let offset = 8; offset < bytes.length; ) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("latin1", offset + 4, offset + 8);
    if (type === "acTL") animated = true;
    if (type === "IDAT") break;
    offset += 12 + length;
  }
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    animated,
  };
}

/** Intrinsic size of an SVG: width/height attributes, else the viewBox. */
export function svgInfo(text) {
  const tag = text.match(/<svg\b[^>]*>/i)?.[0] ?? "";
  const attribute = (name) =>
    tag.match(new RegExp(`\\s${name}\\s*=\\s*["']\\s*([\\d.]+)(?:px)?\\s*["']`))?.[1];
  const viewBox = tag
    .match(/\sviewBox\s*=\s*["']([^"']+)["']/)?.[1]
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const width = Number(attribute("width")) || viewBox?.[2];
  const height = Number(attribute("height")) || viewBox?.[3];
  if (!width || !height) throw new Error("SVG has no intrinsic size");
  return { width: Math.round(width), height: Math.round(height) };
}

async function derive() {
  const specimens = JSON.parse(await readFile(manifestPath, "utf8"));
  const outputs = new Map();
  const next = [];
  for (const specimen of specimens) {
    const bytes = await readFile(path.join(publicDir, specimen.file.slice(1)));
    const isSvg = specimen.file.endsWith(".svg");
    const info = isSvg ? svgInfo(bytes.toString("utf8")) : pngInfo(bytes);
    const { display, rendering, ...rest } = specimen;
    void display;
    void rendering;
    const item = { ...rest, width: info.width, height: info.height };
    if (!isSvg && Math.max(info.width, info.height) <= PIXELATED_MAX_SIZE)
      item.rendering = "pixelated";
    const largest = Math.max(info.width, info.height);
    if (!isSvg && !info.animated && largest >= DISPLAY_MIN_SIZE) {
      const image = await loadImage(bytes);
      const fit = Math.min(1, DISPLAY_MAX_SIZE / largest);
      const width = Math.round(info.width * fit);
      const height = Math.round(info.height * fit);
      const canvas = createCanvas(width, height);
      const context = canvas.getContext("2d");
      context.imageSmoothingQuality = "high";
      context.drawImage(image, 0, 0, width, height);
      const webp = await canvas.encode("webp", DISPLAY_QUALITY);
      if (webp.length <= bytes.length * DISPLAY_MAX_RATIO) {
        const name = `${specimen.id}.webp`;
        outputs.set(name, webp);
        item.display = `/whales/display/${name}`;
      }
    }
    next.push(item);
  }
  return { specimens, next, outputs };
}

const { specimens, next, outputs } = await derive();
const manifestText = `${JSON.stringify(next, null, 2)}\n`;
if (process.argv.includes("--check")) {
  const problems = [];
  if (JSON.stringify(specimens) !== JSON.stringify(next))
    problems.push("manifest.json dimensions or display fields are stale");
  const existing = new Set(await readdir(displayDir).catch(() => []));
  for (const name of outputs.keys())
    if (!existing.has(name)) problems.push(`missing display/${name}`);
  for (const name of existing)
    if (!outputs.has(name)) problems.push(`orphaned display/${name}`);
  if (problems.length) {
    console.error(problems.join("\n"));
    console.error("Run: node tools/specimen-derivatives.mjs");
    process.exit(1);
  }
  console.log("Specimen dimensions and display copies are current.");
} else {
  await rm(displayDir, { recursive: true, force: true });
  if (outputs.size) await mkdir(displayDir, { recursive: true });
  for (const [name, bytes] of outputs)
    await writeFile(path.join(displayDir, name), bytes);
  await writeFile(manifestPath, manifestText);
  for (const item of next)
    console.log(
      `${item.id.padEnd(22)} ${`${item.width}x${item.height}`.padEnd(9)} ${item.display ? `display ${(outputs.get(path.basename(item.display)).length / 1024).toFixed(1)} KiB` : ""}${item.rendering ? ` ${item.rendering}` : ""}`,
    );
}
