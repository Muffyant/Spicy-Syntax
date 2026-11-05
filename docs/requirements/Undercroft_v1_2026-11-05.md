# Undercroft v1

Requirement pack for the Stockroom Grimoire · 5 November 2026 · proposed for the owner's approval · built here on the demo blends, then released to the live Stockroom

The Undercroft is a mirrored copy of every live blend where the owner, the Flavour tab's Ask Claude and the agent team can try recipe changes without touching what is made and sold. Each variant is compared with the live blend on grams, cost, flavour and allergens. Nothing reaches a live recipe until the owner promotes it, and the version it replaces is kept. It gets its own tab after Flavour.

## Why

Four things in the current build make recipe experiments risky.

1. A Flavour tab suggestion opened "on the blend itself" overwrites the live recipe when it's saved. `saveRecipe` takes no restore point of its own, so the only way back is a restore point, usually the day's first, which also rolls back everything saved since. Restore points are pruned to the newest seven.
2. A suggestion opened "as a new draft" is saved into the live recipe list as `<blend> draft`, in the "In development" group, beside blends that are made and sold.
3. A batch log entry is `{ts, recipe, packs, code, bestBefore}`. It names the blend and says nothing about its formula, so once a recipe changes nobody can tell which formula an earlier batch used.
4. Ingredients have no allergen field, so no screen warns when a change adds celery, mustard or sesame.

The agent team adds a fifth reason. Its research agents will propose blend and supplier changes every month, and those need somewhere to land that cannot write the live record.

## Requirements

Must items are needed before the Undercroft reaches the live Stockroom. Should items can follow. Each "Done when" is a test, written before the code it covers, exception paths first as CLAUDE.md asks.

### UC-01 Its own storage (Must)

The Undercroft is stored under `${STORE_KEY}_undercroft`, which is `sos_stockroom_v1_undercroft` in the live build, `sos_stockroom_sandbox_v1_undercroft` in preview and `sos_stockroom_demo_v1_undercroft` here. Every read and write goes through `store`, so `canWrite` keeps each build inside its own keys. Only Promote (UC-08) writes the stockroom record itself. The record stays well under the storage limit, and the tab warns if it ever passes the archive threshold (`ARCHIVE_AT_CHARS`).

Done when a test that spies on storage shows mirroring, adding, comparing, importing and setting aside never write `STORE_KEY`.

### UC-02 Fails without harm (Must)

A missing, unreadable or damaged Undercroft never stops the stockroom loading. The tab shows its own message and offers a fresh mirror, and nothing is written until the owner chooses. A damaged record is first set aside under `${STORE_KEY}_undercroft_quarantine_<time>`, the way the stockroom's own recovery screen sets a damaged record aside.

Done when a test with a corrupt Undercroft record loads the stockroom normally and writes nothing.

### UC-03 Mirror (Must)

"Mirror the live blends" copies every recipe (`name`, `sku`, `packSizeG`, `lines`, `pkgOverride`, `priceOverride`) and the ingredient data needed to cost and profile them (`costPerG`, `stdCostPerG`, `packSizeG`, `supplier`, `allergens` and the flavour overrides). Each mirrored original carries `mirroredAt` and a fingerprint of its lines, and is read-only. Refreshing the mirror updates the originals only. Variants keep the lines and fingerprint they were made from, and any variant whose base has changed since is marked "base changed".

Done when one test shows an original can't be edited and another shows a refresh keeps every variant and marks only those whose base changed.

### UC-04 Variants (Must)

A variant is named `<blend> U<n>`, numbered per blend, and a number is never reused. It holds:

- `base`, `baseFingerprint` and the full `lines`
- `proposedBy`: Owner, Ask Claude, Seer or Quartermaster
- `reason` (up to 600 characters), `evidence` (URLs) and `createdAt`
- `status`: open, set aside or promoted
- `newIngredients` for anything not in stock, each with its quoted rate, pack size, supplier, source URL and allergens. When it's the same spice from another supplier, `flavourAs` names the flavour library entry it shares.

