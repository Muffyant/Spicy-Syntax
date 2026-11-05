# Project context for Claude Code
- Single-file React app: src/App.jsx (~4.3k lines including the flavour engine and library, deliberately one file for artifact parity — do not split without being asked).
- Storage goes through src/storage.js ONLY. Never call localStorage directly in App.jsx.
- Costing rules: carrying cost = weighted average of purchases (costPerG); planning cost = stdCostPerG; recipes cost at carrying, shopping lists at standard.
- Units convention: ingredients named "(units)" are counted items (bottles, corks, bags), 1g = 1 unit; they are excluded from recipe gram-sum validation.
- Money: all costs VAT-inclusive (owner not VAT-registered). Per-recipe overrides: pkgOverride (packaging £), priceOverride (sell £).
- The integration spec (internal, not in this repo) governs any API/back-end work: build strictly in milestone order, every exception row needs a test first.
- This repository is public. Never put a real blend, ratio, ingredient cost or supplier name in code, tests, commits, issues or pull requests. Work here uses the fictional demo data only.
- Requirement packs live in docs/requirements/ and are named Name_vN_YYYY-MM-DD.md. A revision is a new file, so earlier versions stay readable.
