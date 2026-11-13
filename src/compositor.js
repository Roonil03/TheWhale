import { PART_BOUNDS, normalizeTransform } from "./editor-model.js";

/** Keep only the current masked slice for each part of one editor. */
export function createWhaleRenderer(
  createLayer = () => document.createElement("canvas"),
) {
  let cache = {};

  function render(canvas, images, parts, softness, transforms = {}) {
    const size = 600;
    const spoutHeight = 186;
    const third = size / 3;
    const feather = Math.max(0, Math.min(100, softness)) * 0.55;
    canvas.width = canvas.height = size;
    const context = canvas.getContext("2d");

    const paint = (part, image, x1, y1, x2, y2, soften) => {
      const seam = soften ? feather : 0;
      let entry = cache[part];
      if (!entry || entry.image !== image || entry.seam !== seam) {
        const layer = createLayer(size, size);
        layer.width = layer.height = size;
        const layerContext = layer.getContext("2d");
        const width = image.naturalWidth || image.width;
        const height = image.naturalHeight || image.height;
        const scale = Math.min(size / width, size / height);
        const scaledWidth = width * scale;
        const scaledHeight = height * scale;
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
      context.drawImage(entry.layer, -centerX, -centerY);
      context.restore();
    };

    paint(
      "head",
      images[parts.head],
      0,
      spoutHeight,
      third + feather,
      size,
      true,
    );
    paint(
      "body",
      images[parts.body],
      third - feather,
      spoutHeight,
      third * 2 + feather,
      size,
      true,
    );
    paint(
      "tail",
      images[parts.tail],
      third * 2 - feather,
      spoutHeight,
      size,
      size,
      true,
    );
    paint("spout", images[parts.spout], 0, 0, size, spoutHeight, false);
  }

  return {
    render,
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
) {
  createWhaleRenderer(createLayer).render(
    canvas,
    images,
    parts,
    softness,
    transforms,
  );
}
