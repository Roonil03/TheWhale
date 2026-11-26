import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../src/game/", import.meta.url));
const parts = [
  "vendor/abyssal/quality.js",
  "vendor/abyssal/math.js",
  "vendor/abyssal/shaders.js",
  "vendor/abyssal/world.js",
  "vendor/abyssal/main.js",
  "race-engine.js",
  "vendor/abyssal/audio.js",
];

// The upstream modules intentionally share a lexical scope. Keep that contract
// inside an isolated, lazy-loaded startup function instead of publishing globals.
export function abyssalEngine() {
  const id = "virtual:abyssal-engine";
  return {
    name: "abyssal-engine",
    resolveId(source) {
      return source === id ? `\0${id}` : undefined;
    },
    load(resolved) {
      if (resolved !== `\0${id}`) return;
      const code = parts.map((part) => {
        const filename = root + part;
        this.addWatchFile(filename);
        return `\n// ${part}\n${readFileSync(filename, "utf8")}`;
      });
      return `import * as raceModel from "/src/game/race-model.js";
import { segmentBoxEntry, firstPersonEye, chaseBoom, sideDistance, insideBody } from "/src/game/camera-model.js";
import { buildWhale, WHALE } from "/src/game/whale-mesh.js";
export async function startGarden({ ui: raceUI, callbacks }) {
${code.join("\n")}
}`;
    },
  };
}

// Vite's SPA fallback would otherwise serve the gallery at /game without a
// trailing slash. The deployed game is a directory page under the site base.
export function gameRoutes() {
  let base = "/";
  const install = (server) => {
    server.middlewares.use((request, response, next) => {
      const url = new URL(request.url, "http://localhost");
      if (
        ["/game", "/game/", `${base}game`].includes(url.pathname) &&
        url.pathname !== `${base}game/`
      ) {
        response.writeHead(302, { Location: `${base}game/${url.search}` });
        response.end();
        return;
      }
      next();
    });
  };
  return {
    name: "game-routes",
    configResolved(config) {
      base = config.base;
    },
    configureServer: install,
    configurePreviewServer: install,
  };
}