The owner can edit their own variants. A variant from Ask Claude or an agent is never edited. "Copy to a new variant" makes an editable copy, so every proposal stays as it was made. Nothing is deleted in v1, and set-aside variants stay listed under their own heading.

### UC-05 Compare (Must)

Each variant shows, against the live blend:

- every changed line, in grams from and to
- cost per pack at carrying cost with planning cost beside it, and the margin at the blend's sell price, all from the recipe editor's own `costOf` and packaging rules, with no second costing path
- the Flavour tab's radar and axis table, "Now" against the variant, with salt %, sugar % and Scoville heat
- pack-weight drift by the recipe editor's 2% rule, leaving out counted "(units)" lines as the editor does
- allergens gained or lost (UC-07)

A new ingredient with no purchases is costed at its quoted rate and labelled "quoted". One missing from the flavour library is listed as "not profiled", which `profileOf` already reports through `unknown`.

Done when, in the demo, Ember Imp U1 (Brown Sugar down 4 g to 22.67 g, Mustard Powder 4 g added, still 80 g) shows £0.09 more per pack and "gains mustard".

### UC-06 Exchange with agents by file (Must)

"Export for agents" downloads `Undercroft_Export_vN_YYYY-MM-DD.json` (schema `sos.undercroft.export.v1`). It holds the mirrored blends with their fingerprints, ingredient rates, allergens, flavour data, packaging costs and sell prices, and nothing else. Sales, purchases, events and the batch log stay out. The owner saves the file to Dropbox, where the agents read it.

"Import variants" takes a `sos.undercroft.variants.v1` file or paste and shows what it will add before adding it, as the full import already does. Each entry uses the shape the Flavour tab already asks Claude for (`summary`, `lines`, `changes`, `newIngredients`, `watch`, `confidence`), plus `base`, `baseFingerprint`, `proposedBy`, `reason` and `evidence`, so `readProposal` can check both. The import refuses the whole file, and writes nothing, if any entry names a blend that isn't mirrored, changes a mirrored original, or lacks `proposedBy` or `reason`. It flags but accepts a drift over 2% or an ingredient not in stock, and marks "base changed" when `baseFingerprint` no longer matches.

An entry looks like this, using demo data:

```json
{
  "schema": "sos.undercroft.variants.v1",
  "createdAt": "2026-11-05T09:00:00Z",
  "variants": [
    {
      "base": "Ember Imp",
      "baseFingerprint": "copied from the export",
      "proposedBy": "Seer",
      "reason": "Less sweetness and a mustard bite for pork.",
      "evidence": ["https://example.com/source"],
      "summary": "Swap 4 g of brown sugar for mustard powder.",
      "lines": [
        { "ingredient": "Brown Sugar", "perPackG": 22.67 },
        { "ingredient": "Smoked Paprika", "perPackG": 14.81 },
        { "ingredient": "Chilli Flakes", "perPackG": 8.89 },
        { "ingredient": "Cayenne", "perPackG": 4.44 },
        { "ingredient": "Garlic Granules", "perPackG": 7.41 },
        { "ingredient": "Sea Salt", "perPackG": 11.85 },
        { "ingredient": "Cumin", "perPackG": 5.93 },
        { "ingredient": "Mustard Powder", "perPackG": 4 }
      ],
      "changes": [
        { "ingredient": "Brown Sugar", "fromG": 26.67, "toG": 22.67, "why": "Less sweet" },
        { "ingredient": "Mustard Powder", "fromG": 0, "toG": 4, "why": "Sharpness for pork" }
      ],
      "newIngredients": [],
      "watch": ["Adds mustard, a declarable allergen"],
      "confidence": "medium"
    }
  ]
}
```

Done when each of the three refusals has a test showing nothing written, and a good file adds Ember Imp U1 and U2.

### UC-07 Allergens (Must)

