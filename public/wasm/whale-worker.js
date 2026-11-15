const base = new URL("../wasm/", self.location.href);

// The pre-rendered SVG stays on screen whenever this worker reports an error,
// so skip the 3 MB module for visitors who asked to save data or are on a slow link.
const constrained = () => {
  const connection = self.navigator?.connection;
  return Boolean(
    connection &&
      (connection.saveData ||
        ["slow-2g", "2g", "3g"].includes(connection.effectiveType)),
  );
};

async function instantiate(url, imports) {
  const response = fetch(url);
  if (WebAssembly.instantiateStreaming) {
    try {
      // Compiles while the bytes arrive instead of after the download ends.
      return await WebAssembly.instantiateStreaming(response, imports);
    } catch (error) {
      // A server without the application/wasm type rejects streaming; others are real failures.
      if (!(error instanceof TypeError)) throw error;
    }
  }
  const fallback = await response;
  if (!fallback.ok) throw new Error("Wasm unavailable");
  return WebAssembly.instantiate(await fallback.arrayBuffer(), imports);
}

self.onmessage = async () => {
  try {
    if (constrained()) throw new Error("Constrained connection");
    self.importScripts(new URL("wasm_exec.js", base).href);
    const go = new self.Go();
    const { instance } = await instantiate(
      new URL("whale.wasm", base),
      go.importObject,
    );
    go.run(instance);
    const paths = self.renderWhale();
    self.postMessage({ paths: paths.split("\n").filter(Boolean) });
  } catch {
    self.postMessage({ error: true });
  }
};
