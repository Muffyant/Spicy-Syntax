# The Stockroom Grimoire — demo edition

[![CI](https://github.com/Muffyant/Spicy-Syntax/actions/workflows/ci.yml/badge.svg)](https://github.com/Muffyant/Spicy-Syntax/actions/workflows/ci.yml)
[![Deploy](https://github.com/Muffyant/Spicy-Syntax/actions/workflows/deploy.yml/badge.svg)](https://github.com/Muffyant/Spicy-Syntax/actions/workflows/deploy.yml)

**Live demo:** https://muffyant.github.io/Spicy-Syntax/

Inventory, batch and margin control for a small spice-blend business. A single-component
React app, extracted from a Claude artifact into a standard Vite project.

Every blend, ratio and supplier in this repository is **fictional demo data**. The build
with the real recipes is kept separately in a private repository.

## Run it

    npm install
    npm run dev

Then open the URL Vite prints (usually http://localhost:5173).

## Check it

    npm test        # Vitest + jsdom, storage mocked
    npm run build   # production bundle in dist/

Both run in CI on every push and pull request. Every push to `main` also rebuilds the
live demo and publishes it to GitHub Pages (see `.github/workflows/deploy.yml`).

## How it is put together

- `src/App.jsx` — the whole app, deliberately one file for parity with the artifact.
- `src/storage.js` — the only place storage is touched. It uses Claude's `window.storage`
  when running as an artifact and `localStorage` everywhere else. All data stays in the
  browser that created it.
- `src/__tests__/` — tests follow the project rule: exception paths first, then happy paths.
- `CLAUDE.md` — working rules for anyone using Claude Code on this repo.

The app exports and imports its full state as one versioned JSON document
(`sos.stockroom.v1`, see the in-app Data tab). That schema is the contract a future hosted
API would serve; the integration spec that governs that work is internal and not in this
repository.

## License

MIT — see [LICENSE](LICENSE).
