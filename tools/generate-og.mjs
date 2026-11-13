// Build the social preview from original line art and the site's local font.
import { createCanvas, GlobalFonts, loadImage } from "@napi-rs/canvas";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const local = (path) => fileURLToPath(new URL(path, import.meta.url));
if (
  !GlobalFonts.registerFromPath(
    local("../public/fonts/space-grotesk-latin.woff2"),
    "Whale Grotesk",
  )
) {
  throw new Error("Could not load the local font");
}
const canvas = createCanvas(1200, 630);
const context = canvas.getContext("2d");
context.fillStyle = "#07141e";
context.fillRect(0, 0, 1200, 630);
context.fillStyle = "#6bd8ef";
context.fillRect(56, 50, 12, 12);
context.font = '500 21px "Whale Grotesk"';
context.fillText("THE WHALE / INTERNET FIELD GUIDE", 82, 67);
context.fillStyle = "#eaf4f3";
context.font = '700 82px "Whale Grotesk"';
context.fillText("One whale.", 56, 222);
context.fillStyle = "#6bd8ef";
context.fillText("Many ways.", 56, 317);
context.fillStyle = "#b6cbd1";
context.font = '400 27px "Whale Grotesk"';
context.fillText("Collect. Compare. Combine.", 59, 392);
context.fillStyle = "#d9fa62";
context.fillRect(58, 443, 355, 52);
context.fillStyle = "#07141e";
context.font = '600 20px "Whale Grotesk"';
context.fillText("SPOUTING WHALE  /  U+1F433", 73, 477);

context.strokeStyle = "#345866";
context.lineWidth = 1;
context.strokeRect(625, 99, 520, 416);
context.beginPath();
context.moveTo(885, 100);
context.lineTo(885, 514);
context.moveTo(626, 307);
context.lineTo(1144, 307);
context.stroke();
const svg = (
  await readFile(local("../public/whale-blueprint.svg"), "utf8")
).replaceAll("#233f67", "#6bd8ef");
const blueprint = await loadImage(Buffer.from(svg));
context.drawImage(blueprint, 200, 30, 500, 360, 645, 123, 480, 346);
context.fillStyle = "#a8cbd2";
context.font = '400 15px "Whale Grotesk"';
context.fillText("SPECIMEN / THE IMPROBABLE WHALE", 647, 132);
context.strokeStyle = "#314956";
context.beginPath();
context.moveTo(56, 554);
context.lineTo(1145, 554);
context.stroke();
context.font = '400 19px "Whale Grotesk"';
context.fillText("roonil03.github.io/TheWhale", 58, 594);
context.textAlign = "right";
context.fillText("SAME EMOJI. DIFFERENT OCEANS.", 1144, 594);
await writeFile(local("../public/og.png"), canvas.toBuffer("image/png"));
console.log("Generated branded 1200 x 630 social preview.");
