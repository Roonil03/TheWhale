/** Cache one request per manifest item, including failures until an explicit retry. */
export function createImageLoader(createImage = () => new Image()) {
  const entries = new Map();
  return {
    load(id, src) {
      if (entries.has(id)) return entries.get(id).promise;
      const image = createImage();
      const entry = { status: "loading", image };
      entry.promise = new Promise((resolve) => {
        const ready = () => {
          if (entries.get(id) !== entry) return;
          entry.status = "ready";
          resolve(entry);
        };
        image.onload = () => {
          // Decode off the main thread before the first canvas draw needs the
          // pixels; a failed decode still leaves a drawable loaded image.
          if (typeof image.decode === "function")
            image.decode().then(ready, ready);
          else ready();
        };
        image.onerror = () => {
          entry.status = "failed";
          resolve(entry);
        };
        image.decoding = "async";
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
