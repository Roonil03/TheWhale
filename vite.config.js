import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { abyssalEngine, gameRoutes } from "./tools/game-plugin.mjs";

export default defineConfig({
  base: "/TheWhale/",
  plugins: [react(), abyssalEngine(), gameRoutes()],
  build: {
    rollupOptions: { input: ["index.html", "lab.html", "game/index.html"] },
  },
});
