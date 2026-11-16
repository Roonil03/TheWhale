# The Whale

A field guide to the spouting whale emoji, with a browser-based splice lab for combining specimens. The deployed site is at [roonil03.github.io/TheWhale/](https://roonil03.github.io/TheWhale/).

Dark mode is the default. Use the header theme button for light mode; your choice stays in this browser. Search twenty current and historical renderings by platform or version, load a specimen into the lab, then choose its spout, head, body and tail independently. The lab exports a transparent PNG and creates a URL that restores the recipe.

## Splice editor

The editor has its own page at [lab.html](https://roonil03.github.io/TheWhale/lab.html). Select Spout, Head, Body or Tail, choose its source artwork, and drag the selected slice around the canvas. The corner handle resizes the slice and its top handle rotates it. The inspector offers precise X/Y, width, height and rotation controls; Reset part restores only that part's transform.

Undo and Redo retain up to fifty edits, including source changes, seam adjustments, transformations, shuffle and reset. A completed pointer gesture is one edit; Escape cancels it. While the canvas is focused, arrow keys nudge the selected part by one pixel, or ten with Shift. Ctrl/Cmd+Z undoes; Ctrl/Cmd+Shift+Z or Ctrl+Y redoes. Text fields keep their normal editing shortcuts.

PNG export contains the transparent 1200×1200 canvas, without selection outlines or controls. Parts outside the canvas are clipped. Share links retain sources, seam strength and transforms; older source-only recipes still open correctly. The home gallery links into this dedicated editor and does not load its interaction code until needed.

The lab requests only the distinct artwork selected in the recipe and reuses loaded images when revisiting a source. The default recipe needs four image files (91,968 source bytes), rather than all twenty (661,626 source bytes). These are file sizes before HTTP compression, not measured network transfer sizes. Failed sources offer an explicit retry. Each editor caches at most four masked canvas slices, so transform-only redraws allocate no new masking canvases; changing a source remasks its slice, while changing seam strength remasks the three lower slices. Pointer updates follow animation frames and commit the final release position as one undoable edit.

## Develop

Use Node.js 22.22 or newer in the Node 22 line, or Node.js 24.8 or newer, and npm:

```sh
npm ci
npm run dev
```

Vite prints the local development URL. Run `npm run lint`, `npm test`, `npm run build`, and `npm run verify:build` before submitting changes. `npm run preview` serves the production build locally.

The React application lives in `src/`; static specimens and their manifest live in `public/whales/`. The splice is rendered in the browser; it does not upload your creation to a server. Public assets are copied to `dist/`, and Vite emits fingerprinted JavaScript and CSS assets.

The ESLint dependency tree temporarily overrides minimatch to version 11 for [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249). Remove the overrides when ESLint and `@eslint/config-array` depend on a patched version; recheck linting when updating either dependency because this crosses a major version.

## Deployment

In the repository settings, select **Pages → Build and deployment → GitHub Actions**. The workflow checks pull requests and pushes to `main`, then publishes `dist/` only after the checks pass on `main`. Vite's base path is `/TheWhale/`, matching this repository's project Pages URL. GitHub Pages controls HTTP caching headers; this repository does not configure custom response headers.

The pull request template is adapted from [go-sql-driver/mysql](https://github.com/go-sql-driver/mysql/blob/master/.github/PULL_REQUEST_TEMPLATE.md).

## Project skills and provenance

The converted Codex skills are installed locally in `.agents/skills/` and deliberately excluded from Git. [Source application](docs/SKILL-APPLICATION.md) records the concrete use of each requested reference; [design decisions](docs/DESIGN.md) explains the single animation choice and production tradeoffs. [Artwork provenance](docs/ASSETS.md) records vendor versions, sources and separate licensing terms. The project license does not relicense vendor artwork.

The tests also render the actual compositor offline and decode its PNG output, checking source regions, softened boundaries and transparency. The canvas test library is a development dependency and is excluded from the website bundle.

Pages publication uses GitHub's deployment REST API and the runner's short-lived OIDC token. The small dependency-free deployment client replaces the upstream action's deprecated dependency and fails on API errors, terminal deployment failures, or a bounded timeout; its state transitions are tested. Tokens stay in memory and are never printed.

The splice lab lives at `lab.html`; legacy recipe links redirect there. The home-page whale is a hidden-line 3D scene rendered on first visibility by `ln` compiled to WebAssembly, in a short-lived worker. A pre-rendered SVG remains available if workers or WebAssembly fail, and for reduced-motion preferences. The checked-in WASM was built with Go 1.27.1: from `tools/lineart`, run `GOOS=js GOARCH=wasm go build -trimpath -ldflags="-s -w" -o ../../public/wasm/whale.wasm ./wasm`, and copy the matching Go `lib/wasm/wasm_exec.js` to `public/wasm/`.

## Whale race

The local `game/` route adds a race between two whales through [Abyssal Garden](https://github.com/Noniv/abyssal-garden). You swim as a pale lime humpback against a larger blue-black rival; both are the same procedural mesh from `src/game/whale-mesh.js`, animated in the racer shader, with no downloaded models. The procedural WebGPU world is adapted from revision `a596354eff400d458bc2aeb9bdf5e0a9734b2bcf` by Maksymilian Dendura, under the MIT license. Source and license are retained in `src/game/vendor/abyssal/`.

The game has its own entry point, so the gallery and splice lab do not load the renderer. WebGPU requires a supported browser and a secure context, either HTTPS or localhost.

Hold `W` to swim along your current heading and `Shift` to boost. Turn with `A`/`D` and pitch up or down with the arrow keys. Your heading stays where you leave it, so you must steer around bends and rocks. Switch between chase, first-person, side, and overhead cameras with `C` or `1`–`4`. `P` or Escape pauses. Phones supply thrust automatically, with a steering pad, a Swim toggle and hold-to-Boost. Steer through the rings to recover stamina and gain a short surge. Missing a ring causes brief turbulence; the next ring is a fresh chance. The marked course follows the original world's flythrough.
