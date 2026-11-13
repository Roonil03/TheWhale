/** Compose transparent vendor artwork into four deliberately experimental slices. */
export function drawWhale(
  canvas,
  images,
  parts,
  softness,
  createLayer = () => document.createElement("canvas"),
) {
  const size = 600;
  const spoutHeight = 186;
  const third = size / 3;
  const feather = Math.max(0, Math.min(100, softness)) * 0.55;
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d");

  const paint = (image, x1, y1, x2, y2, soften) => {
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
    context.drawImage(layer, 0, 0);
  };

  paint(images[parts.head], 0, spoutHeight, third + feather, size, true);
  paint(
    images[parts.body],
    third - feather,
    spoutHeight,
    third * 2 + feather,
    size,
    true,
  );
  paint(images[parts.tail], third * 2 - feather, spoutHeight, size, size, true);
  paint(images[parts.spout], 0, 0, size, spoutHeight, false);
}