Ingredients gain an optional `allergens` list, chosen only from the 14 that UK food businesses must declare: celery, cereals containing gluten, crustaceans, eggs, fish, lupin, milk, molluscs, mustard, peanuts, sesame, soybeans, sulphur dioxide and sulphites, and tree nuts ([FSA allergen guidance](https://www.gov.uk/government/publications/allergen-guidance-for-food-businesses/allergen-guidance-for-food-businesses)). It is set in the ingredient editor and the bulk upload. A blend's allergens are those of its lines combined. An ingredient nobody has checked shows "not checked", never "none", so an empty list is never read as allergen-free. The demo seed marks Celery Salt with celery and Mustard Powder with mustard.

Done when an unchecked ingredient reads "not checked" and Ember Imp U1 reports "gains mustard".

### UC-08 Promote (Must)

Only the owner promotes, from the Undercroft tab, with the app's two-step confirm. Promotion is blocked when:

- the lines drift more than 2% from the pack weight, because the pack wouldn't weigh what the label says
- the variant uses an ingredient that isn't in the live ingredient list yet, which has to be added there first
- the base has changed since the variant was made
- allergens change and "labels updated for the new allergens" isn't ticked, because a prepacked label must emphasise each allergen wherever it appears in the ingredients list (same FSA guidance)

Promotion then takes a restore point with the reason `promote`, labelled "Before promoting a variant". If it can't, nothing changes and the app shows its usual "Couldn't take a restore point first" message. It replaces the live blend's lines and nothing else, raises the blend's `version` by one (a blend without one counts as version 1), saves the replaced formula in the Undercroft as a read-only `<blend> v<n>` entry, and marks the variant promoted. Batches logged afterwards carry `recipeVersion`. To go back, copy the old version into a new variant and promote that.

These fields only add to the record, so `DATA_SCHEMA` rises to 3 and the existing upgrade restore point runs before the first save.

Done when tests show that a failed restore point changes nothing, the restore point is written before the stockroom record, the live lines match the variant, version 1 is kept in the Undercroft, and the next batch logged has `recipeVersion: 2`.

### UC-09 Ask Claude saves to the Undercroft (Should)

A Flavour tab suggestion gets "Save to the Undercroft" as its first action, recorded with `proposedBy` Ask Claude and the request as the reason, keeping the summary and watch notes. The two existing actions stay, and the one that edits the live blend says so in its label. A one-off "Move drafts here" copies any `<blend> draft` recipes in the "In development" group into the Undercroft as variants. The owner then deletes the drafts from the live list.

### UC-10 Private names stay out of this repo (Should)

CI fails if any name in a `PRIVATE_NAMES` repository secret (real blends, ingredients and suppliers, one per line) appears in the tree, printing only the file path. This carries the private-name scan used when the demo was generated (#4) into every pull request, now that agents work here too.

## Out of scope for v1

Agents writing to the Grimoire directly, since they work by file. Automatic promotion of anything. Changing pack size, SKU or price through a variant. Sharing one Undercroft between browsers or devices.

## Getting it to the live Stockroom

1. Build and test here on the demo blends. CI passes and the owner merges.
2. Tag a release. The demo deploys from it.
3. Run the release as a preview build on the sandbox key with live data copied in, and promote one variant there.
4. Publish it as the live build with `BUILD = "live"`.

Step 4 has a trap. `applyRecord` merges every seed blend and ingredient into a loaded record unless it's listed in `deleted`, so a live build that kept the demo seed would add six demo blends and 20 demo ingredients to the real stockroom. The live build has to swap in its own seed outside GitHub, or ship with an empty seed once a test shows a full saved record loads the same without one.

## Order of work

Three pull requests, each small enough to review in one sitting:

1. UC-01 to UC-05: storage, mirror, variants and compare. Nothing in this slice writes the stockroom record.
2. UC-07 and UC-08: allergens, promotion, recipe versions and schema 3.
3. UC-06, UC-09 and UC-10: file exchange, the Ask Claude route and the private-name check.
