import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const manifestPath = fileURLToPath(
  new URL("./public/whales/manifest.json", import.meta.url),
);

/**
 * `import specimens from "virtual:whale-manifest"` bundles the collection into
 * the hashed JavaScript, so specimens can render without a runtime fetch. The
 * file in public/ stays the single source and is still published as-is.
 */
function whaleManifest() {
  const id = "virtual:whale-manifest";
  return {
    name: "whale-manifest",
    resolveId: (source) => (source === id ? `\0${id}` : undefined),
    load(resolved) {
      if (resolved !== `\0${id}`) return;
      this.addWatchFile(manifestPath);
      const specimens = JSON.parse(readFileSync(manifestPath, "utf8"));
      return `export default ${JSON.stringify(specimens)};`;
    },
  };
}

/**
 * Hint the hashed files each page always needs, so the browser fetches them in
 * parallel with the entry bundle instead of discovering them one level at a
 * time: the body font on both pages, and the lazily imported lab on lab.html.
 */
function criticalPreloads() {
  let base = "/";
  return {
    name: "critical-preloads",
    apply: "build",
    configResolved(config) {
      base = config.base;
    },
    transformIndexHtml: {
      order: "post",
      handler(html, { bundle, filename }) {
        if (!bundle) return html;
        const files = Object.values(bundle);
        const tags = [];
        const font = files.find((file) =>
          /dm-sans-latin-wght-normal-[\w-]+\.woff2$/.test(file.fileName),
        );
        if (font)
          tags.push({
            tag: "link",
            attrs: {
              rel: "preload",
              href: base + font.fileName,
              as: "font",
              type: "font/woff2",
              crossorigin: true,
            },
            injectTo: "head",
          });
        if (filename.endsWith("lab.html")) {
          const lab = files.find(
            (file) =>
              file.type === "chunk" &&
              file.facadeModuleId?.endsWith("/src/SpliceLab.jsx"),
          );
          if (lab) {
            for (const css of lab.viteMetadata?.importedCss ?? [])
              tags.push({
                tag: "link",
                attrs: { rel: "stylesheet", href: base + css },
                injectTo: "head",
              });
            tags.push({
              tag: "link",
              attrs: { rel: "modulepreload", href: base + lab.fileName },
              injectTo: "head",
            });
          }
        }
        return { html, tags };
      },
    },
  };
}

export default defineConfig({
  base: "/TheWhale/",
  plugins: [react(), whaleManifest(), criticalPreloads()],
  build: { rollupOptions: { input: ["index.html", "lab.html"] } },
});
