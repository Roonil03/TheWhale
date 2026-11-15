import { PART_BOUNDS, normalizeTransform } from "./editor-model.js";

/** Editor coordinate space: parts, transforms, pointer math and share URLs use 0–600. */
export const CANVAS_SIZE = 600;
/**
 * Backing-store pixels per editor unit. Fixed rather than derived from
 * devicePixelRatio so every device previews and exports the same image.
 */
export const RENDER_SCALE = 2;
/** Width and height of the canvas backing store and of the exported PNG. */
export const RENDER_SIZE = CANVAS_SIZE * RENDER_SCALE;

/** Sources no larger than this (in either dimension) are enlarged without smoothing. */
export const PIXELATED_MAX_SIZE = 64;

const SPOUT_HEIGHT = PART_BOUNDS.spout.height;

const isVector = (image) =>
  /(?:\.svg(?:[?#]|$)|^data:image\/svg\+xml)/i.test(
    String(image.currentSrc || image.src || ""),
  );

/** Keep only the current masked slice for each part of one editor. */
export function createWhaleRenderer(
  createLayer = () => document.createElement("canvas"),
  { scale = RENDER_SCALE } = {},
) {
  const size = CANVAS_SIZE;
  const pixels = Math.round(size * scale);
  let cache = {};

  const smooth = (context) => {
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
  };

  function render(canvas, images, parts, softness, transforms = {}) {
    const third = size / 3;
    const feather = Math.max(0, Math.min(100, softness)) * 0.55;
    // Assigning width/height reallocates and clears the backing store, so only
    // do it when the size actually changes; otherwise clear in place.
    if (canvas.width !== pixels) canvas.width = pixels;
    if (canvas.height !== pixels) canvas.height = pixels;
    const context = canvas.getContext("2d");
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, pixels, pixels);
    smooth(context);
    context.setTransform(scale, 0, 0, scale, 0, 0);

    const paint = (part, image, x1, y1, x2, y2, soften) => {
      const seam = soften ? feather : 0;
      let entry = cache[part];
      if (!entry || entry.image !== image || entry.seam !== seam) {
        // Mask at full backing-store resolution so vector sources rasterise
        // sharply and transforms only resample an already-sharp layer.
        const layer = createLayer(pixels, pixels);
        layer.width = layer.height = pixels;
        const layerContext = layer.getContext("2d");
        smooth(layerContext);
        layerContext.setTransform(scale, 0, 0, scale, 0, 0);
        // SVGs without width/height can report no intrinsic size; treat them as square.
        const width = image.naturalWidth || image.width || size;
        const height = image.naturalHeight || image.height || size;
        const fit = Math.min(size / width, size / height);
        const scaledWidth = width * fit;
        const scaledHeight = height * fit;
        // Tiny historical rasters are pixel art: enlarge them with crisp
        // nearest-neighbour pixels instead of a smeared bilinear blur.
        layerContext.imageSmoothingEnabled =
          isVector(image) || Math.max(width, height) > PIXELATED_MAX_SIZE;
        layerContext.drawImage(
          image,
          (size - scaledWidth) / 2,
          (size - scaledHeight) / 2,
          scaledWidth,
          scaledHeight,
        );
        layerContext.globalCompositeOperation = "destination-in";
        if (soften && feather) {
          const gradient = layerContext.createLinearGradient(x1, 0, x2, 0);
          const fraction = Math.min(0.45, feather / (x2 - x1));
          gradient.addColorStop(0, x1 === 0 ? "#000" : "transparent");
          gradient.addColorStop(fraction, "#000");
          gradient.addColorStop(1 - fraction, "#000");
          gradient.addColorStop(1, x2 === size ? "#000" : "transparent");
          layerContext.fillStyle = gradient;
        } else {
          layerContext.fillStyle = "#000";
        }
        layerContext.fillRect(x1, y1, x2 - x1, y2 - y1);
        entry = cache[part] = { image, seam, layer };
      }
      const bounds = PART_BOUNDS[part];
      const centerX = bounds.x + bounds.width / 2;
      const centerY = bounds.y + bounds.height / 2;
      const transform = normalizeTransform(transforms?.[part]);
      context.save();
      context.translate(centerX + transform.x, centerY + transform.y);
      context.rotate((transform.rotation * Math.PI) / 180);
      context.scale(transform.scaleX, transform.scaleY);
      context.drawImage(entry.layer, -centerX, -centerY, size, size);
      context.restore();
    };

    paint(
      "head",
      images[parts.head],
      0,
      SPOUT_HEIGHT,
      third + feather,
      size,
      true,
    );
    paint(
      "body",
      images[parts.body],
      third - feather,
      SPOUT_HEIGHT,
      third * 2 + feather,
      size,
      true,
    );
    paint(
      "tail",
      images[parts.tail],
      third * 2 - feather,
      SPOUT_HEIGHT,
      size,
      size,
      true,
    );
    paint("spout", images[parts.spout], 0, 0, size, SPOUT_HEIGHT, false);
  }

  return {
    render,
    size: pixels,
    dispose: () => {
      cache = {};
    },
  };
}

/** Compose transparent vendor artwork into four deliberately experimental slices. */
export function drawWhale(
  canvas,
  images,
  parts,
  softness,
  createLayer = () => document.createElement("canvas"),
  transforms = {},
  options = {},
) {
  createWhaleRenderer(createLayer, options).render(
    canvas,
    images,
    parts,
    softness,
    transforms,
  );
}
