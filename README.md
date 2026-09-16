# The Stockroom Grimoire — portable build

Inventory, batch, and margin control for Sages of Spice. Single-component React app,
extracted from the Claude artifact into a standard Vite project.

## Run it
    npm install
    npm run dev

## What changed vs the artifact
One thing only: storage. `src/storage.js` is an adapter — it uses Claude's
`window.storage` when running as an artifact, and `localStorage` everywhere else
(Vite, Lovable, any static host). All data stays in the browser that created it.

## For Claude Code
- Specs live in Dropbox: `Sages of Spice HQ/Product & Integrations/` —
  `integration-standard-technical.md` is the binding build spec (milestones M1–M8,
  exception matrix §7, acceptance criteria §10). Treat it as the contract.
- This app is the reference client. Milestone M1 replaces `storage.js` with API
  calls to `/v1/state` per the spec; nothing else should need to change.
- The canonical data schema is `sos.stockroom.v1` (see the in-app Data tab export).
- QA harness pattern: jsdom + React 18 + mocked storage; exception paths get tests
  before happy paths (spec §10 global DoD).

## Data note
This is the DEMO twin: every blend, ratio and supplier in `src/App.jsx` is fictional.
The build with the real recipe data (the business's IP) is kept separately and must
only ever live in a private repository.
