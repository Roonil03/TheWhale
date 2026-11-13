# The Whale

A field guide to the spouting whale emoji, with a browser-based splice lab for combining specimens. The deployed site is at [roonil03.github.io/TheWhale/](https://roonil03.github.io/TheWhale/).

## Develop

Use Node.js 22.12 or newer and npm:

```sh
npm ci
npm run dev
```

Vite prints the local development URL. Run `npm run lint`, `npm test`, and `npm run build` before submitting changes. `npm run preview` serves the production build locally.

The React application lives in `src/`; static specimens and their manifest live in `public/whales/`. The splice is rendered in the browser; it does not upload your creation to a server. Public assets are copied to `dist/`, and Vite emits fingerprinted JavaScript and CSS assets.

## Deployment

In the repository settings, select **Pages → Build and deployment → GitHub Actions**. The workflow checks pull requests and pushes to `main`, then publishes `dist/` only after the checks pass on `main`. Vite's base path is `/TheWhale/`, matching this repository's project Pages URL. GitHub Pages controls HTTP caching headers; this repository does not configure custom response headers.

The pull request template is adapted from [go-sql-driver/mysql](https://github.com/go-sql-driver/mysql/blob/master/.github/PULL_REQUEST_TEMPLATE.md).
