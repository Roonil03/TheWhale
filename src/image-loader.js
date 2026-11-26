/** Cache one request per manifest item, including failures until an explicit retry. */
export function createImageLoader(createImage = () => new Image()) {
  const entries = new Map();
  return {
    load(id, src) {
      if (entries.has(id)) return entries.get(id).promise;
      const image = createImage();
      const entry = { status: "loading", image };
      entry.promise = new Promise((resolve) => {
        image.onload = () => {
          entry.status = "ready";
          resolve(entry);
        };
        image.onerror = () => {
          entry.status = "failed";
          resolve(entry);
        };
        image.src = src;
      });
      entries.set(id, entry);
      return entry.promise;
    },
    get(id) {
      return entries.get(id);
    },
    retry(id) {
      if (entries.get(id)?.status === "failed") entries.delete(id);
    },
    dispose() {
      for (const entry of entries.values()) {
        entry.image.onload = null;
        entry.image.onerror = null;
      }
      entries.clear();
    },
  };
}
