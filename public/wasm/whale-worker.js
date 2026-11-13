const base = new URL("../wasm/", self.location.href);
self.onmessage = async () => {
  try {
    self.importScripts(new URL("wasm_exec.js", base).href);
    const go = new self.Go();
    const response = await fetch(new URL("whale.wasm", base));
    if (!response.ok) throw new Error("Wasm unavailable");
    const bytes = await response.arrayBuffer();
    const { instance } = await WebAssembly.instantiate(bytes, go.importObject);
    go.run(instance);
    const paths = self.renderWhale();
    self.postMessage({ paths: paths.split("\n").filter(Boolean) });
  } catch {
    self.postMessage({ error: true });
  }
};

