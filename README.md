# The Whale

A field guide to the spouting whale emoji, with a browser-based splice lab for combining specimens. The deployed site is at [roonil03.github.io/TheWhale/](https://roonil03.github.io/TheWhale/).

Dark mode is the default. Use the header theme button for light mode; your choice stays in this browser. Search the collection, load a specimen into the lab, then choose its spout, head, body and tail independently. The lab exports a transparent PNG and creates a URL that restores the recipe.

## Develop

Use Node.js 22.22 or newer in the Node 22 line, or Node.js 24.8 or newer, and npm:

```sh
npm ci
npm run dev
```

Vite prints the local development URL. Run `npm run lint`, `npm test`, `npm run build`, and `npm run verify:build` before submitting changes. `npm run preview` serves the production build locally.

The React application lives in `src/`; static specimens and their manifest live in `public/whales/`. The splice is rendered in the browser; it does not upload your creation to a server. Public assets are copied to `dist/`, and Vite emits fingerprinted JavaScript and CSS assets.

## Deployment

In the repository settings, select **Pages → Build and deployment → GitHub Actions**. The workflow checks pull requests and pushes to `main`, then publishes `dist/` only after the checks pass on `main`. Vite's base path is `/TheWhale/`, matching this repository's project Pages URL. GitHub Pages controls HTTP caching headers; this repository does not configure custom response headers.

The pull request template is adapted from [go-sql-driver/mysql](https://github.com/go-sql-driver/mysql/blob/master/.github/PULL_REQUEST_TEMPLATE.md).

## Project skills and provenance

Codex discovers the converted project skills in `.agents/skills/`. [Source application](docs/SKILL-APPLICATION.md) records the concrete use of each requested reference; [design decisions](docs/DESIGN.md) explains the single animation choice and production tradeoffs. [Artwork provenance](docs/ASSETS.md) records vendor versions, sources and separate licensing terms. The project license does not relicense vendor artwork.

The tests also render the actual compositor offline and decode its PNG output, checking source regions, softened boundaries and transparency. The canvas test library is a development dependency and is excluded from the website bundle.

The splice lab lives at `lab.html`; legacy recipe links redirect there. The home-page whale is a hidden-line 3D scene rendered on first visibility by `ln` compiled to WebAssembly, in a short-lived worker. A pre-rendered SVG remains available if workers or WebAssembly fail, and for reduced-motion preferences. The checked-in WASM was built with Go 1.27.1: from `tools/lineart`, run `GOOS=js GOARCH=wasm go build -trimpath -ldflags="-s -w" -o ../../public/wasm/whale.wasm ./wasm`, and copy the matching Go `lib/wasm/wasm_exec.js` to `public/wasm/`.
