import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/TheWhale/",
  plugins: [react()],
  build: { rollupOptions: { input: ["index.html", "lab.html"] } },
});
