import "@fontsource-variable/dm-sans/wght.css";
import "@fontsource/dm-mono/latin-400.css";
import "@fontsource/dm-mono/latin-500.css";
import "./game-shell.css";
import "./race-ui.css";
import { createRaceUI } from "./race-ui.js";

const callbacks = {};
const ui = createRaceUI({
  root: document.getElementById("game-ui"),
  onStart: () => callbacks.start?.(),
  onPause: (paused) => callbacks.pause?.(paused),
  onRestart: () => callbacks.restart?.(),
  onCamera: (id) => callbacks.camera?.(id),
  onInput: (input) => callbacks.input?.(input),
  onSound: (muted) => callbacks.sound?.(muted),
});

ui.update({ phase: "loading", camera: "chase", muted: false });

try {
  if (!window.isSecureContext) {
    throw new Error(
      "WebGPU needs a secure connection. Open this game on localhost or over HTTPS.",
    );
  }
  if (!navigator.gpu) {
    throw new Error(
      "This underwater world needs WebGPU. Try a current Chrome or Edge with graphics acceleration enabled.",
    );
  }
  const { startGarden } = await import("virtual:abyssal-engine");
  await startGarden({ ui, callbacks });
} catch (error) {
  console.error("Whale race could not start:", error);
  ui.update({
    phase: "error",
    error: {
      code: /webgpu|adapter|secure/i.test(error.message) ? "webgpu" : "startup",
      message:
        error.message ||
        "The underwater world could not start. Reload to try again.",
    },
  });
}
