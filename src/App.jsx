import { Fragment, useState, useEffect, useMemo, useCallback, useRef, memo } from "react";
import { appStorage } from "./storage.js";

// ============ SEED DATA (fictional demo blends, ratios and suppliers) ============
// The build with the real recipes lives in a private repository.
const SEED = {"ingredients":[{"name":"Black Pepper","costPerG":0.016,"packSizeG":500,"supplier":"wholesale-spices.example","stockG":0},{"name":"Brown Sugar","costPerG":0.003,"packSizeG":500,"supplier":"wholesale-spices.example","stockG":0},{"name":"Cayenne","costPerG":0.0196,"packSizeG":250,"supplier":"wholesale-spices.example","stockG":0},{"name":"Celery Salt","costPerG":0.0047,"packSizeG":500,"supplier":"wholesale-spices.example","stockG":0},{"name":"Chilli Flakes","costPerG":0.014,"packSizeG":250,"supplier":"wholesale-spices.example","stockG":0},{"name":"Cinnamon","costPerG":0.0154,"packSizeG":250,"supplier":"wholesale-spices.example","stockG":0},{"name":"Coriander","costPerG":0.0075,"packSizeG":250,"supplier":"wholesale-spices.example","stockG":0},{"name":"Cumin","costPerG":0.016,"packSizeG":250,"supplier":"wholesale-spices.example","stockG":0},{"name":"Garlic Granules","costPerG":0.014,"packSizeG":500,"supplier":"wholesale-spices.example","stockG":0},{"name":"Ginger","costPerG":0.013,"packSizeG":250,"supplier":"wholesale-spices.example","stockG":0},{"name":"Lemon Peel","costPerG":0.03,"packSizeG":100,"supplier":"wholesale-spices.example","stockG":0},{"name":"Mustard Powder","costPerG":0.025,"packSizeG":125,"supplier":"wholesale-spices.example","stockG":0},{"name":"Onion Powder","costPerG":0.007,"packSizeG":500,"supplier":"wholesale-spices.example","stockG":0},{"name":"Oregano","costPerG":0.0156,"packSizeG":250,"supplier":"wholesale-spices.example","stockG":0},{"name":"Rosemary","costPerG":0.0176,"packSizeG":250,"supplier":"wholesale-spices.example","stockG":0},{"name":"Sea Salt","costPerG":0.003,"packSizeG":500,"supplier":"wholesale-spices.example","stockG":0},{"name":"Smoked Paprika","costPerG":0.0115,"packSizeG":500,"supplier":"wholesale-spices.example","stockG":0},{"name":"Star Anise","costPerG":0.068,"packSizeG":100,"supplier":"wholesale-spices.example","stockG":0},{"name":"Sweet Paprika","costPerG":0.0085,"packSizeG":500,"supplier":"wholesale-spices.example","stockG":0},{"name":"Thyme","costPerG":0.0105,"packSizeG":250,"supplier":"wholesale-spices.example","stockG":0}],"recipes":[{"name":"Goblin's Garland","sku":"DEMOGG","packSizeG":70,"batchPacks":10,"lines":[{"ingredient":"Thyme","perPackG":15.56},{"ingredient":"Rosemary","perPackG":12.44},{"ingredient":"Oregano","perPackG":9.33},{"ingredient":"Garlic Granules","perPackG":12.44},{"ingredient":"Sea Salt","perPackG":9.33},{"ingredient":"Black Pepper","perPackG":6.22},{"ingredient":"Lemon Peel","perPackG":4.67}]},{"name":"Frost Giant Fish Rub","sku":"DEMOFG","packSizeG":65,"batchPacks":10,"lines":[{"ingredient":"Sea Salt","perPackG":22.94},{"ingredient":"Lemon Peel","perPackG":13.38},{"ingredient":"Black Pepper","perPackG":11.47},{"ingredient":"Mustard Powder","perPackG":5.74},{"ingredient":"Ginger","perPackG":3.82},{"ingredient":"Coriander","perPackG":7.65}]},{"name":"Ember Imp","sku":"DEMOEI","packSizeG":80,"batchPacks":10,"lines":[{"ingredient":"Brown Sugar","perPackG":26.67},{"ingredient":"Smoked Paprika","perPackG":14.81},{"ingredient":"Chilli Flakes","perPackG":8.89},{"ingredient":"Cayenne","perPackG":4.44},{"ingredient":"Garlic Granules","perPackG":7.41},{"ingredient":"Sea Salt","perPackG":11.85},{"ingredient":"Cumin","perPackG":5.93}]},{"name":"Wyrmwood Wanderer","sku":"DEMOWW","packSizeG":80,"batchPacks":10,"lines":[{"ingredient":"Sweet Paprika","perPackG":24.89},{"ingredient":"Onion Powder","perPackG":14.22},{"ingredient":"Celery Salt","perPackG":12.44},{"ingredient":"Black Pepper","perPackG":8.89},{"ingredient":"Cinnamon","perPackG":3.56},{"ingredient":"Sea Salt","perPackG":16.0}]},{"name":"Arcane Ancho","sku":"DEMOAA","packSizeG":65,"batchPacks":10,"lines":[{"ingredient":"Cumin","perPackG":16.03},{"ingredient":"Coriander","perPackG":8.74},{"ingredient":"Smoked Paprika","perPackG":10.2},{"ingredient":"Star Anise","perPackG":2.33},{"ingredient":"Brown Sugar","perPackG":11.66},{"ingredient":"Sea Salt","perPackG":10.2},{"ingredient":"Chilli Flakes","perPackG":5.83}]},{"name":"Pixie's Picnic","sku":"DEMOPP","packSizeG":70,"batchPacks":10,"lines":[{"ingredient":"Brown Sugar","perPackG":26.25},{"ingredient":"Cinnamon","perPackG":10.94},{"ingredient":"Ginger","perPackG":8.75},{"ingredient":"Sea Salt","perPackG":13.12},{"ingredient":"Sweet Paprika","perPackG":10.94}]}],"finished":{"Goblin's Garland":4,"Frost Giant Fish Rub":2,"Ember Imp":6,"Wyrmwood Wanderer":1,"Arcane Ancho":3,"Pixie's Picnic":5}};

const DEFAULT_SETTINGS = {
  reorderBatches: 2,        // fallback cover when no sales data: N batches of heaviest-drawing blend
  defaultBatchPacks: 10,    // packs per standard batch (recipe pages can scale per brew)
  leadTimeDays: 3,          // main supplier, order to door
  safetyDays: 7,            // demand buffer on top of lead time
  shelfLifeMonths: 12,      // best-before applied to new batches
  packaging: { "Kraft packet": 0.16, "Front label": 0.32, "Back label": 0.24 },   // on every pack, however it is sold
  shippedPackaging: { "Postal box": 1.07 },    // once per posted order, never per pack
  shippedChannels: ["Shopify", "Etsy"],                // channels whose orders go in the post
  sellPrice: 7.99,
  priceLastSynced: null,
  channelFees: { Etsy: { pct: 13.2, fixed: 0.65 }, Shopify: { pct: 2.9, fixed: 0.3 }, Event: { pct: 0, fixed: 0 }, Wholesale: { pct: 0, fixed: 0 }, Other: { pct: 0, fixed: 0 }, Quick: { pct: 0, fixed: 0 }, Direct: { pct: 0, fixed: 0 } },
  freeShipThreshold: 60,    // supplier free-delivery threshold (£) — check your supplier's current figure
  shippingCost: 4.99,       // what a sub-threshold order costs you
  marginFloorPct: 50,       // flag blends whose gross margin drops below this
  lastPriceImpact: null,    // captured on each price refresh
  costBaseline: null,       // {at, source, rates:{name: £/g}}: standard rates just before the last costing upload
  costTiers: { premiumFrom: 25, lowerBelow: 12 }, // £ per kg boundaries for the Cost tiers view
  flavourOverrides: {},     // your edits to the flavour library, by ingredient name
  flavourHistory: [],       // Claude's recent suggestions, newest first
  // modules: turn a capability off when an external integration owns that job (system-of-record delegation)
  modules: { sales: true, purchasing: true, bundles: true, events: true, shrink: true, counts: true, lots: true },
};

// Packaging that only exists on a posted order. Older records kept these in per-pack packaging; they move on load.
const SHIPPED_ONLY = ["Postal box", "Belly band"];

// ---------- storage safety ----------
// BUILD is "live" or "preview" in the private builds; this repository is the demo.
const BUILD = "demo";
const APP_VERSION = "2026.10.15b";
const DATA_SCHEMA = 2;                          // shape of the stored record; upgrades only ever add fields
const LIVE_KEY = "sos_stockroom_v1";            // never changes
const SANDBOX_KEY = "sos_stockroom_sandbox_v1"; // preview builds only
const DEMO_KEY = "sos_stockroom_demo_v1";       // this demo
const STORE_KEY = BUILD === "preview" ? SANDBOX_KEY : BUILD === "demo" ? DEMO_KEY : LIVE_KEY;
const RP_PREFIX = `${STORE_KEY}_rp_`;           // restore points
const ARCHIVE_KEY = `${STORE_KEY}_archive`;     // old history, moved here only as the record nears the 5 MB limit
const QUARANTINE_PREFIX = `${STORE_KEY}_quarantine_`;
const KEEP_RESTORE_POINTS = 7;
const ARCHIVE_AT_CHARS = 4000000;
const KEEP_NEWEST = 200;                        // history rows that always stay in the main record
const HISTORY_FIELDS = ["sales", "log", "purchases", "shrink"];
const NO_POINT_MSG = "Couldn't take a restore point first, so nothing was changed. Try again.";
const RP_LABEL = {
  daily: "Daily", upgrade: "Before upgrading", import: "Before a full import", "sales-import": "Before a sales import",
  "bulk-import": "Before a bulk upload", "price-import": "Before a price refresh", restore: "Before restoring",
  manual: "Made by hand", sandbox: "Before copying live data in",
};
const SECTIONS = [["ings", "Ingredients and packaging"], ["recipes", "Blends"], ["log", "Batches brewed"], ["sales", "Sales"], ["purchases", "Purchases"], ["shrink", "Shrink and gifting"], ["events", "Events"], ["bundles", "Bundles"]];

// Each build can only touch its own keys: live, preview (sandbox) or demo.
const canWrite = (key) => key.startsWith(STORE_KEY);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const keyName = (k) => (typeof k === "string" ? k : (k && (k.key || k.name)) || "");
const rawStorage = () => appStorage; // src/storage.js: Claude's window.storage inside an artifact, localStorage elsewhere

// Every storage call in the app goes through here.
const store = {
  // Never throws. Returns "empty" only when storage itself confirms the key isn't there.
  async read(key) {
    const s = rawStorage();
    if (!s) return { status: "failed" };
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const res = await s.get(key);
        if (res && typeof res.value === "string") return { status: "ok", value: res.value };
      } catch (e) { /* a missing key or a failed call; list() tells them apart */ }
      try {
        const listed = await s.list(key);
        if (listed && Array.isArray(listed.keys) && !listed.keys.some((k) => keyName(k) === key)) return { status: "empty" };
      } catch (e) { /* list failed too, so this counts as a failed read */ }
      if (attempt < 2) await sleep(globalThis.__SOS_TEST__ ? 1 : 400 * (attempt + 1));
    }
    return { status: "failed" };
  },
  async write(key, value) {
    if (!canWrite(key)) throw new Error(`The ${BUILD} build may not write ${key}`);
    const s = rawStorage();
    if (!s) throw new Error("Storage isn't available");
    const res = await s.set(key, value);
    if (!res) throw new Error("Storage didn't accept the write");
  },
  async remove(key) {
    if (!canWrite(key)) throw new Error(`The ${BUILD} build may not delete ${key}`);
    const s = rawStorage();
    if (s) await s.delete(key);
  },
  async keys(prefix) {
    const s = rawStorage();
    if (!s) return [];
    const res = await s.list(prefix);
    return res && Array.isArray(res.keys) ? res.keys.map(keyName).filter((k) => k.startsWith(prefix)) : [];
  },
};
export const __safety = { canWrite, store, BUILD, STORE_KEY, LIVE_KEY, SANDBOX_KEY, DEMO_KEY };

const parseRpKey = (key) => {
  const m = /_rp_(\d+)_([a-z-]+)$/.exec(key);
  return m ? { key, at: Number(m[1]), reason: m[2] } : null;
};
async function listRestorePoints() {
  return (await store.keys(RP_PREFIX)).map(parseRpKey).filter(Boolean).sort((a, b) => b.at - a.at);
}
let lastPointAt = 0;
// Copies exactly what's stored right now. Returns the new key, or null when nothing is stored yet.
// Throws when storage can't be read or written, so the caller stops before changing anything.
async function takeRestorePoint(reason, rawValue) {
  let value = rawValue;
  if (value === undefined) {
    const r = await store.read(STORE_KEY);
    if (r.status === "failed") throw new Error("Couldn't read the current record");
    if (r.status === "empty") return null;
    value = r.value;
  }
  lastPointAt = Math.max(Date.now(), lastPointAt + 1);
  const key = `${RP_PREFIX}${lastPointAt}_${reason}`;
  await store.write(key, JSON.stringify({ kind: "sos.stockroom.restorepoint", createdAt: new Date(lastPointAt).toISOString(), reason, appVersion: APP_VERSION, record: value }));
  try {
    const all = await listRestorePoints();
    for (const old of all.slice(KEEP_RESTORE_POINTS)) await store.remove(old.key);
  } catch (e) { /* pruning can wait until next time */ }
  return key;
}

const RECORD_ARRAYS = ["ings", "recipes", "log", "sales", "events", "shrink", "bundles", "purchases"];
function recordProblem(d) {
  if (!d || typeof d !== "object" || Array.isArray(d)) return "it isn't a stockroom record";
  for (const f of RECORD_ARRAYS) if (f in d && !Array.isArray(d[f])) return `its ${f} section is damaged`;
  for (const f of ["finished", "settings", "deleted"]) if (f in d && (!d[f] || typeof d[f] !== "object" || Array.isArray(d[f]))) return `its ${f} section is damaged`;
  return null;
}
// sos.stockroom.v1 export -> stored record. Sections missing from the file stay missing.
function exportToRecord(d) {
  const map = { ings: "ingredients", recipes: "recipes", finished: "finishedPacks", settings: "settings", log: "batchLog", sales: "sales", events: "events", shrink: "shrink", bundles: "bundles", purchases: "purchases", deleted: "deleted" };
  const rec = { dataSchema: Number(d.dataSchema) || 1 };
  for (const [k, src] of Object.entries(map)) if (d[src] !== undefined && d[src] !== null) rec[k] = d[src];
  return rec;
}

const archiveLimit = () => globalThis.__SOS_ARCHIVE_AT__ || ARCHIVE_AT_CHARS;
// Moves the oldest history out of the main record once it nears the storage limit. Nothing is dropped.
function splitForArchive(record) {
  const limit = archiveLimit();
  if (JSON.stringify(record).length < limit) return null;
  const keep = { ...record };
  const moved = {};
  for (const f of HISTORY_FIELDS) {
    keep[f] = [...(record[f] || [])].sort((a, b) => String(b.ts || "").localeCompare(String(a.ts || "")));
    moved[f] = [];
  }
  let size = JSON.stringify(keep).length;
  while (size > limit * 0.75) {
    let movedAny = false;
    for (const f of HISTORY_FIELDS) {
      const arr = keep[f];
      if (arr.length <= KEEP_NEWEST) continue;
      const cut = Math.min(arr.length - KEEP_NEWEST, Math.max(1, Math.ceil(arr.length / 4)));
      moved[f] = [...arr.slice(arr.length - cut), ...moved[f]];
      keep[f] = arr.slice(0, arr.length - cut);
      movedAny = true;
    }
    if (!movedAny) break;
    size = JSON.stringify(keep).length;
  }
  return HISTORY_FIELDS.some((f) => moved[f].length) ? { keep, moved } : null;
}
async function archiveHistory(moved) {
  const r = await store.read(ARCHIVE_KEY);
  if (r.status === "failed") throw new Error("Couldn't read the archive");
  const prev = r.status === "ok" ? JSON.parse(r.value) : {};
  const next = { kind: "sos.stockroom.archive", updatedAt: new Date().toISOString() };
  for (const f of HISTORY_FIELDS) next[f] = [...(moved[f] || []), ...(Array.isArray(prev[f]) ? prev[f] : [])];
  await store.write(ARCHIVE_KEY, JSON.stringify(next));
  return next;
}

const INITIAL_STATE = { ings: SEED.ingredients, recipes: SEED.recipes, finished: SEED.finished, settings: DEFAULT_SETTINGS, log: [], sales: [], events: [], shrink: [], bundles: [], purchases: [], deleted: { ingredients: [], recipes: [] } };
const fmtDT = (iso) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const VELOCITY_DAYS = 60;             // sales window for velocity
const MIN_SALES_FOR_DEMAND = 5;       // switch to demand-driven reorder once a SKU has this many sales in window
const COUNT_CADENCE = { A: 7, B: 30, C: 90 }; // cycle-count due, days

// ---------- helpers ----------
const gbp = (n) => "£" + (Math.round(n * 100) / 100).toFixed(2);
const g = (n) => (Math.round(n * 10) / 10).toLocaleString("en-GB") + "g";
const batchNeed = (l, packs) => l.perPackG * packs;
const daysAgo = (iso) => (Date.now() - new Date(iso).getTime()) / 86400000;
const addMonths = (d, m) => { const x = new Date(d); x.setMonth(x.getMonth() + m); return x; };
const fmtD = (iso) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const uid = () => Math.random().toString(36).slice(2, 9);
// The Excel library loads the first time it's needed, so it stays out of the first page load.
let XLSX = null;
const xlsxReady = async () => {
  if (!XLSX) {
    try { const mod = await import("xlsx"); XLSX = mod.utils ? mod : mod.default; } catch (e) { return false; }
  }
  return true;
};

export default function App() {
  const [boot, setBoot] = useState({ status: "loading" }); // loading | ready | empty | failed | corrupt | nopoint
  const loaded = boot.status === "ready";
  const badgeSet = useRef(null); // the save badge's own setter: "Saving…" and "Saved" don't re-render the whole page
  const setSaveState = useCallback((st) => { if (badgeSet.current) badgeSet.current(st); }, []);
  const writableRef = useRef(false); // nothing is saved until a read has succeeded or you chose to start fresh
  const [deleted, setDeleted] = useState({ ingredients: [], recipes: [] }); // starting-data items you removed stay removed
  const [archived, setArchived] = useState(null);
  const [restorePoints, setRestorePoints] = useState([]);
  const [pendingImport, setPendingImport] = useState(null);
  const [undo, setUndo] = useState(null); // { key, where, label }
  const [safetyMsg, setSafetyMsg] = useState(null);
  const [confirmKey, setConfirmKey] = useState(null); // two-tap confirmations
  const [recoveryText, setRecoveryText] = useState("");
  const [ings, setIngs] = useState(SEED.ingredients);
  const [recipes, setRecipes] = useState(SEED.recipes);
  const [editRecipe, setEditRecipe] = useState(null); // {orig, name, sku, packSizeG, lines, isNew, search}
  const [finished, setFinished] = useState(SEED.finished);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [log, setLog] = useState([]);        // batches: {ts, recipe, packs, code, bestBefore}
  const [sales, setSales] = useState([]);    // {ts, sku(name), qty, channel}
  const [events, setEvents] = useState([]);  // {id, name, date, targets:{recipeName:qty}}
  const [shrink, setShrink] = useState([]);  // {ts, kind:'ingredient'|'pack', name, qty, reason, value}
  const [bundles, setBundles] = useState([]); // {id, name, items:[recipeName], packagingCost, salePrice}
  const [tab, setTab] = useState("overview");
  const [openRecipe, setOpenRecipe] = useState(null);
  const [openEvent, setOpenEvent] = useState(null);
  const [pickList, setPickList] = useState(null);
  const [confirmBatch, setConfirmBatch] = useState(null); // {r, packs}
  const [brewPacksInput, setBrewPacksInput] = useState(10);
  useEffect(() => { setBrewPacksInput(Math.max(1, settings.defaultBatchPacks || 10)); }, [openRecipe, settings.defaultBatchPacks]);
  const [importText, setImportText] = useState("");
  const [importMsg, setImportMsg] = useState(null);
  const [ingFilter, setIngFilter] = useState("");
  const [saleForm, setSaleForm] = useState({ sku: SEED.recipes[0].name, qty: 1, channel: "Shopify", date: "" });
  const [evForm, setEvForm] = useState({ name: "", date: "" });
  const [shrinkForm, setShrinkForm] = useState({ kind: "pack", name: SEED.recipes[0].name, qty: 1, reason: "Gift" });
  const [builder, setBuilder] = useState({ name: "", items: [SEED.recipes[0].name, SEED.recipes[1].name, SEED.recipes[2].name], packagingCost: 0, shippedPackagingCost: 1.15, salePrice: 19.99 });
  const [csvText, setCsvText] = useState("");
  const [csvChannel, setCsvChannel] = useState("Shopify");
  const [csvMsg, setCsvMsg] = useState(null);
  const [stateIO, setStateIO] = useState("");
  const [ioMsg, setIoMsg] = useState(null);
  const [editIng, setEditIng] = useState(null); // {name(original), newName, supplier, packSizeG, packPrice, parG, isNew}
  const [purchases, setPurchases] = useState([]); // {ts, name, grams, cost, kind:'standard'|'top-up'}
  const [buyForm, setBuyForm] = useState(null); // {name, grams, price}
  const [costSort, setCostSort] = useState("risk");
  const [costAll, setCostAll] = useState(false);
  const [flavourFocus, setFlavourFocus] = useState(null); // {name, at}: opens a blend on the Flavour tab
  const [flavourSeen, setFlavourSeen] = useState(false);
  useEffect(() => { if (tab === "flavour") setFlavourSeen(true); }, [tab]);

  // ---------- load: nothing is saved until storage has answered ----------
  const applyRecord = (d, base) => {
    const dead = {
      ingredients: [...(((d.deleted || base.deleted) || {}).ingredients || [])],
      recipes: [...(((d.deleted || base.deleted) || {}).recipes || [])],
    };
    const deadIng = new Set(dead.ingredients);
    const deadRec = new Set(dead.recipes);
    let nextIngs = base.ings;
    if (d.ings) {
      const saved = Object.fromEntries(d.ings.map((i) => [i.name, i]));
      const seedNames = new Set(SEED.ingredients.map((s) => s.name));
      nextIngs = [
        ...SEED.ingredients.filter((s) => saved[s.name] || !deadIng.has(s.name)).map((s) => (saved[s.name] ? { ...s, ...saved[s.name] } : s)),
        ...d.ings.filter((i) => !seedNames.has(i.name)), // user-added products
      ];
    }
    let nextRecipes = base.recipes;
    if (d.recipes) {
      const saved = Object.fromEntries(d.recipes.map((r) => [r.name, r]));
      const seedNames = new Set(SEED.recipes.map((s) => s.name));
      nextRecipes = [
        ...SEED.recipes.filter((s) => saved[s.name] || !deadRec.has(s.name)).map((s) => (saved[s.name] ? { ...s, ...saved[s.name] } : s)),
        ...d.recipes.filter((r) => !seedNames.has(r.name)),
      ];
    }
    const nextFinished = d.finished
      ? { ...Object.fromEntries(Object.entries(SEED.finished).filter(([k]) => !deadRec.has(k))), ...d.finished }
      : base.finished;
    let nextSettings = base.settings;
    if (d.settings) {
      const pkg = { ...DEFAULT_SETTINGS.packaging, ...(d.settings.packaging || {}) };
      const ship = { ...DEFAULT_SETTINGS.shippedPackaging, ...(d.settings.shippedPackaging || {}) };
      const cf = { ...DEFAULT_SETTINGS.channelFees, ...(d.settings.channelFees || {}) };
      if (cf.Etsy && cf.Etsy.pct === 13 && cf.Etsy.fixed === 0.45) cf.Etsy = { pct: 13.2, fixed: 0.65 }; // calibrated from real statement
      if ("Box / seal" in pkg) delete pkg["Box / seal"]; // the old box cost is replaced by the postal box in posted-order packaging
      SHIPPED_ONLY.forEach((k) => {
        if (!(k in pkg)) return;
        if (!(d.settings.shippedPackaging && k in d.settings.shippedPackaging)) ship[k] = pkg[k];
        delete pkg[k]; // a box or band belongs to a posted order, not to every pack
      });
      const shipCh = Array.isArray(d.settings.shippedChannels) ? d.settings.shippedChannels : DEFAULT_SETTINGS.shippedChannels;
      nextSettings = { ...DEFAULT_SETTINGS, ...d.settings, packaging: pkg, shippedPackaging: ship, shippedChannels: shipCh, channelFees: cf, modules: { ...DEFAULT_SETTINGS.modules, ...(d.settings.modules || {}) } };
    }
    const next = {
      ings: nextIngs, recipes: nextRecipes, finished: nextFinished, settings: nextSettings,
      log: d.log || base.log, sales: d.sales || base.sales, events: d.events || base.events, shrink: d.shrink || base.shrink,
      bundles: d.bundles || base.bundles, purchases: d.purchases || base.purchases, deleted: dead,
    };
    setIngs(next.ings); setRecipes(next.recipes); setFinished(next.finished); setSettings(next.settings);
    setLog(next.log); setSales(next.sales); setEvents(next.events); setShrink(next.shrink);
    setBundles(next.bundles); setPurchases(next.purchases); setDeleted(next.deleted);
    return next;
  };
  const currentState = () => ({ ings, recipes, finished, settings, log, sales, events, shrink, bundles, purchases, deleted });
  const refreshPoints = async () => {
    try { setRestorePoints(await listRestorePoints()); } catch (e) { /* keep the last list */ }
  };

  const load = useCallback(async () => {
    writableRef.current = false;
    setBoot({ status: "loading" });
    // One pass reads the record while one listing answers three questions: is the record there, which restore points exist, is there an archive.
    const s = rawStorage();
    const listing = store.keys(STORE_KEY).then((keys) => ({ ok: true, keys }), () => ({ ok: false, keys: [] }));
    const first = (async () => {
      if (!s) return { status: "failed" };
      try { const res = await s.get(STORE_KEY); return res && typeof res.value === "string" ? { status: "ok", value: res.value } : { status: "missing" }; }
      catch (e) { return { status: "error" }; }
    })();
    const [got, listed] = await Promise.all([first, listing]);
    let r = got;
    if (got.status === "missing" && listed.ok && !listed.keys.includes(STORE_KEY)) r = { status: "empty" }; // two answers agree it isn't there
    else if (got.status !== "ok") r = await store.read(STORE_KEY); // anything unclear takes the careful path, with retries
    if (r.status === "failed") { setBoot({ status: "failed" }); return; }
    let points = [];
    if (listed.ok) points = listed.keys.filter((k) => k.startsWith(RP_PREFIX)).map(parseRpKey).filter(Boolean).sort((a, b) => b.at - a.at);
    else { try { points = await listRestorePoints(); } catch (e) { /* listing is best effort here */ } }
    setRestorePoints(points);
    if (r.status === "empty") {
      if (BUILD === "demo") { writableRef.current = true; setBoot({ status: "ready" }); return; } // the demo opens on its fictional seed
      setBoot({ status: "empty" }); return;
    }
    let d;
    try { d = JSON.parse(r.value); } catch (e) { d = undefined; }
    const problem = d === undefined ? "it isn't readable JSON" : recordProblem(d);
    if (problem) { setBoot({ status: "corrupt", problem, raw: r.value }); return; }
    applyRecord(d, INITIAL_STATE);
    const upgrading = (Number(d.dataSchema) || 1) < DATA_SCHEMA;
    const today = new Date().toDateString();
    const needPoint = !points.some((p) => new Date(p.at).toDateString() === today);
    if (upgrading && needPoint) { // an upgrade still waits for its restore point before anything can save
      try { await takeRestorePoint("upgrade", r.value); setRestorePoints(await listRestorePoints()); }
      catch (e) { setBoot({ status: "nopoint" }); return; }
    }
    writableRef.current = true;
    setBoot({ status: "ready" });
    // Off the critical path: the day's first restore point copies the record exactly as loaded, so later saves can't affect it.
    if (!upgrading && needPoint) {
      (async () => { try { await takeRestorePoint("daily", r.value); setRestorePoints(await listRestorePoints()); } catch (e) { /* tried again on the next load */ } })();
    }
    if (!listed.ok || listed.keys.includes(ARCHIVE_KEY)) {
      (async () => { const a = await store.read(ARCHIVE_KEY); if (a.status === "ok") { try { setArchived(JSON.parse(a.value)); } catch (e) { /* an unreadable archive is left alone */ } } })();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  // ---------- save: one whole record, and only after a good load ----------
  const persist = useCallback(async (next) => {
    if (!writableRef.current) { setSaveState("locked"); return false; }
    setSaveState("saving");
    let record = {
      dataSchema: DATA_SCHEMA, savedAt: new Date().toISOString(), appVersion: APP_VERSION,
      ings: next.ings ?? ings, finished: next.finished ?? finished, settings: next.settings ?? settings,
      log: next.log ?? log, sales: next.sales ?? sales, events: next.events ?? events,
      shrink: next.shrink ?? shrink, bundles: next.bundles ?? bundles, recipes: next.recipes ?? recipes,
      purchases: next.purchases ?? purchases, deleted: next.deleted ?? deleted,
    };
    try {
      const split = splitForArchive(record);
      if (split) {
        const archive = await archiveHistory(split.moved); // throws before anything is trimmed if the archive can't be written
        record = split.keep;
        setArchived(archive);
        setSales(record.sales); setLog(record.log); setPurchases(record.purchases); setShrink(record.shrink);
      }
    } catch (e) { /* archiving failed, so everything stays in the main record */ }
    try {
      await store.write(STORE_KEY, JSON.stringify(record));
      setSaveState("idle");
      return true;
    } catch (e) { setSaveState("error"); return false; }
  }, [ings, finished, settings, log, sales, events, shrink, bundles, recipes, purchases, deleted]);

  const safePoint = async (reason) => {
    try { const key = await takeRestorePoint(reason); await refreshPoints(); return { ok: true, key }; }
    catch (e) { return { ok: false }; }
  };
  const arm = (k) => {
    setConfirmKey(k);
    setTimeout(() => setConfirmKey((c) => (c === k ? null : c)), 4000);
  };
  const setAside = async (raw) => {
    try { await store.write(`${QUARANTINE_PREFIX}${Date.now()}`, raw); return true; }
    catch (e) { setSafetyMsg({ ok: false, text: "Couldn't set the damaged record aside, so nothing was changed." }); return false; }
  };
  const restoreFrom = async (key) => {
    setSafetyMsg(null);
    const r = await store.read(key);
    let point = null;
    if (r.status === "ok") { try { point = JSON.parse(r.value); } catch (e) { point = null; } }
    let d = null;
    if (point && typeof point.record === "string") { try { d = JSON.parse(point.record); } catch (e) { d = null; } }
    if (!d || recordProblem(d)) { setSafetyMsg({ ok: false, text: "That restore point couldn't be read, so nothing was changed." }); return false; }
    if (boot.status === "ready") {
      const before = await safePoint("restore");
      if (!before.ok) { setSafetyMsg({ ok: false, text: NO_POINT_MSG }); return false; }
    } else if (boot.status === "corrupt" && !(await setAside(boot.raw))) return false;
    try { await store.write(STORE_KEY, point.record); }
    catch (e) { setSafetyMsg({ ok: false, text: "The restore didn't save, so nothing was changed." }); return false; }
    setUndo(null);
    await load();
    setSafetyMsg({ ok: true, text: `Restored your data as it was on ${fmtDT(point.createdAt)}.` });
    return true;
  };
  const undoChange = async () => {
    if (!undo) return;
    const { key } = undo;
    setUndo(null);
    await restoreFrom(key);
  };
  const startWithSeed = async () => {
    if (boot.status === "corrupt" && !(await setAside(boot.raw))) return;
    const applied = applyRecord({}, INITIAL_STATE);
    writableRef.current = true;
    if (!(await persist(applied))) { writableRef.current = false; setSafetyMsg({ ok: false, text: "Storage didn't accept the new record. Try again." }); return; }
    setSafetyMsg(null);
    setBoot({ status: "ready" });
  };
  const startFromExport = async () => {
    let d;
    try { d = JSON.parse(recoveryText); } catch (e) { setSafetyMsg({ ok: false, text: "That isn't a complete export. Copy all of it and paste it again." }); return; }
    if (!d || d.schema !== "sos.stockroom.v1") { setSafetyMsg({ ok: false, text: "That isn't a stockroom export. It needs the schema sos.stockroom.v1." }); return; }
    const rec = exportToRecord(d);
    const problem = recordProblem(rec);
    if (problem) { setSafetyMsg({ ok: false, text: `That export can't be used because ${problem}.` }); return; }
    if (boot.status === "corrupt" && !(await setAside(boot.raw))) return;
    const applied = applyRecord(rec, INITIAL_STATE);
    if (d.archive && typeof d.archive === "object") {
      try { await store.write(ARCHIVE_KEY, JSON.stringify(d.archive)); setArchived(d.archive); } catch (e) { /* the record itself still restores */ }
    }
    writableRef.current = true;
    if (!(await persist(applied))) { writableRef.current = false; setSafetyMsg({ ok: false, text: "Storage didn't accept the record. Try again." }); return; }
    setRecoveryText(""); setSafetyMsg(null);
    setBoot({ status: "ready" });
  };
  // Preview builds only. Reads the live record and never writes it; the write guard refuses live keys here.
  const copyLiveIntoSandbox = async () => {
    if (BUILD !== "preview") return;
    setSafetyMsg(null);
    const r = await store.read(LIVE_KEY);
    if (r.status === "failed") { setSafetyMsg({ ok: false, text: "Couldn't read your live data. Try again." }); return; }
    if (r.status === "empty") { setSafetyMsg({ ok: false, text: "This preview can't see your live data, since Claude may keep each file's storage separate. Paste a full export from the live stockroom instead." }); return; }
    let d;
    try { d = JSON.parse(r.value); } catch (e) { d = undefined; }
    if (d === undefined || recordProblem(d)) { setSafetyMsg({ ok: false, text: "Your live record couldn't be read, so nothing was copied." }); return; }
    if (boot.status === "ready") {
      const before = await safePoint("sandbox");
      if (!before.ok) { setSafetyMsg({ ok: false, text: NO_POINT_MSG }); return; }
    }
    try { await store.write(SANDBOX_KEY, r.value); } catch (e) { setSafetyMsg({ ok: false, text: "The sandbox didn't save the copy. Try again." }); return; }
    await load();
    setSafetyMsg({ ok: true, text: "Your live data is copied into the sandbox. Changes here stay here." });
  };
  const makePointNow = async () => {
    const p = await safePoint("manual");
    setSafetyMsg(p.ok ? { ok: true, text: "Restore point made." } : { ok: false, text: "Couldn't make a restore point. Try again." });
  };

  // standard supplier rate (planning price) vs carrying rate (weighted-average of what stock actually cost)
  const stdOf = (i) => (i && (i.stdCostPerG ?? i.costPerG)) || 0;
  const mod = { ...DEFAULT_SETTINGS.modules, ...(settings.modules || {}) };

  // ---------- velocity ----------
  const velocity = useMemo(() => {
    if (!(settings.modules?.sales ?? true)) return { rate: {}, count: {}, total: 0 };
    const inWindow = sales.filter((s) => daysAgo(s.ts) <= VELOCITY_DAYS);
    const bySku = {};
    inWindow.forEach((s) => { bySku[s.sku] = (bySku[s.sku] || 0) + s.qty; });
    const rate = {}; const count = {};
    recipes.forEach((r) => {
      count[r.name] = bySku[r.name] || 0;
      rate[r.name] = (bySku[r.name] || 0) / VELOCITY_DAYS; // packs/day
    });
    return { rate, count, total: inWindow.reduce((a, s) => a + s.qty, 0) };
  }, [sales, recipes, settings.modules]);

  // ---------- derived ----------
  const stockMap = useMemo(() => Object.fromEntries(ings.map((i) => [i.name, i])), [ings]);
  const packagingTotal = useMemo(() => Object.values(settings.packaging).reduce((a, b) => a + (parseFloat(b) || 0), 0), [settings]);
  const shippedTotal = useMemo(() => Object.values(settings.shippedPackaging || {}).reduce((a, b) => a + (parseFloat(b) || 0), 0), [settings]);
  const isShipped = useCallback((ch) => (settings.shippedChannels || []).includes(ch), [settings.shippedChannels]);
  const feeFor = useCallback((channel, price) => {
    const f = (settings.channelFees || {})[channel] || { pct: 0, fixed: 0 };
    return Math.max(0, price * (parseFloat(f.pct) || 0) / 100 + (parseFloat(f.fixed) || 0));
  }, [settings.channelFees]);

  const recipeCalc = useMemo(() => {
    const BP = Math.max(1, settings.defaultBatchPacks || 10);
    return recipes.map((r) => {
    let ingredientCost = 0, buildable = Infinity, limiting = null, worstRatio = Infinity;
    const lines = r.lines.map((l) => {
      const ing = stockMap[l.ingredient] || { stockG: 0, costPerG: 0 };
      const need1 = batchNeed(l, BP);
      const canMake = need1 > 0 ? Math.floor(ing.stockG / need1) : Infinity;
      ingredientCost += l.perPackG * ing.costPerG;
      const ratio = need1 > 0 ? ing.stockG / need1 : Infinity;
      if (ratio < worstRatio) { worstRatio = ratio; limiting = l.ingredient; }
      if (canMake < buildable) buildable = canMake;
      const status = ing.stockG >= need1 * 2 ? "green" : ing.stockG >= need1 ? "amber" : "red";
      return { ...l, stockG: ing.stockG, need1, canMake, status, shortfall: Math.max(0, need1 - ing.stockG) };
    });
    const unitCost = ingredientCost + (r.pkgOverride !== undefined ? r.pkgOverride : packagingTotal);
    const sell = r.priceOverride !== undefined ? r.priceOverride : settings.sellPrice;
    const rate = velocity.rate[r.name] || 0;
    const packs = finished[r.name] ?? 0;
    const daysCover = rate > 0 ? packs / rate : null;
    const oldestBB = log.filter((e) => e.recipe === r.name && e.bestBefore).map((e) => e.bestBefore).sort()[0] || null;
    return { ...r, batchPacks: BP, lines, ingredientCost, unitCost, buildable: isFinite(buildable) ? buildable : 0, limiting,
      sellAt: sell, margin: sell - unitCost, shippedCost: unitCost + shippedTotal, shippedMargin: sell - unitCost - shippedTotal, startable: lines.every((l) => l.status !== "red"),
      rate, salesInWindow: velocity.count[r.name] || 0, daysCover, oldestBB };
  }); }, [recipes, stockMap, packagingTotal, shippedTotal, settings.sellPrice, settings.defaultBatchPacks, velocity, finished, log]);

  // ingredient daily usage from sales velocity, ABC class, reorder logic
  const ingCalc = useMemo(() => {
    const BP = Math.max(1, settings.defaultBatchPacks || 10);
    const maxDraw = {}; const dailyUse = {}; const blendCount = {}; const totalDraw = {};
    recipes.forEach((r) => r.lines.forEach((l) => {
      const d = batchNeed(l, BP);
      if (!maxDraw[l.ingredient] || d > maxDraw[l.ingredient].g) maxDraw[l.ingredient] = { g: d, recipe: r.name };
      dailyUse[l.ingredient] = (dailyUse[l.ingredient] || 0) + (velocity.rate[r.name] || 0) * l.perPackG;
      blendCount[l.ingredient] = (blendCount[l.ingredient] || 0) + 1;
      totalDraw[l.ingredient] = (totalDraw[l.ingredient] || 0) + d;
    }));
    let rows = ings.map((i) => {
      const md = maxDraw[i.name] || { g: 0, recipe: "—" };
      const use = dailyUse[i.name] || 0;
      const demandThreshold = use * (settings.leadTimeDays + settings.safetyDays);
      const batchThreshold = md.g * settings.reorderBatches;
      const demandMode = velocity.total >= MIN_SALES_FOR_DEMAND && use > 0;
      // demand-driven, but never below one full batch of the heaviest blend (so you can always brew)
      const auto = demandMode ? Math.max(demandThreshold, md.g) : batchThreshold;
      const threshold = Math.max(auto, i.parG || 0); // manual par overrides upward
      const onOrderG = i.onOrderG || 0;
      const effective = i.stockG + onOrderG; // ordered stock counts toward the line (but not toward brewing)
      const deficit = Math.max(0, threshold - effective);
      const packsToOrder = i.packSizeG > 0 ? Math.ceil(deficit / i.packSizeG) : 0;
      const status = threshold === 0 ? "green" : effective >= threshold ? "green" : effective >= md.g ? "amber" : "red";
      const daysCover = use > 0 ? i.stockG / use : null;
      // will this trip its line before a fresh order could land? (pull-forward candidate)
      const pullForward = deficit === 0 && use > 0 && (effective - use * settings.leadTimeDays) < threshold;
      const annualValue = (use > 0 ? use * 365 : md.g * 6) * i.costPerG; // fallback: ~6 batches/yr of heaviest blend
      const blends = blendCount[i.name] || 0;
      const key = blends >= 8 ? 1 : blends >= 4 ? 2 : blends >= 1 ? 3 : null; // criticality: blast radius of a stockout
      return { ...i, maxDrawG: md.g, drivenBy: md.recipe, threshold, deficit, packsToOrder, status, daysCover, dailyUse: use, demandMode, annualValue,
        blends, key, totalDrawG: totalDraw[i.name] || 0, parSet: (i.parG || 0) > auto, onOrderG, pullForward };
    });
    // ABC by cumulative annual usage value
    const sorted = [...rows].sort((a, b) => b.annualValue - a.annualValue);
    const totV = sorted.reduce((a, r) => a + r.annualValue, 0) || 1;
    let cum = 0; const cls = {};
    sorted.forEach((r) => { cum += r.annualValue; cls[r.name] = cum / totV <= 0.7 ? "A" : cum / totV <= 0.9 ? "B" : "C"; });
    return rows.map((r) => {
      const abc = cls[r.name];
      const dueDays = COUNT_CADENCE[abc];
      const countDue = !r.lastCounted || daysAgo(r.lastCounted) > dueDays;
      return { ...r, abc, countDue };
    });
  }, [ings, recipes, settings, velocity]);

  // ---------- cost tiers: price per kg, blend presence, movement since the last costing upload ----------
  const costTierCalc = useMemo(() => {
    const tiers = { premiumFrom: 25, lowerBelow: 12, ...(settings.costTiers || {}) };
    const weighted = velocity.total >= MIN_SALES_FOR_DEMAND;
    const w = (r) => (weighted ? (velocity.rate[r.name] || 0) * 7 : 1); // a week of sales once there is demand data, else one pack of each blend
    const base = (settings.costBaseline && settings.costBaseline.rates) || null;
    const rows = []; const unused = []; const uncosted = [];
    ingCalc.forEach((i) => {
      if (i.name.includes("(units)")) return;
      const rate = stdOf(i);
      if (!(rate > 0)) { uncosted.push(i.name); return; }
      if (!i.blends) { unused.push(i.name); return; }
      let exposure = 0, grams = 0; const used = [];
      recipes.forEach((r) => r.lines.forEach((l) => {
        if (l.ingredient !== i.name) return;
        exposure += w(r) * l.perPackG * rate; grams += w(r) * l.perPackG; used.push(r.name);
      }));
      const was = base ? base[i.name] : undefined;
      const change = was > 0 ? (rate - was) / was : null;
      const perKg = rate * 1000;
      const tier = perKg >= tiers.premiumFrom ? 0 : perKg < tiers.lowerBelow ? 2 : 1;
      rows.push({ name: i.name, perKg, wasPerKg: was > 0 ? was * 1000 : null, change, isNew: !!base && was === undefined, tier, key: i.key, blends: i.blends, used,
        exposure, delta: was > 0 ? grams * (rate - was) : null, risk: exposure * (1 + Math.max(0, change || 0)) });
    });
    return { rows, unused, uncosted, tiers, weighted, base: settings.costBaseline || null };
  }, [ingCalc, recipes, settings.costTiers, settings.costBaseline, velocity]);

  const shopping = ingCalc.filter((i) => i.deficit > 0 && i.packSizeG > 0);
  const shoppingCost = shopping.reduce((a, i) => a + i.packsToOrder * i.packSizeG * stdOf(i), 0);
  const onOrderItems = ingCalc.filter((i) => i.onOrderG > 0);
  // supplier baskets: needed + pull-forward + top-up to free shipping (main supplier only)
  const baskets = useMemo(() => {
    const groups = {};
    shopping.forEach((i) => {
      const s = i.supplier || "—";
      if (!groups[s]) groups[s] = { supplier: s, need: [], pull: [], topup: [] };
      groups[s].need.push(i);
    });
    ingCalc.filter((i) => i.pullForward && i.deficit === 0 && i.packSizeG > 0).forEach((i) => {
      const s = i.supplier || "—";
      if (!groups[s]) groups[s] = { supplier: s, need: [], pull: [], topup: [] };
      groups[s].pull.push({ ...i, packsToOrder: 1 });
    });
    return Object.values(groups).map((gr) => {
      const line = (i) => i.packsToOrder * i.packSizeG * stdOf(i);
      let subtotal = [...gr.need, ...gr.pull].reduce((a, i) => a + line(i), 0);
      const isMain = gr.supplier.includes("wholesale");
      if (isMain && subtotal > 0 && subtotal < settings.freeShipThreshold) {
        // top up with K1/A items you'll inevitably need, cheapest cover-days first
        const inBasket = new Set([...gr.need, ...gr.pull].map((i) => i.name));
        const cands = ingCalc.filter((i) => i.supplier === gr.supplier && !inBasket.has(i.name) && i.packSizeG > 0 &&
          (i.key === 1 || i.abc === "A")).sort((a, b) => (a.daysCover ?? 9e9) - (b.daysCover ?? 9e9));
        for (const c of cands) {
          if (subtotal >= settings.freeShipThreshold) break;
          const cost = c.packSizeG * stdOf(c);
          gr.topup.push({ ...c, packsToOrder: 1 });
          subtotal += cost;
        }
      }
      return { ...gr, subtotal, isMain, gapToFree: Math.max(0, settings.freeShipThreshold - subtotal) };
    }).sort((a, b) => b.subtotal - a.subtotal);
  }, [ingCalc, shopping, settings.freeShipThreshold]);
  const atRiskRecipes = recipeCalc.filter((r) => !r.startable);
  const lowCover = recipeCalc.filter((r) => r.daysCover !== null && r.daysCover < settings.leadTimeDays + settings.safetyDays);
  const countsDue = ingCalc.filter((i) => i.countDue);
  const bbSoon = recipeCalc.filter((r) => r.oldestBB && (new Date(r.oldestBB) - Date.now()) / 86400000 < 60);
  // insights: GP protection + cash efficiency
  const marginBreaches = recipeCalc.filter((r) => r.margin / r.sellAt * 100 < settings.marginFloorPct);
  const postedBreaches = recipeCalc.filter((r) => r.margin / r.sellAt * 100 >= settings.marginFloorPct && r.shippedMargin / r.sellAt * 100 < settings.marginFloorPct);
  const deadPacks = velocity.total >= MIN_SALES_FOR_DEMAND ? recipeCalc.filter((r) => r.salesInWindow === 0 && (finished[r.name] ?? 0) > 0) : [];
  const overstocked = ingCalc.filter((i) => i.daysCover !== null && i.daysCover > 90 && i.stockG * i.costPerG > 2);
  const priceImpact = (settings.lastPriceImpact || []).filter((x) => Math.abs(x.after - x.before) / (x.before || 1) >= 0.05);
  // non-standard replenishment premium: what emergency/top-up buying cost over standard rates (60d)
  const topupPremium = purchases.filter((p) => daysAgo(p.ts) <= VELOCITY_DAYS).reduce((a, p) => {
    const ing = stockMap[p.name]; if (!ing) return a;
    return a + Math.max(0, p.cost - p.grams * stdOf(ing));
  }, 0);

  // ---------- shrink analytics ----------
  const shrinkCalc = useMemo(() => {
    const win = shrink.filter((s) => daysAgo(s.ts) <= VELOCITY_DAYS);
    const winValue = win.reduce((a, s) => a + s.value, 0);
    const allValue = shrink.reduce((a, s) => a + s.value, 0);
    const byReason = {}; const byItem = {};
    win.forEach((s) => {
      byReason[s.reason] = (byReason[s.reason] || 0) + s.value;
      const k = s.name;
      if (!byItem[k]) byItem[k] = { name: k, kind: s.kind, qty: 0, value: 0 };
      byItem[k].qty += s.qty; byItem[k].value += s.value;
    });
    // stock on hand at cost
    const ingValue = ings.reduce((a, i) => a + i.stockG * i.costPerG, 0);
    const finValue = recipeCalc.reduce((a, r) => a + (finished[r.name] ?? 0) * r.unitCost, 0);
    const stockValue = ingValue + finValue;
    // sales & GP in window (single-pack price, net of channel fees)
    const salesWin = sales.filter((s) => daysAgo(s.ts) <= VELOCITY_DAYS);
    const revenue = salesWin.reduce((a, s) => a + s.qty * settings.sellPrice, 0);
    const fees = salesWin.reduce((a, s) => a + s.qty * feeFor(s.channel, settings.sellPrice), 0);
    const cogs = salesWin.reduce((a, s) => {
      const r = recipeCalc.find((x) => x.name === s.sku);
      return a + s.qty * (r ? r.unitCost : 0);
    }, 0);
    // posted orders carry one box each; rows sharing a channel and time came from the same order
    const postedOrders = new Set(salesWin.filter((s) => isShipped(s.channel)).map((s) => `${s.channel}|${s.ts}`));
    const shipPack = postedOrders.size * shippedTotal;
    const gp = revenue - fees - cogs - shipPack;
    const gpAfter = gp - winValue;
    // per-channel P&L
    const byChannel = {};
    salesWin.forEach((s) => {
      if (!byChannel[s.channel]) byChannel[s.channel] = { channel: s.channel, units: 0, gross: 0, fees: 0, cogs: 0, orders: new Set() };
      const r = recipeCalc.find((x) => x.name === s.sku);
      const b = byChannel[s.channel];
      b.units += s.qty; b.gross += s.qty * settings.sellPrice;
      b.fees += s.qty * feeFor(s.channel, settings.sellPrice);
      b.cogs += s.qty * (r ? r.unitCost : 0);
      if (isShipped(s.channel)) b.orders.add(s.ts);
    });
    return {
      win, winValue, allValue, stockValue,
      byReason: Object.entries(byReason).sort((a, b) => b[1] - a[1]),
      byItem: Object.values(byItem).sort((a, b) => b.value - a.value),
      byChannel: Object.values(byChannel).map(({ orders, ...b }) => ({ ...b, posted: orders.size, shipPack: orders.size * shippedTotal, net: b.gross - b.fees, gp: b.gross - b.fees - b.cogs - orders.size * shippedTotal })).sort((a, b) => b.gross - a.gross),
      pctOfStock: stockValue > 0 ? winValue / stockValue * 100 : 0,
      pctOfSales: revenue > 0 ? winValue / revenue * 100 : null,
      revenue, fees, shipPack, gp, gpAfter,
      gpPct: revenue > 0 ? gp / revenue * 100 : null,
      gpAfterPct: revenue > 0 ? gpAfter / revenue * 100 : null,
    };
  }, [shrink, ings, finished, recipeCalc, sales, settings.sellPrice, feeFor, isShipped, shippedTotal]);

  // ---------- event planning ----------
  const planEvent = useCallback((ev) => {
    const items = recipeCalc.filter((r) => (ev.targets[r.name] || 0) > 0).map((r) => {
      const target = ev.targets[r.name];
      const shelf = finished[r.name] ?? 0;
      const toBrew = Math.max(0, target - shelf);
      const batches = Math.ceil(toBrew / r.batchPacks);
      return { r, target, shelf, toBrew, batches, brewPacks: batches * r.batchPacks };
    });
    const need = {}; // ingredient -> grams for all planned batches
    items.forEach(({ r, batches }) => r.lines.forEach((l) => {
      need[l.ingredient] = (need[l.ingredient] || 0) + l.need1 * batches;
    }));
    const buy = Object.entries(need).map(([name, grams]) => {
      const ing = stockMap[name] || { stockG: 0, packSizeG: 0, costPerG: 0, supplier: "?" };
      const short = Math.max(0, grams - ing.stockG);
      const packs = ing.packSizeG > 0 ? Math.ceil(short / ing.packSizeG) : 0;
      return { name, grams, stockG: ing.stockG, short, packs, cost: packs * ing.packSizeG * stdOf(ing), supplier: ing.supplier, packSizeG: ing.packSizeG };
    }).filter((b) => b.short > 0).sort((a, b) => b.short - a.short);
    const totBatches = items.reduce((a, x) => a + x.batches, 0);
    const buyCost = buy.reduce((a, b) => a + b.cost, 0);
    return { items, buy, totBatches, buyCost };
  }, [recipeCalc, finished, stockMap]);

  // ---------- mutations ----------
  const setStock = (name, val) => {
    const v = Math.max(0, parseFloat(val) || 0);
    const next = ings.map((i) => (i.name === name ? { ...i, stockG: v, lastCounted: new Date().toISOString() } : i));
    setIngs(next); persist({ ings: next });
  };
  const markCounted = (name) => {
    const next = ings.map((i) => (i.name === name ? { ...i, lastCounted: new Date().toISOString() } : i));
    setIngs(next); persist({ ings: next });
  };
  const setPacks = (name, val) => {
    const v = Math.max(0, parseInt(val) || 0);
    const next = { ...finished, [name]: v };
    setFinished(next); persist({ finished: next });
  };
  // core purchase logic: adds stock, recomputes weighted-average carrying cost, records the buy
  const applyPurchase = (name, grams, price) => {
    const gAmt = Math.max(0.1, parseFloat(grams) || 0);
    const paid = Math.max(0, parseFloat(price) || 0);
    if (gAmt <= 0) return;
    let kind = "standard";
    const next = ings.map((i) => {
      if (i.name !== name) return i;
      const std = stdOf(i);
      const paidRate = paid / gAmt;
      kind = std > 0 && paidRate > std * 1.02 ? "top-up" : "standard";
      const newStock = i.stockG + gAmt;
      const wac = newStock > 0 ? (i.stockG * i.costPerG + paid) / newStock : i.costPerG;
      return { ...i, stockG: Math.round(newStock * 10) / 10, costPerG: wac };
    });
    const rec = { ts: new Date().toISOString(), name, grams: gAmt, cost: paid, kind };
    const nextP = [rec, ...purchases];
    setIngs(next); setPurchases(nextP);
    persist({ ings: next, purchases: nextP });
    setBuyForm(null);
  };
  const receivePack = (name) => { // one standard pack at the standard price
    const ing = stockMap[name]; if (!ing || !ing.packSizeG) return;
    applyPurchase(name, ing.packSizeG, stdOf(ing) * ing.packSizeG);
  };
  const markOrdered = (items) => { // items: [{name, packsToOrder}]
    const map = Object.fromEntries(items.map((x) => [x.name, x.packsToOrder]));
    const now = new Date().toISOString();
    const next = ings.map((i) => map[i.name] ? { ...i, onOrderG: (i.onOrderG || 0) + map[i.name] * i.packSizeG, orderedAt: now } : i);
    setIngs(next); persist({ ings: next });
  };
  const bookInOrder = (name) => {
    const ing = stockMap[name]; if (!ing || !(ing.onOrderG > 0)) return;
    const gAmt = ing.onOrderG; const paid = stdOf(ing) * gAmt;
    const next = ings.map((i) => {
      if (i.name !== name) return i;
      const newStock = i.stockG + gAmt;
      const wac = newStock > 0 ? (i.stockG * i.costPerG + paid) / newStock : i.costPerG;
      return { ...i, stockG: Math.round(newStock * 10) / 10, costPerG: wac, onOrderG: 0, orderedAt: undefined };
    });
    const rec = { ts: new Date().toISOString(), name, grams: gAmt, cost: paid, kind: "standard" };
    const nextP = [rec, ...purchases];
    setIngs(next); setPurchases(nextP);
    persist({ ings: next, purchases: nextP });
  };
  const cancelOrder = (name) => {
    const next = ings.map((i) => (i.name === name ? { ...i, onOrderG: 0, orderedAt: undefined } : i));
    setIngs(next); persist({ ings: next });
  };
  const logBatch = (r, packs) => {
    const p = Math.max(1, Math.round(packs));
    const now = new Date();
    const code = `SOS-${now.toISOString().slice(2, 10).replace(/-/g, "")}-${r.sku.replace("SOS", "")}`;
    const nextIngs = ings.map((i) => {
      const line = r.lines.find((l) => l.ingredient === i.name);
      return line ? { ...i, stockG: Math.max(0, Math.round((i.stockG - line.perPackG * p) * 10) / 10) } : i;
    });
    const nextFin = { ...finished, [r.name]: (finished[r.name] ?? 0) + p };
    const nextLog = [{ ts: now.toISOString(), recipe: r.name, packs: p, ...(mod.lots ? { code, bestBefore: addMonths(now, settings.shelfLifeMonths).toISOString() } : {}) }, ...log];
    setIngs(nextIngs); setFinished(nextFin); setLog(nextLog);
    persist({ ings: nextIngs, finished: nextFin, log: nextLog });
    setConfirmBatch(null);
  };
  const recordSale = (name, qty, channel = "Quick", dateIso = null) => {
    const nextFin = { ...finished, [name]: Math.max(0, (finished[name] ?? 0) - qty) };
    if (!mod.sales) { setFinished(nextFin); persist({ finished: nextFin }); return; }
    const nextSales = [{ ts: dateIso || new Date().toISOString(), sku: name, qty, channel }, ...sales];
    setFinished(nextFin); setSales(nextSales);
    persist({ finished: nextFin, sales: nextSales });
  };
  const addSaleForm = () => {
    const qty = Math.max(1, parseInt(saleForm.qty) || 1);
    const iso = saleForm.date ? new Date(saleForm.date + "T12:00:00").toISOString() : null;
    recordSale(saleForm.sku, qty, saleForm.channel, iso);
    setSaleForm({ ...saleForm, qty: 1, date: "" });
  };
  const deleteSale = (idx) => {
    const nextSales = sales.filter((_, i) => i !== idx);
    setSales(nextSales); persist({ sales: nextSales });
  };
  // ---------- recipe management ----------
  const openRecipeEditor = (r) => setEditRecipe(r ? {
    orig: r.name, name: r.name, sku: r.sku, packSizeG: r.packSizeG,
    lines: r.lines.map((l) => ({ ...l })), isNew: false, search: "", pkgOverride: r.pkgOverride, priceOverride: r.priceOverride,
  } : { orig: null, name: "", sku: "", packSizeG: 80, lines: [], isNew: true, search: "" });
  const recipeAddLine = (ingName) => {
    if (editRecipe.lines.some((l) => l.ingredient === ingName)) return;
    setEditRecipe({ ...editRecipe, lines: [...editRecipe.lines, { ingredient: ingName, perPackG: 5 }], search: "" });
  };
  const recipeSetLine = (idx, val) => {
    const lines = editRecipe.lines.map((l, i) => (i === idx ? { ...l, perPackG: val } : l));
    setEditRecipe({ ...editRecipe, lines });
  };
  const recipeRemoveLine = (idx) => setEditRecipe({ ...editRecipe, lines: editRecipe.lines.filter((_, i) => i !== idx) });
  const saveRecipe = () => {
    const e = editRecipe; if (!e) return;
    const name = e.name.trim();
    const lines = e.lines.map((l) => ({ ingredient: l.ingredient, perPackG: Math.max(0, parseFloat(l.perPackG) || 0) })).filter((l) => l.perPackG > 0);
    if (!name || lines.length === 0) { setEditRecipe({ ...e, err: "A recipe needs a name and at least one ingredient with grams." }); return; }
    if (e.isNew && recipes.some((r) => r.name.toLowerCase() === name.toLowerCase())) { setEditRecipe({ ...e, err: "That blend name already exists." }); return; }
    const rec = { name: e.isNew ? name : e.orig, sku: e.sku.trim() || `SOS${name.replace(/[^A-Za-z]/g, "").slice(0, 5).toUpperCase()}`, ...(e.isNew && e.group ? { group: e.group } : {}),
      packSizeG: Math.max(1, parseFloat(e.packSizeG) || 80), batchPacks: settings.defaultBatchPacks || 10, lines, ...(String(e.pkgOverride ?? "").trim() !== "" ? { pkgOverride: Math.max(0, parseFloat(e.pkgOverride) || 0) } : {}), ...(String(e.priceOverride ?? "").trim() !== "" ? { priceOverride: Math.max(0, parseFloat(e.priceOverride) || 0) } : {}), ...(e.isNew ? { custom: true } : {}) };
    const next = e.isNew ? [...recipes, rec] : recipes.map((r) => (r.name === e.orig ? { ...r, ...rec } : r));
    const nextDeleted = e.isNew && (deleted.recipes || []).includes(name) ? { ...deleted, recipes: deleted.recipes.filter((n) => n !== name) } : deleted;
    setRecipes(next); setDeleted(nextDeleted); persist({ recipes: next, deleted: nextDeleted }); setEditRecipe(null);
  };
  // From the Flavour tab: open Claude's suggestion in the recipe editor, as a new draft or on the blend itself. Nothing saves until you do.
  const openFlavourDraft = ({ mode, base, lines, note }) => {
    const r = recipes.find((x) => x.name === base);
    if (!r) return;
    const copy = lines.map((l) => ({ ingredient: l.ingredient, perPackG: l.perPackG }));
    if (mode === "edit") {
      setEditRecipe({ orig: r.name, name: r.name, sku: r.sku, packSizeG: r.packSizeG, lines: copy, isNew: false, search: "", pkgOverride: r.pkgOverride, priceOverride: r.priceOverride, note });
    } else {
      let name = `${base} draft`; let n = 2;
      while (recipes.some((x) => x.name.toLowerCase() === name.toLowerCase())) name = `${base} draft ${n++}`;
      setEditRecipe({ orig: null, name, sku: "", packSizeG: r.packSizeG, lines: copy, isNew: true, search: "", pkgOverride: r.pkgOverride, priceOverride: r.priceOverride, group: "In development", note });
    }
    setOpenRecipe(null); setTab("recipes");
    try { window.scrollTo({ top: 0 }); } catch (e) { /* not every frame allows it */ }
  };
  const flavourCalls = useRef({});
  flavourCalls.current = { updateSetting: (p) => updateSetting(p), openFlavourDraft };
  const flavourUpdate = useCallback((patch) => flavourCalls.current.updateSetting(patch), []);
  const flavourDraft = useCallback((x) => flavourCalls.current.openFlavourDraft(x), []);
  const deleteRecipe = (name) => {
    const next = recipes.filter((r) => r.name !== name);
    const nextDeleted = { ...deleted, recipes: [...new Set([...(deleted.recipes || []), name])] };
    setRecipes(next); setDeleted(nextDeleted); persist({ recipes: next, deleted: nextDeleted }); setEditRecipe(null); setOpenRecipe(null);
  };

  // ---------- product (ingredient) management ----------
  const openEditor = (i) => setEditIng(i ? {
    name: i.name, newName: i.name, supplier: i.supplier, packSizeG: i.packSizeG,
    packPrice: Math.round(stdOf(i) * (i.packSizeG || 1) * 100) / 100, parG: i.parG || "", isNew: false,
    carryRate: i.costPerG, stockNow: i.stockG,
  } : { name: null, newName: "", supplier: "wholesale-spices.example", packSizeG: 500, packPrice: "", parG: "", isNew: true });
  const usedInRecipes = (name) => recipes.filter((r) => r.lines.some((l) => l.ingredient === name)).length;
  const saveEditor = () => {
    const e = editIng; if (!e || !e.newName.trim()) return;
    const packSizeG = Math.max(0, parseFloat(e.packSizeG) || 0);
    const packPrice = Math.max(0, parseFloat(e.packPrice) || 0);
    const costPerG = packSizeG > 0 ? packPrice / packSizeG : 0;
    const parG = Math.max(0, parseFloat(e.parG) || 0) || undefined;
    let next;
    if (e.isNew) {
      if (ings.some((i) => i.name.toLowerCase() === e.newName.trim().toLowerCase())) { setEditIng({ ...e, err: "That name already exists." }); return; }
      next = [...ings, { name: e.newName.trim(), costPerG, stdCostPerG: costPerG, packSizeG, supplier: e.supplier.trim() || "—", stockG: 0, parG, custom: true }];
    } else {
      next = ings.map((i) => (i.name === e.name ? { ...i, supplier: e.supplier.trim() || "—", packSizeG, stdCostPerG: costPerG, ...(i.stockG === 0 ? { costPerG } : {}), parG } : i));
    }
    const newName = e.newName.trim();
    const nextDeleted = e.isNew && (deleted.ingredients || []).includes(newName) ? { ...deleted, ingredients: deleted.ingredients.filter((n) => n !== newName) } : deleted;
    setIngs(next); setDeleted(nextDeleted); persist({ ings: next, deleted: nextDeleted }); setEditIng(null);
  };
  const deleteIngredient = (name) => {
    if (usedInRecipes(name) > 0) return; // recipe ingredients can't be removed
    const next = ings.filter((i) => i.name !== name);
    const nextDeleted = { ...deleted, ingredients: [...new Set([...(deleted.ingredients || []), name])] };
    setIngs(next); setDeleted(nextDeleted); persist({ ings: next, deleted: nextDeleted }); setEditIng(null);
  };

  const recordShrink = () => {
    const qty = Math.max(0.1, parseFloat(shrinkForm.qty) || 1);
    let value = 0; let nextIngs = ings; let nextFin = finished;
    if (shrinkForm.kind === "ingredient") {
      const ing = stockMap[shrinkForm.name]; if (!ing) return;
      value = qty * ing.costPerG;
      nextIngs = ings.map((i) => (i.name === ing.name ? { ...i, stockG: Math.max(0, Math.round((i.stockG - qty) * 10) / 10) } : i));
      setIngs(nextIngs);
    } else {
      const r = recipeCalc.find((x) => x.name === shrinkForm.name); if (!r) return;
      const q = Math.round(qty);
      value = q * r.unitCost;
      nextFin = { ...finished, [r.name]: Math.max(0, (finished[r.name] ?? 0) - q) };
      setFinished(nextFin);
    }
    const entry = { ts: new Date().toISOString(), kind: shrinkForm.kind, name: shrinkForm.name,
      qty: shrinkForm.kind === "pack" ? Math.round(qty) : qty, reason: shrinkForm.reason, value: Math.round(value * 100) / 100 };
    const nextShrink = [entry, ...shrink];
    setShrink(nextShrink);
    persist({ ings: nextIngs, finished: nextFin, shrink: nextShrink });
  };
  const undoShrink = (idx) => {
    const e = shrink[idx]; if (!e) return;
    let nextIngs = ings; let nextFin = finished;
    if (e.kind === "ingredient") {
      nextIngs = ings.map((i) => (i.name === e.name ? { ...i, stockG: Math.round((i.stockG + e.qty) * 10) / 10 } : i));
      setIngs(nextIngs);
    } else {
      nextFin = { ...finished, [e.name]: (finished[e.name] ?? 0) + e.qty };
      setFinished(nextFin);
    }
    const nextShrink = shrink.filter((_, i) => i !== idx);
    setShrink(nextShrink);
    persist({ ings: nextIngs, finished: nextFin, shrink: nextShrink });
  };
  // ---------- bundles ----------
  const bundleCost = (items, packagingCost, shippedPackagingCost = 0) => {
    const rows = items.map((n) => recipeCalc.find((r) => r.name === n)).filter(Boolean);
    const ingredientCost = rows.reduce((a, r) => a + r.ingredientCost, 0);
    const packPackaging = rows.reduce((a, r) => a + (r.unitCost - r.ingredientCost), 0);
    const inPerson = ingredientCost + packPackaging + (parseFloat(packagingCost) || 0);
    const postedExtra = shippedTotal + (parseFloat(shippedPackagingCost) || 0); // one box for the whole order, plus posted-only extras
    return { rows, ingredientCost, packPackaging, total: inPerson, inPerson, postedExtra, posted: inPerson + postedExtra };
  };
  const saveBundle = () => {
    if (!builder.name.trim() || builder.items.length === 0) return;
    const b = { id: uid(), name: builder.name.trim(), items: [...builder.items], packagingCost: parseFloat(builder.packagingCost) || 0, shippedPackagingCost: parseFloat(builder.shippedPackagingCost) || 0, salePrice: parseFloat(builder.salePrice) || 0 };
    const next = [...bundles.filter((x) => x.name !== b.name), b];
    setBundles(next); persist({ bundles: next });
  };
  const deleteBundle = (id) => {
    const next = bundles.filter((b) => b.id !== id);
    setBundles(next); persist({ bundles: next });
  };
  const loadBundle = (b) => setBuilder({ name: b.name, items: [...b.items], packagingCost: b.packagingCost, shippedPackagingCost: b.shippedPackagingCost ?? 0, salePrice: b.salePrice });

  // ---------- bulk import: Excel template, workbook ingestion, line-by-line report ----------
  const [ingest, setIngest] = useState(null); // {rows:[{sheet,row,entity,name,status,message}], counts}

  const downloadTemplate = async () => {
    if (!(await xlsxReady())) return;
    const wb = XLSX.utils.book_new();
    const readme = [
      ["STOCKROOM GRIMOIRE — BULK IMPORT TEMPLATE"], [],
      ["How this works"],
      ["1. Fill in the Ingredients sheet first — blends can only use ingredients that exist (already in the app, or on that sheet)."],
      ["2. Add blends on any sheet whose name starts with 'Blends' — one row per ingredient line. Make as many Blends tabs as you like (e.g. 'Blends - BBQ', 'Blends - Gifting'); the tab name becomes the product group."],
      ["3. Save the file and upload it on the Recipes or Ingredients tab. You'll get a line-by-line report of what was added, updated, or failed and why."],
      ["4. Re-uploading is safe: rows matching an existing name UPDATE it; new names are ADDED; failed rows are skipped, never guessed."], [],
      ["Data structure — Ingredients sheet"],
      ["Ingredient Name", "required · text · must be unique"],
      ["Supplier", "optional · text"],
      ["Pack Size (g)", "required · number > 0 · the size you normally buy"],
      ["Pack Price (£)", "required · number ≥ 0 · what that pack costs"],
      ["Current Stock (g)", "optional · number ≥ 0 · defaults to 0"],
      ["Min Level (g)", "optional · number · your own par; leave blank for automatic"], [],
      ["Data structure — Blends sheets (one row per ingredient in the blend)"],
      ["Blend Name", "required · text · rows with the same name form one blend"],
      ["SKU", "optional · text · auto-generated if blank"],
      ["Pack Size (g)", "required · number > 0 · same value on every row of a blend"],
      ["Ingredient", "required · must match an ingredient name exactly (not case-sensitive)"],
      ["Grams Per Pack", "required · number > 0"], [],
      ["Sales imports are separate: upload your raw Shopify / Etsy / Square order export (CSV or Excel) on the Sales or Data tab — no reformatting needed."],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(readme); ws1["!cols"] = [{ wch: 24 }, { wch: 80 }];
    XLSX.utils.book_append_sheet(wb, ws1, "READ ME");
    const ing = [["Ingredient Name", "Supplier", "Pack Size (g)", "Pack Price (£)", "Current Stock (g)", "Min Level (g)"],
      ["Example Smoked Salt", "Example Supplier Ltd", 500, 4.5, 0, ""],
      ["Example Wild Thyme", "Example Supplier Ltd", 250, 3.2, 120, 200]];
    const ws2 = XLSX.utils.aoa_to_sheet(ing); ws2["!cols"] = ing[0].map(() => ({ wch: 20 }));
    XLSX.utils.book_append_sheet(wb, ws2, "Ingredients");
    const bl = [["Blend Name", "SKU", "Pack Size (g)", "Ingredient", "Grams Per Pack"],
      ["Example Blend", "EX001", 80, "Example Smoked Salt", 20],
      ["Example Blend", "EX001", 80, "Example Wild Thyme", 10]];
    const ws3 = XLSX.utils.aoa_to_sheet(bl); ws3["!cols"] = bl[0].map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, ws3, "Blends - Group 1");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([bl[0]]), "Blends - Group 2");
    XLSX.writeFile(wb, "stockroom-import-template.xlsx");
  };

  const num = (v) => { const n = parseFloat(String(v).replace(/[£,\s]/g, "")); return isNaN(n) ? null : n; };
  const hIdx = (hdr, ...cands) => hdr.findIndex((h) => cands.some((c) => String(h || "").toLowerCase().trim().includes(c)));

  const ingestWorkbook = async (wb) => {
    const report = []; const push = (sheet, row, entity, name, status, message) => report.push({ sheet, row, entity, name, status, message });
    let nextIngs = [...ings];
    const findIng = (n) => nextIngs.find((i) => i.name.toLowerCase() === String(n).toLowerCase().trim());

    // pass 1: ingredient sheets
    for (const sn of wb.SheetNames) {
      if (/read\s*me/i.test(sn)) continue;
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: "" });
      if (!rows.length) continue;
      const hdr = rows[0];
      const cName = hIdx(hdr, "ingredient name"); const cSup = hIdx(hdr, "supplier");
      const cSize = hIdx(hdr, "pack size"); const cPrice = hIdx(hdr, "pack price");
      const cStock = hIdx(hdr, "current stock"); const cMin = hIdx(hdr, "min level");
      const cBlend = hIdx(hdr, "blend name");
      if (cName < 0 || cBlend >= 0) continue; // not an ingredients sheet
      rows.slice(1).forEach((r, ri) => {
        const rowNo = ri + 2;
        const name = String(r[cName] || "").trim();
        if (!name) return;
        if (/^example /i.test(name)) { push(sn, rowNo, "ingredient", name, "warning", "Example row skipped — replace with your own data."); return; }
        const errs = [];
        const size = num(r[cSize]); const price = num(r[cPrice]);
        if (cSize < 0 || size === null || size <= 0) errs.push(`Pack Size (g): "${r[cSize]}" must be a number above 0`);
        if (cPrice < 0 || price === null || price < 0) errs.push(`Pack Price (£): "${r[cPrice]}" must be a number`);
        const stock = cStock >= 0 && String(r[cStock]).trim() !== "" ? num(r[cStock]) : 0;
        if (stock === null || stock < 0) errs.push(`Current Stock (g): "${r[cStock]}" must be a number`);
        const par = cMin >= 0 && String(r[cMin]).trim() !== "" ? num(r[cMin]) : undefined;
        if (par !== undefined && (par === null || par < 0)) errs.push(`Min Level (g): "${r[cMin]}" must be a number`);
        if (errs.length) { push(sn, rowNo, "ingredient", name, "failed", errs.join(" · ")); return; }
        const rate = price / size;
        const existing = findIng(name);
        if (existing) {
          nextIngs = nextIngs.map((i) => i === existing ? { ...i, supplier: String(r[cSup] || i.supplier).trim(), packSizeG: size, stdCostPerG: rate, ...(i.stockG === 0 && (stock ?? 0) === 0 ? { costPerG: rate } : {}), ...(stock ? { stockG: stock, costPerG: rate } : {}), ...(par !== undefined ? { parG: par } : {}) } : i);
          push(sn, rowNo, "ingredient", name, "updated", "Existing ingredient updated.");
        } else {
          nextIngs.push({ name, supplier: String(r[cSup] || "—").trim(), packSizeG: size, costPerG: rate, stdCostPerG: rate, stockG: stock ?? 0, ...(par !== undefined ? { parG: par } : {}), custom: true });
          push(sn, rowNo, "ingredient", name, "added", "New ingredient created.");
        }
      });
    }

    // pass 2: blend sheets (group rows by blend name per sheet)
    let nextRecipes = [...recipes];
    for (const sn of wb.SheetNames) {
      if (/read\s*me/i.test(sn)) continue;
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: "" });
      if (!rows.length) continue;
      const hdr = rows[0];
      const cBlend = hIdx(hdr, "blend name"); const cSku = hIdx(hdr, "sku");
      const cSize = hIdx(hdr, "pack size"); const cIng = hIdx(hdr, "ingredient");
      const cG = hIdx(hdr, "grams per pack", "grams/pack", "g per pack");
      if (cBlend < 0 || cIng < 0) continue; // not a blends sheet
      const group = sn.replace(/^blends?\s*[-–—]?\s*/i, "").trim() || sn;
      const blends = {};
      rows.slice(1).forEach((r, ri) => {
        const rowNo = ri + 2;
        const bname = String(r[cBlend] || "").trim();
        const iname = String(r[cIng] || "").trim();
        if (!bname && !iname) return;
        if (/^example /i.test(bname)) { push(sn, rowNo, "blend", bname, "warning", "Example row skipped."); return; }
        const errs = [];
        if (!bname) errs.push("Blend Name is empty");
        const size = num(r[cSize]);
        if (cSize < 0 || size === null || size <= 0) errs.push(`Pack Size (g): "${r[cSize]}" must be a number above 0`);
        const grams = num(r[cG]);
        if (cG < 0 || grams === null || grams <= 0) errs.push(`Grams Per Pack: "${r[cG]}" must be a number above 0`);
        const ingMatch = iname ? findIng(iname) : null;
        if (!ingMatch) errs.push(`Ingredient "${iname}" not found — check spelling or add it on the Ingredients sheet`);
        if (errs.length) { push(sn, rowNo, "blend line", bname || iname, "failed", errs.join(" · ")); return; }
        if (!blends[bname]) blends[bname] = { sku: String(r[cSku] || "").trim(), packSizeG: size, lines: [], firstRow: rowNo };
        if (blends[bname].packSizeG !== size) push(sn, rowNo, "blend line", bname, "warning", `Pack Size ${size}g differs from row ${blends[bname].firstRow} (${blends[bname].packSizeG}g) — first value used.`);
        if (blends[bname].lines.some((l) => l.ingredient === ingMatch.name)) { push(sn, rowNo, "blend line", bname, "failed", `Duplicate ingredient "${ingMatch.name}" in this blend`); return; }
        blends[bname].lines.push({ ingredient: ingMatch.name, perPackG: Math.round(grams * 100) / 100, row: rowNo });
      });
      for (const [bname, b] of Object.entries(blends)) {
        if (!b.lines.length) { push(sn, b.firstRow, "blend", bname, "failed", "No valid ingredient lines — blend not created."); continue; }
        const sumG = b.lines.reduce((a, l) => a + l.perPackG, 0);
        if (Math.abs(sumG - b.packSizeG) / b.packSizeG > 0.02) push(sn, b.firstRow, "blend", bname, "warning", `Lines total ${sumG.toFixed(1)}g against a ${b.packSizeG}g pack — check the ratios.`);
        const rec = { name: bname, sku: b.sku || `SOS${bname.replace(/[^A-Za-z]/g, "").slice(0, 5).toUpperCase()}`, packSizeG: b.packSizeG, batchPacks: settings.defaultBatchPacks || 10, lines: b.lines.map(({ ingredient, perPackG }) => ({ ingredient, perPackG })), group };
        const existing = nextRecipes.find((r) => r.name.toLowerCase() === bname.toLowerCase());
        if (existing) { nextRecipes = nextRecipes.map((r) => r === existing ? { ...r, ...rec, name: existing.name } : r); push(sn, b.firstRow, "blend", bname, "updated", `Recipe replaced — ${b.lines.length} ingredient lines.`); }
        else { nextRecipes.push({ ...rec, custom: true }); push(sn, b.firstRow, "blend", bname, "added", `New blend created in group "${group}" — ${b.lines.length} ingredient lines.`); }
      }
    }

    const counts = report.reduce((a, r) => ({ ...a, [r.status]: (a[r.status] || 0) + 1 }), {});
    if ((counts.added || 0) + (counts.updated || 0) > 0) {
      const point = await safePoint("bulk-import");
      if (!point.ok) { setIngest({ rows: [{ sheet: "-", row: "-", entity: "file", name: "", status: "failed", message: NO_POINT_MSG }], counts: { failed: 1 } }); return; }
      const before = Object.fromEntries(ings.map((i) => [i.name, stdOf(i)]));
      const costsMoved = nextIngs.some((i) => before[i.name] !== undefined && Math.abs(stdOf(i) - before[i.name]) > 1e-9);
      const ns = costsMoved ? { ...settings, costBaseline: { at: new Date().toISOString(), source: "Bulk upload", rates: before } } : null;
      setIngs(nextIngs); setRecipes(nextRecipes); if (ns) setSettings(ns);
      persist({ ings: nextIngs, recipes: nextRecipes, ...(ns ? { settings: ns } : {}) });
      if (point.key) setUndo({ key: point.key, where: "bulk", label: "Undo this upload" });
    }
    setIngest({ rows: report, counts });
  };

  const handleImportFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try { if (!(await xlsxReady())) throw new Error("Excel tools unavailable"); await ingestWorkbook(XLSX.read(ev.target.result, { type: "array" })); }
      catch (e) { setIngest({ rows: [{ sheet: "-", row: "-", entity: "file", name: file.name, status: "failed", message: "Couldn't read this file — save as .xlsx or .csv and try again." }], counts: { failed: 1 } }); }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSalesFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        if (!(await xlsxReady())) throw new Error("Excel tools unavailable");
        const wb = XLSX.read(ev.target.result, { type: "array" });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" }).map((r) => r.map(String));
        ingestSalesRows(rows);
      } catch (e) { setCsvMsg({ ok: false, text: "Couldn't read that file — export as CSV or Excel from your sales platform and try again." }); }
    };
    reader.readAsArrayBuffer(file);
  };

  const downloadIngestReport = async () => {
    if (!ingest || !(await xlsxReady())) return;
    const wb = XLSX.utils.book_new();
    const data = [["Sheet", "Row", "Type", "Name", "Result", "Detail"], ...ingest.rows.map((r) => [r.sheet, r.row, r.entity, r.name, r.status, r.message])];
    const ws = XLSX.utils.aoa_to_sheet(data); ws["!cols"] = [{ wch: 16 }, { wch: 6 }, { wch: 10 }, { wch: 22 }, { wch: 9 }, { wch: 70 }];
    XLSX.utils.book_append_sheet(wb, ws, "Import report");
    XLSX.writeFile(wb, "import-report.xlsx");
  };

  // ---------- CSV sales import (Shopify / Etsy / Square order exports) ----------
  const parseCSV = (text) => {
    const rows = []; let row = [], cell = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
      else if (c === '"') q = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") { if (cell !== "" || row.length) { row.push(cell); rows.push(row); row = []; cell = ""; } }
      else cell += c;
    }
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((c) => c.trim() !== ""));
  };
  const ingestSalesRows = async (rows) => {
    try {
      if (rows.length < 2) throw new Error("no rows");
      const hdr = rows[0].map((h) => String(h).toLowerCase().trim());
      const find = (...cands) => hdr.findIndex((h) => cands.some((c) => h.includes(c)));
      const nameCol = find("lineitem name", "item name", "product name", "title", "item", "product", "description");
      const qtyCol = find("lineitem quantity", "quantity", "qty", "number of items", "items");
      const dateCol = find("created at", "sale date", "order date", "date", "paid at", "time");
      if (nameCol < 0) throw new Error("no product column");
      let applied = 0, unmatched = new Set();
      const newSales = [];
      for (const r of rows.slice(1)) {
        const raw = String(r[nameCol] || "").toLowerCase();
        if (!raw) continue;
        const match = recipes.find((rec) => raw.includes(rec.name.toLowerCase())) ||
          recipes.find((rec) => raw.replace(/[^a-z]/g, "").includes(rec.name.toLowerCase().replace(/[^a-z]/g, "")));
        if (!match) { unmatched.add(String(r[nameCol]).slice(0, 40)); continue; }
        const qty = Math.max(1, parseInt(r[qtyCol]) || 1);
        let ts = new Date().toISOString();
        if (dateCol >= 0 && r[dateCol]) { const d = new Date(r[dateCol]); if (!isNaN(d)) ts = d.toISOString(); }
        newSales.push({ ts, sku: match.name, qty, channel: csvChannel });
        applied += qty;
      }
      if (newSales.length === 0) throw new Error("nothing matched");
      const nextSales = [...newSales, ...sales];
      const point = await safePoint("sales-import");
      if (!point.ok) { setCsvMsg({ ok: false, text: NO_POINT_MSG }); return; }
      // note: import records history only — it does not deduct shelf stock (assumed already gone)
      setSales(nextSales); persist({ sales: nextSales });
      if (point.key) setUndo({ key: point.key, where: "sales", label: "Undo this import" });
      setCsvMsg({ ok: true, text: `${applied} packs across ${newSales.length} lines imported.${unmatched.size ? ` Unmatched: ${[...unmatched].slice(0, 3).join("; ")}${unmatched.size > 3 ? "…" : ""}` : ""}` });
      setCsvText("");
    } catch (e) { setCsvMsg({ ok: false, text: "Couldn't read that data — it needs a header row with a product column (and ideally quantity + date), with product names containing your blend names." }); }
  };
  const importCSVSales = () => ingestSalesRows(parseCSV(csvText));

  // ---------- open schema: full state export / import ----------
  // The export carries everything the stored record holds, so restoring from it loses nothing.
  const exportState = () => JSON.stringify({
    schema: "sos.stockroom.v1", exportedAt: new Date().toISOString(), dataSchema: DATA_SCHEMA, appVersion: APP_VERSION,
    settings, ingredients: ings, finishedPacks: finished, batchLog: log, sales, events, shrink, bundles,
    recipes, purchases, deleted, ...(archived ? { archive: archived } : {}),
  }, null, 1);
  const reviewImport = () => {
    setIoMsg(null);
    let d;
    try { d = JSON.parse(stateIO); } catch (e) { setIoMsg({ ok: false, text: "That isn't a complete export. Copy all of it and paste it again." }); return; }
    if (!d || d.schema !== "sos.stockroom.v1") { setIoMsg({ ok: false, text: "That isn't a stockroom export. It needs the schema sos.stockroom.v1." }); return; }
    const rec = exportToRecord(d);
    const problem = recordProblem(rec);
    if (problem) { setIoMsg({ ok: false, text: `That export can't be used because ${problem}.` }); return; }
    setPendingImport({ rec, archive: d.archive && typeof d.archive === "object" ? d.archive : null, exportedAt: d.exportedAt || null });
  };
  const confirmImport = async () => {
    const p = pendingImport;
    if (!p) return;
    const point = await safePoint("import");
    if (!point.ok) { setIoMsg({ ok: false, text: NO_POINT_MSG }); return; }
    const applied = applyRecord(p.rec, currentState());
    if (p.archive && !archived) {
      try { await store.write(ARCHIVE_KEY, JSON.stringify(p.archive)); setArchived(p.archive); } catch (e) { /* the record still imports */ }
    }
    const ok = await persist(applied);
    setPendingImport(null); setStateIO("");
    setIoMsg(ok ? { ok: true, text: "Imported. Your previous data is in a restore point." } : { ok: false, text: "The import didn't save. Your previous data is in a restore point." });
    if (point.key) setUndo({ key: point.key, where: "state", label: "Undo this import" });
  };

  const addEvent = () => {
    if (!evForm.name.trim()) return;
    const ev = { id: uid(), name: evForm.name.trim(), date: evForm.date || null, targets: {} };
    const next = [...events, ev];
    setEvents(next); persist({ events: next });
    setEvForm({ name: "", date: "" }); setOpenEvent(ev.id);
  };
  const setTarget = (evId, recipeName, val) => {
    const v = Math.max(0, parseInt(val) || 0);
    const next = events.map((e) => (e.id === evId ? { ...e, targets: { ...e.targets, [recipeName]: v } } : e));
    setEvents(next); persist({ events: next });
  };
  const deleteEvent = (evId) => {
    const next = events.filter((e) => e.id !== evId);
    setEvents(next); persist({ events: next }); setOpenEvent(null);
  };
  const updateSetting = (patch) => {
    const next = { ...settings, ...patch };
    setSettings(next); persist({ settings: next });
  };
  const importPrices = async () => {
    try {
      const arr = JSON.parse(importText);
      if (!Array.isArray(arr)) throw new Error("array expected");
      let applied = 0;
      const next = ings.map((i) => {
        const m = arr.find((a) => a.name && a.name.toLowerCase() === i.name.toLowerCase());
        if (m && typeof m.costPerG === "number") { applied++; return { ...i, stdCostPerG: m.costPerG, ...(i.stockG === 0 ? { costPerG: m.costPerG } : {}), ...(m.packSizeG ? { packSizeG: m.packSizeG } : {}) }; }
        return i;
      });
      const costOf = (arr) => Object.fromEntries(recipes.map((r) => {
        const m = Object.fromEntries(arr.map((x) => [x.name, x.stdCostPerG ?? x.costPerG]));
        return [r.name, r.lines.reduce((a, l) => a + l.perPackG * (m[l.ingredient] || 0), 0) + packagingTotal];
      }));
      const before = costOf(ings); const after = costOf(next);
      const impact = recipes.map((r) => ({ name: r.name, before: Math.round(before[r.name] * 100) / 100, after: Math.round(after[r.name] * 100) / 100 }))
        .filter((x) => Math.abs(x.after - x.before) >= 0.01);
      const point = await safePoint("price-import");
      if (!point.ok) { setImportMsg({ ok: false, text: NO_POINT_MSG }); return; }
      setIngs(next);
      if (point.key) setUndo({ key: point.key, where: "prices", label: "Undo this refresh" });
      const ns = { ...settings, priceLastSynced: new Date().toISOString(), lastPriceImpact: impact.length ? impact : null,
        costBaseline: { at: new Date().toISOString(), source: "Price refresh", rates: Object.fromEntries(ings.map((i) => [i.name, stdOf(i)])) } };
      setSettings(ns); persist({ ings: next, settings: ns });
      setImportMsg({ ok: true, text: `${applied} price${applied === 1 ? "" : "s"} updated.` });
      setImportText("");
    } catch (e) { setImportMsg({ ok: false, text: "Couldn't read that JSON — check the format and try again." }); }
  };
  const copyText = async (t) => { try { await navigator.clipboard.writeText(t); return true; } catch (e) { return false; } };
  const copyFullExport = async () => {
    if (await copyText(exportState())) {
      updateSetting({ lastFullExportAt: new Date().toISOString() });
      setIoMsg({ ok: true, text: "Full export copied. Keep it somewhere outside this browser." });
    } else setIoMsg({ ok: false, text: "Copy didn't work here. Use Preview in box below and copy it from there." });
  };
  const exportForRefresh = () => JSON.stringify(
    ings.filter((i) => i.supplier.includes("wholesale")).map((i) => ({ name: i.name, costPerG: stdOf(i), packSizeG: i.packSizeG })), null, 1);
  const pickListText = (r, packs = 10) => {
    const lines = r.lines.map((l) => `${l.ingredient.padEnd(26)} ${g(l.perPackG * packs)}`).join("\n");
    return `SAGES OF SPICE — WEIGH-OUT LIST\n${r.name} · ${packs} × ${r.packSizeG}g packs\n${"—".repeat(38)}\n${lines}\n${"—".repeat(38)}\nTotal blend: ${g(r.lines.reduce((a, l) => a + l.perPackG, 0) * packs)}\nWeigh everything out BEFORE mixing.`;
  };

  const previewBar = BUILD === "preview"
    ? <div className="previewbar">Preview build. It works on a sandbox copy and can't change your live stockroom.</div>
    : null;
  const exportAgeDays = settings.lastFullExportAt ? daysAgo(settings.lastFullExportAt) : null;
  const archivedCount = archived ? HISTORY_FIELDS.reduce((a, f) => a + (Array.isArray(archived[f]) ? archived[f].length : 0), 0) : 0;
  const renderPoints = () => (
    <section className="card">
      <h2>Backups and restore points<Tip side="left">A full copy of your data, taken on first open each day and before every import, upgrade or restore. The last {KEEP_RESTORE_POINTS} are kept next to your data, so keep a full export somewhere else as well.</Tip></h2>
      {loaded && (
        <p className="hint">Last full export: {exportAgeDays === null ? "never. Copy one below and keep it somewhere outside this browser." : `${fmtD(settings.lastFullExportAt)}${exportAgeDays > 7 ? `, ${Math.floor(exportAgeDays)} days ago. Time for a fresh one.` : "."}`}</p>
      )}
      {restorePoints.length === 0 ? <p className="mut">No restore points yet.</p> : (
        <ul className="loglist rp">
          {restorePoints.map((p) => (
            <li key={p.key}>
              <span>{fmtDT(new Date(p.at).toISOString())}</span>
              <span className="mut">{RP_LABEL[p.reason] || p.reason}</span>
              <button className={`mini ${confirmKey === p.key ? "danger" : "ghost"}`} onClick={() => (confirmKey === p.key ? (setConfirmKey(null), restoreFrom(p.key)) : arm(p.key))}>
                {confirmKey === p.key ? "Tap again to restore" : "Restore"}
              </button>
            </li>
          ))}
        </ul>
      )}
      {loaded && <div className="actions"><button onClick={makePointNow}>Make a restore point now</button></div>}
      {safetyMsg && <p className={safetyMsg.ok ? "okmsg" : "errmsg"}>{safetyMsg.text}</p>}
      {archivedCount > 0 && <p className="hint">{archivedCount} older records sit in the archive to keep the main record under the storage limit. Every full export includes them.</p>}
      <p className="hint">{BUILD === "preview" ? "Preview build" : BUILD === "demo" ? "Demo build" : "Live build"} {APP_VERSION}, data version {DATA_SCHEMA}, stored under {STORE_KEY}.</p>
    </section>
  );
  const recoveryImport = (
    <>
      <textarea className="paste" rows={5} placeholder="Paste a full export (sos.stockroom.v1) here" value={recoveryText} onChange={(e) => setRecoveryText(e.target.value)} />
      <div className="actions"><button className="primary" onClick={startFromExport} disabled={!recoveryText.trim()}>Restore from this export</button></div>
    </>
  );
  const seedButton = (label) => (
    <div className="actions">
      <button className={confirmKey === "seed" ? "danger" : ""} onClick={() => (confirmKey === "seed" ? (setConfirmKey(null), startWithSeed()) : arm("seed"))}>
        {confirmKey === "seed" ? "Tap again to confirm" : label}
      </button>
    </div>
  );
  const renderRecovery = () => (
    <section className="card warn">
      {boot.status === "failed" && (
        <>
          <h2>Couldn't open your stockroom data</h2>
          <p className="hint">Storage didn't answer, so nothing has been loaded, changed or saved. Your data is as you left it.</p>
          <div className="actions"><button className="primary" onClick={load}>Try again</button></div>
        </>
      )}
      {boot.status === "empty" && (
        <>
          <h2>{BUILD === "preview" ? "The sandbox is empty" : "No stockroom data in this copy"}</h2>
          <p className="hint">{BUILD === "preview"
            ? "Copy your live data in to test against your real numbers, paste a full export, or start from the starting data."
            : "Storage confirmed there's no stockroom record here. If you've used the stockroom before, your data may sit with an earlier copy of this file. Open that copy, take a full export from Data, API & settings and paste it below. Only start from the starting data if this really is a first run."}</p>
          {BUILD === "preview" && <div className="actions"><button className="primary" onClick={copyLiveIntoSandbox}>Copy my live data into the sandbox</button></div>}
          {recoveryImport}
          {seedButton("Start from the starting data")}
        </>
      )}
      {boot.status === "corrupt" && (
        <>
          <h2>Your stockroom record couldn't be read</h2>
          <p className="hint">It has been left exactly as it was, because {boot.problem}. Copy it before anything else so it can be pieced back together, or use a restore point below.</p>
          <div className="actions">
            <button onClick={async () => setSafetyMsg((await copyText(boot.raw)) ? { ok: true, text: "Raw record copied." } : { ok: false, text: "Copy didn't work here." })}>Copy the raw record</button>
          </div>
          {recoveryImport}
          {seedButton("Set it aside and start from the starting data")}
        </>
      )}
      {boot.status === "nopoint" && (
        <>
          <h2>Couldn't take a restore point before upgrading</h2>
          <p className="hint">Your data loaded. This version adds a few fields to it and wanted a safety copy first, so nothing has been saved yet.</p>
          <div className="actions">
            <button className="primary" onClick={load}>Try again</button>
            <button onClick={() => { writableRef.current = true; setBoot({ status: "ready" }); }}>Continue without one</button>
          </div>
        </>
      )}
      {boot.status !== "nopoint" && safetyMsg && <p className={safetyMsg.ok ? "okmsg" : "errmsg"}>{safetyMsg.text}</p>}
    </section>
  );
  const renderImportReview = () => {
    const p = pendingImport;
    const cur = currentState();
    const shelf = (f) => Object.values(f || {}).reduce((a, n) => a + (Number(n) || 0), 0);
    const missing = SECTIONS.filter(([k]) => p.rec[k] === undefined).map(([, label]) => label.toLowerCase());
    return (
      <div className="review">
        <p><b>This replaces your current data with the file{p.exportedAt ? ` exported ${fmtDT(p.exportedAt)}` : ""}.</b> A restore point is taken first, so you can undo it.</p>
        <div className="tblscroll"><table className="tbl">
          <thead><tr><th>Section</th><th>Now</th><th>In the file</th></tr></thead>
          <tbody>
            {SECTIONS.map(([k, label]) => (
              <tr key={k}><td>{label}</td><td>{(cur[k] || []).length}</td><td>{p.rec[k] ? p.rec[k].length : "Not in file"}</td></tr>
            ))}
            <tr><td>Finished packs on the shelf</td><td>{shelf(cur.finished)}</td><td>{p.rec.finished ? shelf(p.rec.finished) : "Not in file"}</td></tr>
          </tbody>
        </table></div>
        {missing.length > 0 && <p className="hint">The file has no {missing.join(" or ")}, so yours stay as they are.</p>}
        <div className="actions">
          <button className="primary" onClick={confirmImport}>Replace my data</button>
          <button onClick={() => setPendingImport(null)}>Cancel</button>
        </div>
      </div>
    );
  };

  if (boot.status === "loading") return (<div className="sos-root"><Style />{previewBar}<div className="loading">Opening the stockroom ledger…</div></div>);
  if (boot.status !== "ready") return (<div className="sos-root"><Style />{previewBar}<main>{renderRecovery()}{restorePoints.length > 0 && renderPoints()}</main></div>);

  const dot = (s) => <span className={`dot ${s}`} />;
  const coverBadge = (d) => d === null ? <span className="mut">no sales data</span>
    : d < settings.leadTimeDays + settings.safetyDays ? <span className="cov red">{Math.floor(d)}d cover</span>
    : d < 30 ? <span className="cov amber">{Math.floor(d)}d cover</span>
    : <span className="cov green">{d > 365 ? "365+" : Math.floor(d)}d cover</span>;

  return (
    <div className="sos-root"><Style />
      {previewBar}
      <header className="hdr">
        <div className="brand">
          <div className="sigil">✦</div>
          <div>
            <h1>The Stockroom Grimoire</h1>
            <div className="sub">Demo edition · fictional blends &amp; ratios</div>
          </div>
        </div>
        <SaveBadge bind={badgeSet} />
      </header>

      <nav className="tabs">
        {[["overview", "Overview"], ["recipes", "Recipes"], ["ingredients", "Ingredients"], ["costs", "Cost tiers"], ["flavour", "Flavour"], ["stock", "Finished packs"], ["sales", "Sales"], ["bundles", "Bundles"], ["events", "Events"], ["shrinkage", "Shrink & gifting"], ["shopping", "Shopping"], ["sync", "Data & settings"], ["guide", "Guide"]].filter(([k]) => (
          k === "sales" ? mod.sales : k === "bundles" ? mod.bundles : k === "events" ? mod.events : k === "shrinkage" ? mod.shrink : k === "shopping" ? mod.purchasing : true
        )).map(([k, label]) => (
          <button key={k} className={tab === k ? "on" : ""} onClick={() => { setTab(k); setOpenRecipe(null); setOpenEvent(null); }}>{label}
            {k === "shopping" && shopping.length > 0 && <span className="pill">{shopping.length}</span>}
            {k === "ingredients" && mod.counts && countsDue.length > 0 && <span className="pill dim">{countsDue.length}</span>}
          </button>
        ))}
      </nav>

      {/* ============ OVERVIEW ============ */}
      {tab === "overview" && (
        <main>
          {ings.every((i) => i.stockG === 0) && sales.length === 0 && log.length === 0 && (
            <section className="card" style={{ borderColor: "var(--ember)" }}>
              <h2>Get started<Tip>Everything reads zero until stock is counted. Counting unlocks brew checks and the shopping list. Five or more logged sales switch reordering to real demand and show days of cover.</Tip></h2>
              <div className="actions" style={{ marginTop: 4 }}>
                <button onClick={() => setTab("ingredients")}>1 · Count your ingredients</button>
                <button onClick={() => setTab("sync")}>2 · Check prices are current</button>
                <button onClick={() => setTab("sales")}>3 · Log a few recent sales</button>
              </div>
            </section>
          )}
          <section className="statrow">
            <div className="stat"><div className="n">{recipeCalc.filter((r) => r.startable).length}<span>/{recipes.length}</span></div><div className="l">blends startable now</div></div>
            <div className="stat"><div className="n">{Object.values(finished).reduce((a, b) => a + b, 0)}</div><div className="l">finished packs on hand</div></div>
            <div className="stat"><div className="n">{velocity.total}</div><div className="l">packs sold, last {VELOCITY_DAYS} days</div></div>
            <div className="stat"><div className="n">{shopping.length}</div><div className="l">ingredients to reorder</div></div>
            <div className="stat"><div className="n">{gbp(shoppingCost)}</div><div className="l">est. restock spend</div></div>
          </section>

          <section className="card">
            <h2>Batch readiness<Tip side="left">Green: you can brew it today. Amber: enough for one batch. Red: blocked, with the missing ingredient named. Days of cover show once sales are logged{velocity.total < MIN_SALES_FOR_DEMAND ? `; ${MIN_SALES_FOR_DEMAND - velocity.total} more sale${MIN_SALES_FOR_DEMAND - velocity.total === 1 ? "" : "s"} switch reordering to real demand` : ""}.</Tip></h2>
            <div className="ready-grid">
              {recipeCalc.map((r) => (
                <button key={r.name} className={`ready ${r.startable ? (r.buildable >= 2 ? "green" : "amber") : "red"}`} onClick={() => { setTab("recipes"); setOpenRecipe(r.name); }}>
                  <div className="rname">{r.name}</div>
                  <div className="rmeta">{r.startable ? `${r.buildable} batch${r.buildable === 1 ? "" : "es"} possible` : `blocked · ${r.limiting}`}</div>
                  <div className="rpacks">{finished[r.name] ?? 0} packs · {coverBadge(r.daysCover)}</div>
                </button>
              ))}
            </div>
          </section>

          {(atRiskRecipes.length > 0 || lowCover.length > 0 || countsDue.length > 0 || bbSoon.length > 0) && (
            <section className="card warn">
              <h2>Needs attention</h2>
              {atRiskRecipes.length > 0 && <p>{dot("red")} <b>Blocked blends:</b> {atRiskRecipes.map((r) => `${r.name} (${r.limiting})`).join(" · ")}</p>}
              {lowCover.length > 0 && <p>{dot("amber")} <b>Shelf won't outlast a resupply cycle:</b> {lowCover.map((r) => `${r.name} (${Math.floor(r.daysCover)}d)`).join(" · ")}</p>}
              {mod.lots && bbSoon.length > 0 && <p>{dot("amber")} <b>Best-before inside 60 days:</b> {bbSoon.map((r) => `${r.name} (${fmtD(r.oldestBB)})`).join(" · ")}. Sell these first.</p>}
              {mod.counts && countsDue.length > 0 && <p>{dot("amber")} <b>Cycle counts due:</b> {countsDue.filter((i) => i.abc === "A").length} A-class, {countsDue.filter((i) => i.abc === "B").length} B, {countsDue.filter((i) => i.abc === "C").length} C, on the Ingredients tab.</p>}
            </section>
          )}

          {(marginBreaches.length > 0 || postedBreaches.length > 0 || deadPacks.length > 0 || overstocked.length > 0 || priceImpact.length > 0 || topupPremium > 1) && (
            <section className="card">
              <h2>Margin and cash</h2>
              {mod.purchasing && topupPremium > 1 && <p>{dot("amber")} <b>Non-standard buying cost {gbp(topupPremium)} over standard rates in {VELOCITY_DAYS} days.</b></p>}
              {priceImpact.length > 0 && <p>{dot("amber")} <b>Costs moved ≥5% on last price refresh:</b> {priceImpact.map((x) => `${x.name} ${gbp(x.before)}→${gbp(x.after)}`).join(" · ")}</p>}
              {marginBreaches.length > 0 && <p>{dot("red")} <b>Below your {settings.marginFloorPct}% margin floor at {gbp(settings.sellPrice)}:</b> {marginBreaches.map((r) => `${r.name} (${Math.round(r.margin / r.sellAt * 100)}%)`).join(" · ")}</p>}
              {postedBreaches.length > 0 && <p>{dot("amber")} <b>Fine as packs, below your {settings.marginFloorPct}% floor when posted on their own:</b> {postedBreaches.map((r) => `${r.name} (${Math.round(r.shippedMargin / r.sellAt * 100)}%)`).join(" · ")}. A single-pack order carries the whole {gbp(shippedTotal)} box.</p>}
              {deadPacks.length > 0 && <p>{dot("amber")} <b>No sales in {VELOCITY_DAYS} days but still shelved:</b> {deadPacks.map((r) => `${r.name} (${finished[r.name]} packs, ${gbp(r.unitCost * (finished[r.name] ?? 0))})`).join(" · ")}</p>}
              {overstocked.length > 0 && <p>{dot("amber")} <b>90+ days of ingredient cover (cash sitting still):</b> {overstocked.slice(0, 6).map((i) => `${i.name} (${gbp(i.stockG * i.costPerG)})`).join(" · ")}{overstocked.length > 6 ? ` · +${overstocked.length - 6} more` : ""}</p>}
            </section>
          )}

          {log.length > 0 && (
            <section className="card">
              <h2>Recent batches</h2>
              <ul className="loglist">{log.slice(0, 6).map((e, i) => (
                <li key={i}><span>{fmtD(e.ts)}</span> {e.recipe} — {e.packs} packs {e.code && <span className="mut">· {e.code} · BB {fmtD(e.bestBefore)}</span>}</li>))}
              </ul>
            </section>
          )}
        </main>
      )}

      {/* ============ RECIPES ============ */}
      {tab === "recipes" && !openRecipe && (
        <main>
          {editRecipe && (() => {
            const e = editRecipe;
            const packG = Math.max(1, parseFloat(e.packSizeG) || 1);
            const sumG = e.lines.filter((l) => !l.ingredient.includes("(units)")).reduce((a, l) => a + (parseFloat(l.perPackG) || 0), 0);
            const cost = e.lines.reduce((a, l) => a + (parseFloat(l.perPackG) || 0) * ((stockMap[l.ingredient] || {}).costPerG || 0), 0);
            const drift = Math.abs(sumG - packG) / packG * 100;
            const pkgE = String(e.pkgOverride ?? "").trim() !== "" ? Math.max(0, parseFloat(e.pkgOverride) || 0) : packagingTotal;
            const sellE = String(e.priceOverride ?? "").trim() !== "" ? Math.max(0, parseFloat(e.priceOverride) || 0) : settings.sellPrice;
            const matches = e.search.trim() ? ings.filter((i) => i.name.toLowerCase().includes(e.search.toLowerCase()) && !e.lines.some((l) => l.ingredient === i.name)).slice(0, 6) : [];
            return (
              <section className="card" style={{ borderColor: "var(--ember)" }}>
                <h2>{e.isNew ? "Add a blend" : `Edit ${e.orig}`}</h2>
                {e.note && <p className="hint">{e.note}</p>}
                <div className="salerow">
                  <input className="cell wide" placeholder="Blend name" value={e.name} disabled={!e.isNew} onChange={(ev) => setEditRecipe({ ...e, name: ev.target.value })} />
                  <input className="cell" placeholder="SKU (auto)" value={e.sku} onChange={(ev) => setEditRecipe({ ...e, sku: ev.target.value })} />
                  <span className="mut">Pack size</span>
                  <input className="cell" type="number" min="1" value={e.packSizeG} onChange={(ev) => setEditRecipe({ ...e, packSizeG: ev.target.value })} />
                  <span className="mut">g</span>
                  <span className="mut">Sell £</span>
                  <input className="cell" placeholder="std" value={e.priceOverride ?? ""} onChange={(ev) => setEditRecipe({ ...e, priceOverride: ev.target.value })} title="Leave blank to use the standard single-pack price" />
                  <span className="mut">Packaging £</span>
                  <input className="cell" placeholder="std" value={e.pkgOverride ?? ""} onChange={(ev) => setEditRecipe({ ...e, pkgOverride: ev.target.value })} title="Leave blank for the standard pouch stack; enter 0 for products whose packaging (bottle, cork, tag) is already in the ingredient lines" />
                </div>
                <div className="salerow" style={{ position: "relative" }}>
                  <input className="search" placeholder="Search ingredients to add… (e.g. paprika)" value={e.search} onChange={(ev) => setEditRecipe({ ...e, search: ev.target.value })} />
                </div>
                {matches.length > 0 && (
                  <div className="salerow">{matches.map((m) => (
                    <button key={m.name} className="mini" onClick={() => recipeAddLine(m.name)}>+ {m.name} <span className="mut">£{m.costPerG.toFixed(4)}/g</span></button>))}
                  </div>
                )}
                {e.search.trim() && matches.length === 0 && <p className="hint">No ingredient matches — add it as a product on the Ingredients tab first, then it's searchable here.</p>}
                {e.lines.length > 0 && (
                  <div className="tblscroll"><table className="tbl">
                    <thead><tr><th>Ingredient</th><th className="num">g / pack</th><th className="num">% of blend</th><th className="num">g / {settings.defaultBatchPacks}-pack batch</th><th className="num">Cost</th><th></th></tr></thead>
                    <tbody>{e.lines.map((l, idx) => {
                      const lg = parseFloat(l.perPackG) || 0;
                      const ic = (stockMap[l.ingredient] || {}).costPerG || 0;
                      return (
                        <tr key={l.ingredient}>
                          <td><b>{l.ingredient}</b></td>
                          <td className="num"><input className="cell" type="number" min="0" step="0.1" value={l.perPackG} onChange={(ev) => recipeSetLine(idx, ev.target.value)} /></td>
                          <td className="num">{sumG > 0 ? (lg / sumG * 100).toFixed(1) : "0"}%</td>
                          <td className="num">{g(lg * (settings.defaultBatchPacks || 10))}</td>
                          <td className="num">{gbp(lg * ic)}</td>
                          <td><button className="mini ghost" onClick={() => recipeRemoveLine(idx)}>remove</button></td>
                        </tr>);
                    })}
                    </tbody>
                  </table></div>
                )}
                <p className="hint" style={{ marginTop: 10 }}>
                  Lines total <b>{g(sumG)}</b> against a {g(packG)} pack{drift > 2 ? <span className="errmsg"> — {sumG > packG ? "over" : "under"} by {g(Math.abs(sumG - packG))}; the pack won't weigh what the label says</span> : " ✓"}. Ingredient cost {gbp(cost)} + packaging {gbp(pkgE)} = <b>{gbp(cost + pkgE)}/pack</b> ({sellE > 0 ? Math.round((sellE - cost - pkgE) / sellE * 100) : 0}% margin at {gbp(sellE)}).
                </p>
                {e.err && <p className="errmsg">{e.err}</p>}
                <div className="actions">
                  <button className="primary" onClick={saveRecipe}>{e.isNew ? "Add blend" : "Save changes"}</button>
                  <button onClick={() => setEditRecipe(null)}>Cancel</button>
                  {!e.isNew && recipes.find((r) => r.name === e.orig)?.custom && <button className="mini ghost" onClick={() => deleteRecipe(e.orig)}>Delete blend</button>}
                </div>
              </section>
            );
          })()}
          <section className="card">
            <div className="filterrow">
              <h2 style={{ margin: 0, flex: 1 }}>Blends<Tip side="left">Tap a blend to brew it, see what it costs and what's blocking it. Bulk changes go through the Excel template; the Guide has the steps.</Tip></h2>
              <button className="mini" onClick={downloadTemplate}>Download Excel template</button>
              <label className="mini filelabel">Upload template<input type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={(e) => { handleImportFile(e.target.files[0]); e.target.value = ""; }} /></label>
              <button className="addbtn" onClick={() => openRecipeEditor(null)}>+ Add blend</button>
            </div>
            <div className="tblscroll"><table className="tbl">
              <thead><tr><th>Blend</th><th className="num">Cost/pack</th><th className="num">Margin per pack</th><th className="num">Sold/60d</th><th>Cover</th><th className="num">Buildable</th><th></th></tr></thead>
              <tbody>{recipeCalc.map((r) => (
                <tr key={r.name} className="rowlink" onClick={() => setOpenRecipe(r.name)}>
                  <td><b>{r.name}</b><div className="mut small">{r.sku} · {r.packSizeG}g{r.group ? ` · ${r.group}` : ""}</div></td>
                  <td className="num">{gbp(r.unitCost)}</td>
                  <td className="num">{gbp(r.margin)} <span className="mut">({Math.round(r.margin / r.sellAt * 100)}% @ {gbp(r.sellAt)}; {Math.round(r.shippedMargin / r.sellAt * 100)}% posted alone)</span></td>
                  <td className="num">{r.salesInWindow}</td>
                  <td>{coverBadge(r.daysCover)}</td>
                  <td className="num">{dot(r.startable ? (r.buildable >= 2 ? "green" : "amber") : "red")} {r.buildable}</td>
                  <td className="chev">›</td>
                </tr>))}
              </tbody>
            </table></div>
          </section>
        </main>
      )}

      {tab === "recipes" && openRecipe && (() => {
        const r = recipeCalc.find((x) => x.name === openRecipe);
        const packs = Math.max(1, parseInt(brewPacksInput) || 1);
        const scaled = r.lines.map((l) => {
          const needN = l.perPackG * packs;
          const canMake = Math.floor(l.stockG / needN);
          const status = l.stockG >= needN * 2 ? "green" : l.stockG >= needN ? "amber" : "red";
          const rate = (stockMap[l.ingredient] || {}).costPerG || 0; // same stock cost per gram as the cost card
          return { ...l, needN, canMakeN: canMake, statusN: status, shortN: Math.max(0, needN - l.stockG), costPack: l.perPackG * rate, costN: needN * rate };
        });
        const startableN = scaled.every((l) => l.statusN !== "red");
        const blendLines = scaled.filter((l) => !l.ingredient.includes("(units)"));
        const blendG = blendLines.reduce((a, l) => a + l.perPackG, 0);
        const blendCostPack = blendLines.reduce((a, l) => a + l.costPack, 0);
        const blendCostN = blendLines.reduce((a, l) => a + l.costN, 0);
        const limitingN = scaled.reduce((worst, l) => (l.stockG / l.needN < (worst ? worst.stockG / worst.needN : Infinity) ? l : worst), null);
        // cost breakdown: same basis as unitCost (stock cost per gram); "(units)" lines count as packaging
        const costRows = r.lines.map((l) => {
          const rate = (stockMap[l.ingredient] || {}).costPerG || 0;
          return { name: l.ingredient, qty: l.perPackG, rate, cost: l.perPackG * rate, unit: l.ingredient.includes("(units)") };
        });
        const ingRows = costRows.filter((x) => !x.unit);
        const pkgRows = [
          ...costRows.filter((x) => x.unit).map((x) => ({ ...x, name: x.name.replace(/\s*\(units\)$/, "") })),
          ...(r.pkgOverride !== undefined
            ? (r.pkgOverride > 0 ? [{ name: "Packaging set on this blend", qty: 1, rate: r.pkgOverride, cost: r.pkgOverride }] : [])
            : Object.entries(settings.packaging).map(([name, v]) => ({ name, qty: 1, rate: parseFloat(v) || 0, cost: parseFloat(v) || 0 }))),
        ];
        const ingTotal = ingRows.reduce((a, x) => a + x.cost, 0);
        const pkgTotal = pkgRows.reduce((a, x) => a + x.cost, 0);
        const shipRows = Object.entries(settings.shippedPackaging || {}).map(([name, v]) => ({ name, rate: parseFloat(v) || 0 }));
        const p3 = (n) => "\u00a3" + n.toFixed(3);
        const share = (n) => (r.unitCost > 0 ? `${(n / r.unitCost * 100).toFixed(1)}%` : "\u2014");
        const pkgNote = r.pkgOverride === undefined
          ? "Pack packaging is the pouch and two labels from Data, API & settings. The postal box only counts on a posted order, once per order, so it sits below the pack cost. Change either in settings and every blend updates."
          : r.pkgOverride > 0
            ? "This blend has its own packaging figure, set in Edit recipe."
            : "Packaging here comes from the recipe\u2019s own lines, costed from the Ingredients tab.";
        return (
          <main>
            <div className="fl-backrow">
              <button className="back" onClick={() => setOpenRecipe(null)}>‹ All blends</button>
              <button className="mini" onClick={() => { setFlavourFocus({ name: r.name, at: Date.now() }); setTab("flavour"); setOpenRecipe(null); }}>Flavour profile ›</button>
            </div>
            <section className="card">
              <div className="rhead">
                <div>
                  <h2>{r.name} <span className="mut">{r.sku}</span></h2>
                  <p className="hint">Ingredients {gbp(ingTotal)} + packaging {gbp(pkgTotal)} = <b>{gbp(r.unitCost)}/pack</b> · selling {r.rate > 0 ? `${(r.rate * 7).toFixed(1)} packs/week` : "no recent sales"}{r.oldestBB && <> · oldest batch BB {fmtD(r.oldestBB)}</>}</p>
                  <div className="salerow" style={{ marginTop: 4 }}>
                    <span className="mut">Batch size</span>
                    <input className="cell" type="number" min="1" step="1" value={brewPacksInput} onChange={(e) => setBrewPacksInput(e.target.value)} />
                    <span className="mut">packs = {g(r.packSizeG * packs)} of blend, {gbp(blendCostN)} of ingredients</span>
                    {[10, 20, 30, 50].map((n) => <button key={n} className={`mini ${packs === n ? "due" : ""}`} onClick={() => setBrewPacksInput(n)}>{n}</button>)}
                  </div>
                </div>
                <div className={`bigstatus ${startableN ? (Math.min(...scaled.map((l) => l.canMakeN)) >= 2 ? "green" : "amber") : "red"}`}>
                  {startableN ? `${packs}-pack batch possible` : `Can't make ${packs} packs`}
                  <div className="lim">{limitingN ? (startableN ? `constraint: ${limitingN.ingredient}` : `short on ${limitingN.ingredient}`) : ""}</div>
                </div>
              </div>
              <div className="tblscroll"><table className="tbl">
                <thead><tr><th>Ingredient</th><th className="num">Per pack</th><th className="num">This batch ({packs})</th><th className="num">In stock</th><th className="num">Batches</th><th>Status</th></tr></thead>
                <tbody>{scaled.map((l) => (
                  <tr key={l.ingredient} className={l.statusN === "red" ? "bad" : ""}>
                    <td>{l.ingredient}</td>
                    <td className="num">{g(l.perPackG)}<div className="mut small">{p3(l.costPack)}</div></td>
                    <td className="num"><b>{g(l.needN)}</b><div className="mut small">{gbp(l.costN)}</div></td>
                    <td className="num">{g(l.stockG)}</td>
                    <td className="num">{isFinite(l.canMakeN) ? l.canMakeN : "∞"}</td>
                    <td>{dot(l.statusN)} {l.statusN === "red" ? `short ${g(l.shortN)}` : l.statusN === "amber" ? "this batch only" : "ok"}</td>
                  </tr>))}
                  <tr className="tot"><td>Blend total</td><td className="num">{g(blendG)}<div className="mut small">{p3(blendCostPack)}</div></td><td className="num"><b>{g(blendG * packs)}</b><div className="mut small">{gbp(blendCostN)}</div></td><td colSpan={3}></td></tr>
                </tbody>
              </table></div>
              <div className="actions">
                <button className="primary" disabled={!startableN} onClick={() => setConfirmBatch({ r, packs })}>
                  {startableN ? `Brew ${packs} packs — uses ingredients` : "Not enough stock — top up or brew fewer"}
                </button>
                <button onClick={() => setPickList({ r, packs })}>Weigh-out list</button>
                <button className="mini" onClick={() => { setOpenRecipe(null); openRecipeEditor(recipes.find((x) => x.name === r.name)); }}>Edit recipe</button>
              </div>
            </section>
            <section className="card">
              <h2>Cost per pack<Tip side="left">One {r.packSizeG}g pack at your current stock cost per gram. {pkgNote}</Tip></h2>
              <p className="hint">A {packs}-pack batch costs <b>{gbp(r.unitCost * packs)}</b>.</p>
              <div className="tblscroll">
                <table className="tbl">
                  <thead><tr><th>Item</th><th className="num">Per pack</th><th className="num">Unit price</th><th className="num">Cost</th><th className="num">Share</th></tr></thead>
                  <tbody>
                    <tr className="grp"><td colSpan={5}>Ingredients</td></tr>
                    {ingRows.map((x) => (
                      <tr key={`i-${x.name}`}>
                        <td>{x.name}</td>
                        <td className="num">{g(x.qty)}</td>
                        <td className="num">{x.rate > 0 ? `\u00a3${(x.rate * 1000).toFixed(2)}/kg` : "\u2014"}</td>
                        <td className="num">{p3(x.cost)}</td>
                        <td className="num">{share(x.cost)}</td>
                      </tr>))}
                    <tr className="costsub"><td colSpan={3}>Ingredients total</td><td className="num">{gbp(ingTotal)}</td><td className="num">{share(ingTotal)}</td></tr>
                    <tr className="grp"><td colSpan={5}>Packaging</td></tr>
                    {pkgRows.length === 0
                      ? <tr><td colSpan={5} className="mut">No packaging cost on this blend.</td></tr>
                      : pkgRows.map((x) => (
                        <tr key={`p-${x.name}`}>
                          <td>{x.name}</td>
                          <td className="num">{x.qty}</td>
                          <td className="num">{`\u00a3${x.rate.toFixed(2)} each`}</td>
                          <td className="num">{p3(x.cost)}</td>
                          <td className="num">{share(x.cost)}</td>
                        </tr>))}
                    <tr className="costsub"><td colSpan={3}>Packaging total</td><td className="num">{gbp(pkgTotal)}</td><td className="num">{share(pkgTotal)}</td></tr>
                    <tr className="tot"><td colSpan={3}>Cost per pack</td><td className="num">{gbp(r.unitCost)}</td><td className="num">100%</td></tr>
                    <tr className="costsub"><td colSpan={3}>Margin at {gbp(r.sellAt)}{r.sellAt > 0 ? ` (${Math.round(r.margin / r.sellAt * 100)}%)` : ""}</td><td className="num">{gbp(r.margin)}</td><td></td></tr>
                    <tr className="grp"><td colSpan={5}>If posted on its own</td></tr>
                    {shipRows.map((x) => (
                      <tr key={`s-${x.name}`}><td>{x.name}</td><td className="num">1</td><td className="num">{`\u00a3${x.rate.toFixed(2)} each`}</td><td className="num">{p3(x.rate)}</td><td></td></tr>))}
                    <tr className="tot"><td colSpan={3}>Cost of a single pack posted</td><td className="num">{gbp(r.shippedCost)}</td><td></td></tr>
                    <tr className="costsub"><td colSpan={3}>Margin at {gbp(r.sellAt)}{r.sellAt > 0 ? ` (${Math.round(r.shippedMargin / r.sellAt * 100)}%)` : ""}</td><td className="num">{gbp(r.shippedMargin)}</td><td></td></tr>
                  </tbody>
                </table>
              </div>
            </section>
          </main>
        );
      })()}

      {/* ============ INGREDIENTS ============ */}
      {tab === "ingredients" && (
        <main>
          {editIng && (
            <section className="card" style={{ borderColor: "var(--ember)" }}>
              <h2>{editIng.isNew ? "Add an ingredient" : `Edit ${editIng.name}`}</h2>
              <div className="setrow"><label>Name</label>
                <input className="cell wide" value={editIng.newName} disabled={!editIng.isNew} onChange={(e) => setEditIng({ ...editIng, newName: e.target.value })} placeholder="e.g. Smoked Sea Salt" /></div>
              <div className="setrow"><label>Supplier</label>
                <input className="cell wide" value={editIng.supplier} onChange={(e) => setEditIng({ ...editIng, supplier: e.target.value })} /></div>
              <div className="setrow"><label>Pack size you buy (g)</label>
                <input className="cell" type="number" min="0" value={editIng.packSizeG} onChange={(e) => setEditIng({ ...editIng, packSizeG: e.target.value })} /></div>
              <div className="setrow"><label>Cost price per pack (£)</label>
                <input className="cell" type="number" min="0" step="0.01" value={editIng.packPrice} onChange={(e) => setEditIng({ ...editIng, packPrice: e.target.value })} /></div>
              <div className="setrow"><label>Your own minimum (g, optional)<Tip side="left">Raises the reorder line above the automatic one. Leave blank to use the automatic line.</Tip></label>
                <input className="cell" type="number" min="0" value={editIng.parG} onChange={(e) => setEditIng({ ...editIng, parG: e.target.value })} placeholder="auto" /></div>
              <p className="hint">Works out to {(() => { const s = parseFloat(editIng.packSizeG) || 0; const p = parseFloat(editIng.packPrice) || 0; return s > 0 ? `£${(p / s * 100).toFixed(2)}/100g (£${(p / s).toFixed(4)}/g)` : "—"; })()} normal shelf price.{!editIng.isNew && editIng.stockNow > 0 && Math.abs(editIng.carryRate - (parseFloat(editIng.packPrice) || 0) / (parseFloat(editIng.packSizeG) || 1)) > 0.0002 && <> Stock on the shelf averaged £{(editIng.carryRate * 100).toFixed(2)}/100g, and blend costs use that.</>}</p>
              {editIng.err && <p className="errmsg">{editIng.err}</p>}
              <div className="actions">
                <button className="primary" onClick={saveEditor}>{editIng.isNew ? "Add ingredient" : "Save changes"}</button>
                <button onClick={() => setEditIng(null)}>Cancel</button>
                {!editIng.isNew && usedInRecipes(editIng.name) === 0 && <button className="mini ghost" onClick={() => deleteIngredient(editIng.name)}>Delete ingredient</button>}
                {!editIng.isNew && usedInRecipes(editIng.name) > 0 && <span className="mut small">In {usedInRecipes(editIng.name)} recipe{usedInRecipes(editIng.name) === 1 ? "" : "s"} — can't be deleted</span>}
              </div>
            </section>
          )}
          <section className="card">
            <h2>Ingredient stock<Tip side="left">Type grams into Stock after counting a shelf; it saves when you leave the box and marks the shelf counted. +pack books in a normal delivery; buy records any other purchase at the price paid.</Tip></h2>
            <div className="filterrow">
              <input className="search" placeholder="Filter ingredients…" value={ingFilter} onChange={(e) => setIngFilter(e.target.value)} />
              <button className="mini" onClick={downloadTemplate}>Excel template</button>
              <label className="mini filelabel">Upload<input type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={(e) => { handleImportFile(e.target.files[0]); e.target.value = ""; }} /></label>
              <button className="addbtn" onClick={() => openEditor(null)}>＋ New ingredient</button>
            </div>
            <div className="tblscroll"><table className="tbl">
              <thead><tr><th>Ingredient</th><th>Role<Tip>Core: in 8 or more blends, so running out blocks most of the range. Shared: 4 to 7 blends. Solo: 1 to 3.</Tip></th><th className="num">Stock (g)</th><th className="num">Reorder at<Tip side="right">{velocity.total >= MIN_SALES_FOR_DEMAND ? `Daily use × (${settings.leadTimeDays} days lead + ${settings.safetyDays} days safety), never below one batch.` : `${settings.reorderBatches} batches of the heaviest blend until ${MIN_SALES_FOR_DEMAND} sales are logged, then real demand.`} Your own minimum can raise it.</Tip></th><th>Status</th>{mod.counts && <th>Count<Tip side="right">How often to count, set by each ingredient's yearly value: weekly, monthly or quarterly.</Tip></th>}<th></th></tr></thead>
              <tbody>{[...ingCalc].sort((a, b) => (a.key || 9) - (b.key || 9) || b.totalDrawG - a.totalDrawG).filter((i) => i.name.toLowerCase().includes(ingFilter.toLowerCase())).map((i) => (
                <tr key={i.name} className={i.status === "red" ? "bad" : ""}>
                  <td><b>{i.name}</b><div className="mut small">{i.supplier} · {i.blends > 0 ? `${i.blends} blend${i.blends === 1 ? "" : "s"} · ${g(i.totalDrawG)}/full cycle` : "not in any recipe yet"}{i.parSet ? " · manual par" : ""}{i.onOrderG > 0 ? <span className="okmsg"> · {g(i.onOrderG)} on order</span> : ""}</div></td>
                  <td>{i.key ? <span className={`kkey k${i.key}`}>{["","Core","Shared","Solo"][i.key]}</span> : <span className="mut">—</span>}</td>
                  <td className="num"><NumCell min="0" step="10" value={i.stockG} onCommit={(v) => setStock(i.name, v)} aria-label={`${i.name} stock in grams`} /></td>
                  <td className="num">{g(i.threshold)}<div className="mut small">{i.parSet ? "your par" : i.demandMode ? "lead + safety days" : `${settings.reorderBatches}× ${i.drivenBy}`}</div></td>
                  <td>{dot(i.status)} {i.status === "red" ? "below 1 batch" : i.status === "amber" ? "reorder soon" : "ok"}</td>
                  {mod.counts && <td>{({ A: "weekly", B: "monthly", C: "quarterly" })[i.abc]}{i.countDue ? <div><button className="mini due" onClick={() => markCounted(i.name)}>overdue: tap when counted</button></div> : <div className="mut small">✓ {i.lastCounted ? fmtD(i.lastCounted) : "not yet"}</div>}</td>}
                  <td className="nowrap">{mod.purchasing && i.onOrderG > 0 ? <button className="mini due" onClick={() => bookInOrder(i.name)}>book in</button> : (i.packSizeG > 0 && <button className="mini" onClick={() => receivePack(i.name)}>+{i.packSizeG}g</button>)} {mod.purchasing && <button className="mini" onClick={() => setBuyForm({ name: i.name, grams: i.packSizeG || 250, price: Math.round(stdOf(i) * (i.packSizeG || 250) * 100) / 100 })}>buy</button>} <button className="mini" onClick={() => openEditor(i)}>edit</button></td>
                </tr>))}
              </tbody>
            </table></div>
          </section>
        </main>
      )}

      {/* ============ FLAVOUR ============ */}
      {(flavourSeen || tab === "flavour") && (
        <div hidden={tab !== "flavour"}>
          <FlavourTab recipes={recipes} ings={ings} stockMap={stockMap} settings={settings} packagingTotal={packagingTotal}
            updateSetting={flavourUpdate} onOpenDraft={flavourDraft} focus={flavourFocus} />
        </div>
      )}

      {/* ============ FINISHED PACKS ============ */}
      {/* ============ COST TIERS ============ */}
      {tab === "costs" && (() => {
        const t = costTierCalc;
        const TIER = ["Premium", "Middle", "Lower"];
        const KEYS = [[1, "Core", "in 8+ blends"], [2, "Shared", "in 4 to 7 blends"], [3, "Solo", "in 1 to 3 blends"]];
        const pct = (x) => Math.abs(Math.round(x * 100));
        const chg = (x) => (x.change === null
          ? <span className="tchg new">{x.isNew ? "new" : "\u2014"}</span>
          : <span className={`tchg ${x.change > 0.005 ? "up" : x.change < -0.005 ? "down" : ""}`}>{x.change > 0.005 ? "\u25b2" : x.change < -0.005 ? "\u25bc" : ""}{pct(x.change)}%</span>);
        const sorters = { risk: (a, b) => b.risk - a.risk, rise: (a, b) => (b.change ?? -9) - (a.change ?? -9) || b.risk - a.risk, kg: (a, b) => b.perKg - a.perKg, blends: (a, b) => b.blends - a.blends || b.risk - a.risk };
        const ranked = [...t.rows].sort(sorters[costSort] || sorters.risk);
        const rose = t.rows.filter((x) => x.change !== null && x.change > 0.005);
        const moved = t.rows.reduce((a, x) => a + (x.delta || 0), 0);
        const top = [...t.rows].sort((a, b) => b.risk - a.risk)[0];
        const basis = t.weighted ? "a week of sales" : "one pack of every blend that uses it";
        const usedList = (u) => (u.length > 4 ? `${u.slice(0, 4).join(", ")} +${u.length - 4} more` : u.join(", "));
        return (
          <main>
            <section className="card">
              <h2>Ingredient cost tiers<Tip side="left">Every costed ingredient, tiered by price per kg and split by how many blends use it. Movement compares today's rates with the rates just before your last costing upload.</Tip></h2>
              <p className="hint">{t.base ? `Movement since the ${t.base.source.toLowerCase()} on ${fmtD(t.base.at)}.` : "Movement shows from your next price refresh or bulk upload."}</p>
              <div className="statrow">
                <div className="stat"><div className="n">{t.rows.filter((x) => x.tier === 0).length}<span>/{t.rows.length}</span></div><div className="l">premium ingredients (£{t.tiers.premiumFrom}+/kg)</div></div>
                <div className="stat"><div className="n">{rose.length}</div><div className="l">got dearer since the last upload</div></div>
                <div className="stat"><div className="n">{moved >= 0 ? "+" : "\u2212"}{gbp(Math.abs(moved))}</div><div className="l">ingredient cost change across {t.weighted ? "a week of sales" : "one pack of every blend"}</div></div>
                {top && <div className="stat"><div className="n" style={{ fontSize: 19 }}>{top.name}</div><div className="l">highest risk: {gbp(top.exposure)} across {t.weighted ? "a week" : "a pack of each blend it's in"}{top.change ? `, ${top.change > 0 ? "up" : "down"} ${pct(top.change)}%` : ""}</div></div>}
              </div>
              <div className="salerow" style={{ marginTop: 12, marginBottom: 0 }}>
                <span className="mut">Premium from £</span>
                <input className="cell" type="number" min="0" step="1" value={t.tiers.premiumFrom} onChange={(e) => updateSetting({ costTiers: { ...t.tiers, premiumFrom: Math.max(0, parseFloat(e.target.value) || 0) } })} />
                <span className="mut">/kg, lower below £</span>
                <input className="cell" type="number" min="0" step="1" value={t.tiers.lowerBelow} onChange={(e) => updateSetting({ costTiers: { ...t.tiers, lowerBelow: Math.max(0, parseFloat(e.target.value) || 0) } })} />
                <span className="mut">/kg</span>
              </div>
            </section>
            <section className="card">
              <h2>Tier by blend presence<Tip side="left">Red cells hold the expensive ingredients your range leans on most; amber is the next band. Each line shows price per kg and its move since the last upload.</Tip></h2>
              <div className="tiergrid">
                <div className="th" />
                {KEYS.map(([k, label, sub]) => <div className="th" key={k}>{label}<div className="small">{sub}</div></div>)}
                {TIER.map((tn, ti) => (
                  <Fragment key={tn}>
                    <div className="th rowh">{tn}<div className="small">{ti === 0 ? `£${t.tiers.premiumFrom}+/kg` : ti === 2 ? `under £${t.tiers.lowerBelow}/kg` : `£${t.tiers.lowerBelow} to £${t.tiers.premiumFrom}/kg`}</div></div>
                    {KEYS.map(([k, label]) => {
                      const items = t.rows.filter((x) => x.tier === ti && x.key === k).sort((a, b) => b.risk - a.risk);
                      const heat = (2 - ti) + (3 - k);
                      return (
                        <div key={k} className={`tcell ${heat >= 3 ? "hot" : heat === 2 ? "warm" : ""}`}>
                          <div className="cap">{tn} · {label}</div>
                          {items.length === 0 ? <div className="mut small">None</div> : items.map((x) => (
                            <div className="tchip" key={x.name}><span>{x.name}</span><span className="num">£{x.perKg.toFixed(2)}{chg(x)}</span></div>))}
                        </div>);
                    })}
                  </Fragment>
                ))}
              </div>
            </section>
            <section className="card">
              <h2>Highest cost and risk<Tip side="left">Ranked by what each ingredient costs across {basis}, scaled up by any price rise since the last upload.</Tip></h2>
              <div className="salerow">
                <span className="mut">Sort by</span>
                {[["risk", "Risk"], ["rise", "Rise since upload"], ["kg", "£ per kg"], ["blends", "Blends"]].map(([k, l]) => <button key={k} className={`mini ${costSort === k ? "due" : ""}`} onClick={() => setCostSort(k)}>{l}</button>)}
              </div>
              <div className="tblscroll"><table className="tbl">
                <thead><tr><th>#</th><th>Ingredient</th><th>Tier</th><th>In blends</th><th className="num">£ per kg</th><th className="num">Since upload</th><th className="num">Cost across blends</th></tr></thead>
                <tbody>{(costAll ? ranked : ranked.slice(0, 20)).map((x, i) => (
                  <tr key={x.name}>
                    <td className="mut">{i + 1}</td>
                    <td><b>{x.name}</b><div className="mut small">{usedList(x.used)}</div></td>
                    <td><span className={`tier t${x.tier}`}>{TIER[x.tier]}</span></td>
                    <td className="nowrap">{x.key ? <span className={`kkey k${x.key}`}>{["", "Core", "Shared", "Solo"][x.key]}</span> : null} <span className="mut">{x.blends}</span></td>
                    <td className="num">£{x.perKg.toFixed(2)}{x.wasPerKg !== null && Math.abs(x.wasPerKg - x.perKg) > 0.005 && <div className="mut small">was £{x.wasPerKg.toFixed(2)}</div>}</td>
                    <td className="num">{chg(x)}</td>
                    <td className="num">{gbp(x.exposure)}{x.delta !== null && Math.abs(x.delta) >= 0.005 && <div className={`small tchg ${x.delta > 0 ? "up" : "down"}`}>{x.delta > 0 ? "+" : "\u2212"}{gbp(Math.abs(x.delta))}</div>}</td>
                  </tr>))}
                </tbody>
              </table></div>
              {ranked.length > 20 && <div className="actions" style={{ marginTop: 8 }}><button className="mini" onClick={() => setCostAll(!costAll)}>{costAll ? "Show top 20" : `Show all ${ranked.length}`}</button></div>}
              {t.unused.length > 0 && <p className="hint" style={{ marginTop: 10 }}>Not in any blend, so not ranked: {t.unused.join(", ")}.</p>}
              {t.uncosted.length > 0 && <p className="hint" style={{ marginTop: 4, marginBottom: 0 }}>No price recorded: {t.uncosted.join(", ")}.</p>}
            </section>
          </main>);
      })()}

      {tab === "stock" && (
        <main>
          <section className="card">
            <h2>Finished packs on the shelf<Tip side="left">Type a number to correct the shelf after a count. −1 and −3 record a sale and take the packs off. Brews add packs. Sell the oldest best-before first.</Tip></h2>
            <div className="tblscroll"><table className="tbl">
              <thead><tr><th>Blend</th><th className="num">Packs</th><th>Cover</th><th>Oldest BB</th><th className="num">Shelf value</th><th>Sell</th></tr></thead>
              <tbody>{recipeCalc.map((r) => {
                const n = finished[r.name] ?? 0;
                return (
                  <tr key={r.name} className={n === 0 ? "bad" : ""}>
                    <td><b>{r.name}</b></td>
                    <td className="num"><NumCell min="0" value={n} onCommit={(v) => setPacks(r.name, v)} aria-label={`${r.name} packs on the shelf`} /></td>
                    <td>{coverBadge(r.daysCover)}</td>
                    <td className="mut">{r.oldestBB ? fmtD(r.oldestBB) : "—"}</td>
                    <td className="num">{gbp(r.unitCost * n)}</td>
                    <td>
                      <button className="mini" onClick={() => recordSale(r.name, 1)}>−1</button>{" "}
                      <button className="mini" onClick={() => recordSale(r.name, 3)}>−3</button>
                    </td>
                  </tr>);
              })}
              </tbody>
            </table></div>
          </section>
        </main>
      )}

      {/* ============ SALES ============ */}
      {tab === "sales" && (
        <main>
          <section className="card">
            <h2>Log a sale<Tip side="left">Sales in the last {VELOCITY_DAYS} days set each blend's selling rate, which drives days of cover and reorder lines. Backdate with the date field to catch up. A Shopify, Etsy or Square export uploads as it comes.</Tip></h2>
            <div className="salerow">
              <select className="cell wide" value={saleForm.sku} onChange={(e) => setSaleForm({ ...saleForm, sku: e.target.value })}>
                {recipes.map((r) => <option key={r.name}>{r.name}</option>)}
              </select>
              <input className="cell" type="number" min="1" value={saleForm.qty} onChange={(e) => setSaleForm({ ...saleForm, qty: e.target.value })} />
              <select className="cell" value={saleForm.channel} onChange={(e) => setSaleForm({ ...saleForm, channel: e.target.value })}>
                {["Shopify", "Etsy", "Event", "Wholesale", "Other"].map((c) => <option key={c}>{c}</option>)}
              </select>
              <input className="cell" type="date" value={saleForm.date} onChange={(e) => setSaleForm({ ...saleForm, date: e.target.value })} />
              <button className="mini" onClick={addSaleForm}>Add sale</button>
              <label className="mini filelabel">Upload sales file<input type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={(e) => { handleSalesFile(e.target.files[0]); e.target.value = ""; }} /></label>
            </div>
            {csvMsg && <p className={csvMsg.ok ? "okmsg" : "errmsg"}>{csvMsg.text}</p>}
          </section>
          <section className="card">
            <h2>Velocity, last {VELOCITY_DAYS} days</h2>
            <div className="tblscroll"><table className="tbl">
              <thead><tr><th>Blend</th><th className="num">Sold</th><th className="num">Per week</th><th>Cover on shelf</th></tr></thead>
              <tbody>{[...recipeCalc].sort((a, b) => b.salesInWindow - a.salesInWindow).map((r) => (
                <tr key={r.name}><td><b>{r.name}</b></td><td className="num">{r.salesInWindow}</td><td className="num">{(r.rate * 7).toFixed(1)}</td><td>{coverBadge(r.daysCover)}</td></tr>))}
              </tbody>
            </table></div>
          </section>
          {shrinkCalc.byChannel.length > 0 && (
            <section className="card">
              <h2>Channel P&amp;L, last {VELOCITY_DAYS} days<Tip side="left">Net of each channel's fees and, on channels that post orders, one postal box per order.</Tip></h2>
              <div className="tblscroll"><table className="tbl">
                <thead><tr><th>Channel</th><th className="num">Units</th><th className="num">Gross</th><th className="num">Fees</th><th className="num">Boxes</th><th className="num">Net</th><th className="num">GP</th><th className="num">GP%</th></tr></thead>
                <tbody>{shrinkCalc.byChannel.map((c) => (
                  <tr key={c.channel}><td><b>{c.channel}</b></td><td className="num">{c.units}</td><td className="num">{gbp(c.gross)}</td><td className="num">{gbp(c.fees)}</td><td className="num">{c.posted ? `${gbp(c.shipPack)} (${c.posted})` : "\u2014"}</td><td className="num">{gbp(c.net)}</td><td className="num">{gbp(c.gp)}</td><td className="num">{c.gross > 0 ? Math.round(c.gp / c.gross * 100) : 0}%</td></tr>))}
                </tbody>
              </table></div>
            </section>
          )}
          {sales.length > 0 && (
            <section className="card">
              <h2>Sales log</h2>
              <ul className="loglist">{sales.slice(0, 15).map((s, i) => (
                <li key={i}><span>{fmtD(s.ts)}</span>{s.qty} × {s.sku} <span className="mut">· {s.channel}</span> <button className="mini ghost" onClick={() => deleteSale(i)}>undo</button></li>))}
              </ul>
            </section>
          )}
        </main>
      )}

      {/* ============ BUNDLES ============ */}
      {tab === "bundles" && (() => {
        const bc = bundleCost(builder.items, builder.packagingCost, builder.shippedPackagingCost);
        const price = parseFloat(builder.salePrice) || 0;
        const chan = builder.channel || "Direct";
        const fee = feeFor(chan, price);
        const posted = isShipped(chan);
        const cost = posted ? bc.posted : bc.inPerson;
        const num = (v) => parseFloat(v) || 0;
        const gp = price - fee - cost;
        const gpPct = price > 0 ? gp / price * 100 : 0;
        const gpClass = gpPct >= 60 ? "green" : gpPct >= 40 ? "amber" : "red";
        const singlesPrice = builder.items.length * settings.sellPrice;
        return (
          <main>
            <section className="card">
              <h2>Build your bundle<Tip side="left">Bundle packaging is what the bundle always carries. Posted-only packaging, such as a gift-box belly band, counts only when the channel posts the order, along with one postal box for the whole order.</Tip></h2>
              <div className="salerow">
                <input className="cell wide" placeholder="Bundle name, e.g. Flare up the Fire" value={builder.name} onChange={(e) => setBuilder({ ...builder, name: e.target.value })} />
                <button className="mini" onClick={saveBundle} disabled={!builder.name.trim()}>Save bundle</button>
              </div>
              {builder.items.map((item, idx) => {
                const r = recipeCalc.find((x) => x.name === item);
                return (
                  <div className="salerow" key={idx}>
                    <span className="mut slotn">{idx + 1}.</span>
                    <select className="cell wide" value={item} onChange={(e) => {
                      const items = [...builder.items]; items[idx] = e.target.value; setBuilder({ ...builder, items });
                    }}>
                      {recipes.map((x) => <option key={x.name}>{x.name}</option>)}
                    </select>
                    <span className="mut">{r ? `${gbp(r.unitCost)} cost · ${finished[r.name] ?? 0} shelved` : ""}</span>
                    <button className="mini ghost" onClick={() => setBuilder({ ...builder, items: builder.items.filter((_, i) => i !== idx) })}>remove</button>
                  </div>);
              })}
              <div className="actions">
                <button className="mini" onClick={() => setBuilder({ ...builder, items: [...builder.items, recipes[0].name] })}>+ Add slot</button>
                <span className="mut">Bundle packaging £</span>
                <input className="cell" type="number" min="0" step="0.01" value={builder.packagingCost} onChange={(e) => setBuilder({ ...builder, packagingCost: e.target.value })} />
                <span className="mut">Posted-only £</span>
                <input className="cell" type="number" min="0" step="0.01" value={builder.shippedPackagingCost ?? 0} onChange={(e) => setBuilder({ ...builder, shippedPackagingCost: e.target.value })} title="Only counted when the channel posts the order, e.g. the belly band" />
              </div>
            </section>

            <section className="card">
              <h2>Price it</h2>
              <div className="pricehead">
                <div className="pricebig">{gbp(price)}</div>
                <div className="salerow" style={{ margin: 0 }}>
                  <span className="mut">Channel</span>
                  <select className="cell" value={chan} onChange={(e) => setBuilder({ ...builder, channel: e.target.value })}>
                    {["Direct", "Event", "Shopify", "Etsy", "Wholesale"].map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className={`bigstatus ${gpClass}`}>GP {gbp(gp)} <span className="lim">{gpPct.toFixed(0)}% net margin</span></div>
              </div>
              <input className="slider" type="range" min="2" max="60" step="0.5" value={price} onChange={(e) => setBuilder({ ...builder, salePrice: e.target.value })} />
              <div className="sliderlabels"><span>£2</span><span>£60</span></div>
              <div className="gpbar"><div className="gpfill" style={{ width: `${Math.max(0, Math.min(100, gpPct))}%` }} /><div className="gpcost" style={{ width: `${price > 0 ? Math.min(100, cost / price * 100) : 100}%` }} /></div>
              <p className="hint" style={{ marginTop: 10 }}>
                Cost stack: ingredients {gbp(bc.ingredientCost)} + pack packaging {gbp(bc.packPackaging)} + bundle packaging {gbp(num(builder.packagingCost))}{posted && <> + posting {gbp(bc.postedExtra)} (box {gbp(shippedTotal)}, posted-only {gbp(num(builder.shippedPackagingCost))})</>} = <b>{gbp(cost)}</b> {posted ? `as a posted ${chan} order` : "sold in person"}{fee > 0 && <>, plus {chan} fees {gbp(fee)} at this price</>}.
                {builder.items.length > 1 && <> As singles: {gbp(singlesPrice)}, so the customer saves {gbp(Math.max(0, singlesPrice - price))} ({singlesPrice > 0 ? Math.round(Math.max(0, singlesPrice - price) / singlesPrice * 100) : 0}%).</>}
              </p>
              <div className="tblscroll"><table className="tbl">
                <thead><tr><th>Slot</th><th className="num">Ingredients</th><th className="num">Full cost/pack</th></tr></thead>
                <tbody>{bc.rows.map((r, i) => (
                  <tr key={i}><td>{r.name}</td><td className="num">{gbp(r.ingredientCost)}</td><td className="num">{gbp(r.unitCost)}</td></tr>))}
                </tbody>
              </table></div>
            </section>

            {bundles.length > 0 && (
              <section className="card">
                <h2>Saved bundles</h2>
                <div className="tblscroll"><table className="tbl">
                  <thead><tr><th>Bundle</th><th>Contents</th><th className="num">Cost in person</th><th className="num">Cost posted</th><th className="num">Price</th><th className="num">GP in person</th><th className="num">GP posted</th><th></th></tr></thead>
                  <tbody>{bundles.map((b) => {
                    const c = bundleCost(b.items, b.packagingCost, b.shippedPackagingCost);
                    const bgp = b.salePrice - c.inPerson;
                    const pgp = b.salePrice - c.posted;
                    return (
                      <tr key={b.id}>
                        <td><b>{b.name}</b></td>
                        <td className="mut small">{b.items.join(" + ")}</td>
                        <td className="num">{gbp(c.inPerson)}</td>
                        <td className="num">{gbp(c.posted)}</td>
                        <td className="num">{gbp(b.salePrice)}</td>
                        <td className="num">{gbp(bgp)} <span className="mut">({b.salePrice > 0 ? Math.round(bgp / b.salePrice * 100) : 0}%)</span></td>
                        <td className="num">{gbp(pgp)} <span className="mut">({b.salePrice > 0 ? Math.round(pgp / b.salePrice * 100) : 0}%)</span></td>
                        <td><button className="mini" onClick={() => loadBundle(b)}>edit</button> <button className="mini ghost" onClick={() => deleteBundle(b.id)}>delete</button></td>
                      </tr>);
                  })}
                  </tbody>
                </table></div>
              </section>
            )}
          </main>
        );
      })()}

      {/* ============ EVENTS ============ */}
      {tab === "events" && !openEvent && (
        <main>
          <section className="card">
            <h2>Event planner<Tip side="left">Set the packs you want to take per blend. The plan works out batches to brew beyond what's shelved, the ingredients needed and what to order.</Tip></h2>
            <div className="salerow">
              <input className="cell wide" placeholder="Event name, e.g. GBFF 2026" value={evForm.name} onChange={(e) => setEvForm({ ...evForm, name: e.target.value })} />
              <input className="cell" type="date" value={evForm.date} onChange={(e) => setEvForm({ ...evForm, date: e.target.value })} />
              <button className="mini" onClick={addEvent}>Create</button>
            </div>
            {events.length === 0 ? <p className="empty">No events planned yet.</p> : (
              <div className="tblscroll"><table className="tbl">
                <thead><tr><th>Event</th><th>Date</th><th className="num">Target packs</th><th className="num">Batches to brew</th><th></th></tr></thead>
                <tbody>{events.map((ev) => {
                  const p = planEvent(ev);
                  const tot = Object.values(ev.targets).reduce((a, b) => a + b, 0);
                  return (
                    <tr key={ev.id} className="rowlink" onClick={() => setOpenEvent(ev.id)}>
                      <td><b>{ev.name}</b></td><td className="mut">{ev.date ? fmtD(ev.date) : "—"}</td>
                      <td className="num">{tot}</td><td className="num">{p.totBatches}</td><td className="chev">›</td>
                    </tr>);
                })}
                </tbody>
              </table></div>
            )}
          </section>
        </main>
      )}

      {tab === "events" && openEvent && (() => {
        const ev = events.find((e) => e.id === openEvent);
        if (!ev) return null;
        const plan = planEvent(ev);
        return (
          <main>
            <button className="back" onClick={() => setOpenEvent(null)}>‹ All events</button>
            <section className="card">
              <h2>{ev.name} {ev.date && <span className="mut">· {fmtD(ev.date)}</span>}<Tip side="left">The brew plan rounds up to whole {settings.defaultBatchPacks}-pack batches; spare packs go back on the shelf.</Tip></h2>
              <div className="tblscroll"><table className="tbl">
                <thead><tr><th>Blend</th><th className="num">Take to event</th><th className="num">On shelf</th><th className="num">Brew</th></tr></thead>
                <tbody>{recipeCalc.map((r) => {
                  const item = plan.items.find((x) => x.r.name === r.name);
                  return (
                    <tr key={r.name}>
                      <td><b>{r.name}</b></td>
                      <td className="num"><NumCell min="0" value={ev.targets[r.name] ?? 0} onCommit={(v) => setTarget(ev.id, r.name, v)} aria-label={`${r.name} packs to take`} /></td>
                      <td className="num">{finished[r.name] ?? 0}</td>
                      <td className="num">{item ? (item.batches > 0 ? `${item.batches} batch${item.batches === 1 ? "" : "es"} (+${item.brewPacks - item.toBrew} spare)` : "covered") : "—"}</td>
                    </tr>);
                })}
                </tbody>
              </table></div>
            </section>
            {plan.totBatches > 0 && (
              <section className="card">
                <h2>Brew plan: {plan.totBatches} batches</h2>
                {plan.buy.length === 0 ? <p className="empty">Current ingredient stock covers the whole brew plan.</p> : (
                  <>
                    <p className="hint">Order before brew day. Estimated spend {gbp(plan.buyCost)}.</p>
                    <div className="tblscroll"><table className="tbl">
                      <thead><tr><th>Ingredient</th><th className="num">Needed</th><th className="num">In stock</th><th className="num">Order</th><th className="num">Est. cost</th></tr></thead>
                      <tbody>{plan.buy.map((b) => (
                        <tr key={b.name}><td><b>{b.name}</b><div className="mut small">{b.supplier}</div></td>
                          <td className="num">{g(b.grams)}</td><td className="num">{g(b.stockG)}</td>
                          <td className="num">{b.packs > 0 ? `${b.packs} × ${g(b.packSizeG)}` : g(b.short)}</td>
                          <td className="num">{gbp(b.cost)}</td></tr>))}
                      </tbody>
                    </table></div>
                    <div className="actions">
                      <button onClick={() => copyText(plan.buy.filter((b) => b.packs > 0).map((b) => `${b.packs} x ${b.packSizeG}g ${b.name} (${b.supplier})`).join("\n"))}>Copy order list</button>
                    </div>
                  </>
                )}
              </section>
            )}
            <div className="actions"><button className="mini ghost" onClick={() => deleteEvent(ev.id)}>Delete event</button></div>
          </main>
        );
      })()}

      {/* ============ SHRINK & GIFTING ============ */}
      {tab === "shrinkage" && (
        <main>
          <section className="card">
            <h2>Record shrink or a gift<Tip side="left">Logs the loss and takes it off stock in one move. Gifts count too: the hit to profit is the same.</Tip></h2>
            <div className="salerow">
              <select className="cell" value={shrinkForm.kind} onChange={(e) => {
                const kind = e.target.value;
                setShrinkForm({ ...shrinkForm, kind, name: kind === "pack" ? recipes[0].name : ings[0].name, qty: kind === "pack" ? 1 : 50 });
              }}>
                <option value="pack">Finished pack</option>
                <option value="ingredient">Ingredient</option>
              </select>
              <select className="cell wide" value={shrinkForm.name} onChange={(e) => setShrinkForm({ ...shrinkForm, name: e.target.value })}>
                {(shrinkForm.kind === "pack" ? recipes.map((r) => r.name) : ings.map((i) => i.name)).map((n) => <option key={n}>{n}</option>)}
              </select>
              <input className="cell" type="number" min={shrinkForm.kind === "pack" ? 1 : 0.1} step={shrinkForm.kind === "pack" ? 1 : 10} value={shrinkForm.qty} onChange={(e) => setShrinkForm({ ...shrinkForm, qty: e.target.value })} />
              <span className="mut">{shrinkForm.kind === "pack" ? "packs" : "grams"}</span>
              <select className="cell" value={shrinkForm.reason} onChange={(e) => setShrinkForm({ ...shrinkForm, reason: e.target.value })}>
                {["Gift", "Sample", "Spoilage", "Spillage / waste", "Damage", "Unknown"].map((r) => <option key={r}>{r}</option>)}
              </select>
              <button className="mini" onClick={recordShrink}>Log it</button>
            </div>
          </section>

          <section className="statrow">
            <div className="stat"><div className="n">{gbp(shrinkCalc.winValue)}</div><div className="l">shrink at cost, last {VELOCITY_DAYS} days</div></div>
            <div className="stat"><div className="n">{shrinkCalc.pctOfStock.toFixed(1)}%</div><div className="l">of stock on hand ({gbp(shrinkCalc.stockValue)})</div></div>
            <div className="stat"><div className="n">{shrinkCalc.pctOfSales !== null ? shrinkCalc.pctOfSales.toFixed(1) + "%" : "—"}</div><div className="l">of sales revenue (retail shrink rate)</div></div>
            <div className="stat"><div className="n">{shrinkCalc.gpAfterPct !== null ? shrinkCalc.gpAfterPct.toFixed(0) + "%" : "—"}</div><div className="l">GP% after shrink {shrinkCalc.gpPct !== null ? `(was ${shrinkCalc.gpPct.toFixed(0)}%)` : ""}</div></div>
          </section>

          {shrinkCalc.pctOfSales === null && shrinkCalc.winValue > 0 && (
            <section className="card warn"><p className="hint" style={{ margin: 0 }}>Shrink as a share of sales needs sales logged in the last {VELOCITY_DAYS} days.</p></section>
          )}

          {shrinkCalc.win.length > 0 && (
            <section className="card">
              <h2>Where it's going, last {VELOCITY_DAYS} days</h2>
              <div className="twocol">
                <div>
                  <h3>By reason</h3>
                  <div className="tblscroll"><table className="tbl"><tbody>{shrinkCalc.byReason.map(([r, v]) => (
                    <tr key={r}><td>{r}</td><td className="num">{gbp(v)}</td><td className="num mut">{shrinkCalc.winValue > 0 ? Math.round(v / shrinkCalc.winValue * 100) + "%" : ""}</td></tr>))}
                  </tbody></table></div>
                </div>
                <div>
                  <h3>By item</h3>
                  <div className="tblscroll"><table className="tbl"><tbody>{shrinkCalc.byItem.slice(0, 8).map((x) => (
                    <tr key={x.name}><td>{x.name}<div className="mut small">{x.kind === "pack" ? `${x.qty} packs` : g(x.qty)}</div></td><td className="num">{gbp(x.value)}</td></tr>))}
                  </tbody></table></div>
                </div>
              </div>
              <p className="hint" style={{ marginTop: 12 }}>GP after shrink: {gbp(shrinkCalc.revenue)} gross sales − {gbp(shrinkCalc.fees)} channel fees − COGS = {gbp(shrinkCalc.gp)} gross profit, less {gbp(shrinkCalc.winValue)} shrink = <b>{gbp(shrinkCalc.gpAfter)}</b>. All-time shrink: {gbp(shrinkCalc.allValue)}.</p>
            </section>
          )}

          {shrink.length > 0 && (
            <section className="card">
              <h2>Shrink log</h2>
              <ul className="loglist">{shrink.slice(0, 15).map((s, i) => (
                <li key={i}><span>{fmtD(s.ts)}</span>{s.kind === "pack" ? `${s.qty} × ${s.name}` : `${g(s.qty)} ${s.name}`} <span className="mut">· {s.reason} · {gbp(s.value)}</span> <button className="mini ghost" onClick={() => undoShrink(i)}>undo</button></li>))}
              </ul>
            </section>
          )}
          {shrink.length === 0 && <section className="card"><p className="empty">Nothing lost or gifted yet.</p></section>}
        </main>
      )}

      {/* ============ SHOPPING ============ */}
      {tab === "shopping" && (
        <main>
          {onOrderItems.length > 0 && (
            <section className="card">
              <h2>On order<Tip side="left">Counts toward reorder lines, so the list stays quiet, but not toward brewing until you book it in.</Tip></h2>
              <div className="tblscroll"><table className="tbl">
                <thead><tr><th>Ingredient</th><th className="num">Inbound</th><th>Ordered</th><th></th></tr></thead>
                <tbody>{onOrderItems.map((i) => {
                  const days = i.orderedAt ? Math.floor(daysAgo(i.orderedAt)) : 0;
                  return (
                    <tr key={i.name}>
                      <td><b>{i.name}</b><div className="mut small">{i.supplier}</div></td>
                      <td className="num">{g(i.onOrderG)}</td>
                      <td className={days > 7 ? "errmsg" : "mut"}>{days === 0 ? "today" : `${days}d ago`}{days > 7 ? ", overdue?" : ""}</td>
                      <td className="nowrap"><button className="mini" onClick={() => bookInOrder(i.name)}>Book in delivery</button> <button className="mini ghost" onClick={() => cancelOrder(i.name)}>cancel</button></td>
                    </tr>);
                })}
                </tbody>
              </table></div>
            </section>
          )}

          {baskets.length === 0 && <section className="card"><h2>Shopping list</h2><p className="empty">Nothing to order.</p></section>}

          {baskets.map((b) => {
            const all = [...b.need, ...b.pull, ...b.topup];
            const line = (i) => i.packsToOrder * i.packSizeG * stdOf(i);
            return (
              <section className="card" key={b.supplier}>
                <h2>{b.supplier} basket · {gbp(b.subtotal)}<Tip side="left">Items below their reorder line, with the packs to buy. Top-ups are items you'll need soon anyway, added to reach free delivery. Mark the basket ordered to quiet the alerts, then book each item in when it arrives.</Tip></h2>
                {b.isMain && (
                  <>
                    <div className="gpbar" style={{ marginBottom: 6 }}><div className="gpfill" style={{ width: `${Math.min(100, b.subtotal / settings.freeShipThreshold * 100)}%` }} /></div>
                    <p className="hint">{b.subtotal >= settings.freeShipThreshold
                      ? `Over the ${gbp(settings.freeShipThreshold)} free-delivery line.`
                      : `${gbp(b.gapToFree)} short of free delivery at ${gbp(settings.freeShipThreshold)}; below it, delivery costs ${gbp(settings.shippingCost)}.`}</p>
                  </>
                )}
                <div className="tblscroll"><table className="tbl">
                  <thead><tr><th>Ingredient</th><th>Role</th><th>Why</th><th className="num">Order</th><th className="num">Cost</th></tr></thead>
                  <tbody>
                    {b.need.map((i) => (
                      <tr key={i.name}><td><b>{i.name}</b></td><td>{i.key ? <span className={`kkey k${i.key}`}>{["","Core","Shared","Solo"][i.key]}</span> : ""}</td><td className="mut">short {g(i.deficit)}</td><td className="num">{i.packsToOrder} × {g(i.packSizeG)}</td><td className="num">{gbp(line(i))}</td></tr>))}
                    {b.pull.map((i) => (
                      <tr key={i.name}><td><b>{i.name}</b></td><td>{i.key ? <span className={`kkey k${i.key}`}>{["","Core","Shared","Solo"][i.key]}</span> : ""}</td><td className="mut">runs low before the next order</td><td className="num">{i.packsToOrder} × {g(i.packSizeG)}</td><td className="num">{gbp(line(i))}</td></tr>))}
                    {b.topup.map((i) => (
                      <tr key={i.name}><td><b>{i.name}</b></td><td>{i.key ? <span className={`kkey k${i.key}`}>{["","Core","Shared","Solo"][i.key]}</span> : ""}</td><td className="mut">top-up to free delivery · {i.daysCover !== null ? `${Math.floor(i.daysCover)}d cover` : "core item"}</td><td className="num">{i.packsToOrder} × {g(i.packSizeG)}</td><td className="num">{gbp(line(i))}</td></tr>))}
                  </tbody>
                </table></div>
                <div className="actions">
                  <button className="primary" onClick={() => markOrdered(all.map((i) => ({ name: i.name, packsToOrder: i.packsToOrder })))}>Mark basket as ordered</button>
                  <button onClick={() => copyText(all.map((i) => `${i.packsToOrder} x ${i.packSizeG}g ${i.name}`).join("\n"))}>Copy list</button>
                </div>
              </section>
            );
          })}
        </main>
      )}

      {/* ============ SYNC & SETTINGS ============ */}
      {tab === "sync" && (
        <main>
          {renderPoints()}
          {BUILD === "preview" && (
            <section className="card">
              <h2>Sandbox</h2>
              <p className="hint">This preview stores everything under {SANDBOX_KEY}. It can read your live record to copy it in, and a guard stops it writing anything outside the sandbox.</p>
              <div className="actions"><button onClick={copyLiveIntoSandbox}>Copy my live data in again</button></div>
            </section>
          )}
          <section className="card">
            <h2>Sales import<Tip side="left">Shopify, Etsy or Square order exports, as they come. Product names are matched to blends; imported sales count toward selling rates but don't change shelf counts. The Guide has the format.</Tip></h2>
            <div className="salerow">
              <span className="mut">Channel</span>
              <select className="cell" value={csvChannel} onChange={(e) => setCsvChannel(e.target.value)}>
                {["Shopify", "Etsy", "Event", "Wholesale", "Other"].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="actions" style={{ marginTop: 0 }}>
              <label className="filelabel actionsbtn">Upload sales file (CSV / Excel)<input type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={(e) => { handleSalesFile(e.target.files[0]); e.target.value = ""; }} /></label>
              <span className="mut">or paste a CSV below</span>
            </div>
            <textarea className="paste" rows={5} placeholder={"Name,Lineitem name,Lineitem quantity,Created at\n#1001,Ember Imp 80g,2,2026-06-14"} value={csvText} onChange={(e) => setCsvText(e.target.value)} />
            <div className="actions">
              <button className="primary" onClick={importCSVSales} disabled={!csvText.trim()}>Import pasted CSV</button>
              {csvMsg && <span className={csvMsg.ok ? "okmsg" : "errmsg"}>{csvMsg.text}</span>}
              {undo && undo.where === "sales" && <button className="mini" onClick={undoChange}>{undo.label}</button>}
            </div>
          </section>

          <section className="card">
            <h2>Full export and import<Tip side="left">Everything in one JSON document (sos.stockroom.v1): settings, ingredients, recipes, packs, batches, sales, events, shrink and bundles. Importing replaces everything, shows what will change first and takes a restore point.</Tip></h2>
            <div className="actions">
              <button onClick={copyFullExport}>Copy full export</button>
              <button onClick={() => setStateIO(exportState())}>Preview in box below</button>
            </div>
            <textarea className="paste" rows={6} placeholder="Paste a sos.stockroom.v1 export here to restore or migrate state…" value={stateIO} onChange={(e) => { setStateIO(e.target.value); setPendingImport(null); }} />
            {pendingImport ? renderImportReview() : (
              <div className="actions">
                <button className="primary" onClick={reviewImport} disabled={!stateIO.trim()}>Review import</button>
                {ioMsg && <span className={ioMsg.ok ? "okmsg" : "errmsg"}>{ioMsg.text}</span>}
                {undo && undo.where === "state" && <button className="mini" onClick={undoChange}>{undo.label}</button>}
              </div>
            )}
          </section>

          <section className="card">
            <h2>Price refresh (main supplier)<Tip side="left">Copy the request into a Claude chat, paste back the JSON it returns, then apply. A restore point is taken first, and the old rates become the Cost tiers baseline.</Tip></h2>
            <p className="hint">Last synced: {settings.priceLastSynced ? fmtD(settings.priceLastSynced) : "never"}.</p>
            <div className="actions">
              <button onClick={() => copyText("Please fetch current prices from wholesale-spices.example for these ingredients and return the same JSON array with updated costPerG (GBP per gram) and packSizeG:\n\n" + exportForRefresh())}>Copy refresh request</button>
            </div>
            <textarea className="paste" rows={5} placeholder='Paste updated JSON here, e.g. [{"name":"Kosher Salt","costPerG":0.0026,"packSizeG":500}]' value={importText} onChange={(e) => setImportText(e.target.value)} />
            <div className="actions">
              <button className="primary" onClick={importPrices} disabled={!importText.trim()}>Apply prices</button>
              {importMsg && <span className={importMsg.ok ? "okmsg" : "errmsg"}>{importMsg.text}</span>}
              {undo && undo.where === "prices" && <button className="mini" onClick={undoChange}>{undo.label}</button>}
            </div>
          </section>

          <section className="card">
            <h2>Modules<Tip side="left">Turn a module off when another system owns that job. Its tab and prompts go quiet; nothing is deleted, so turning it back on restores everything.</Tip></h2>
            {[
              ["sales", "Sales & velocity", "Off when your POS / e-commerce platform owns sales data. Reordering falls back to batch-cover rules; channel P&L and days-of-cover pause."],
              ["purchasing", "Purchasing & shopping", "Off when a procurement or ordering system owns replenishment. Shopping lists, baskets, on-order tracking and buy-price logging pause; simple restocking stays."],
              ["counts", "Cycle counting", "Off when stock counts arrive from another system (e.g. a warehouse app). Count prompts and cadences disappear."],
              ["lots", "Batch codes & best-before", "Off when a compliance or traceability system owns lot data. New brews stop generating codes and dates."],
              ["bundles", "Bundle builder", "Off if bundle pricing lives in your storefront."],
              ["events", "Event planner", "Off if events are planned elsewhere."],
              ["shrink", "Shrink & gifting", "Off if loss tracking happens in another system."],
            ].map(([key, label, why]) => (
              <div className="setrow" key={key}>
                <label>{label}<Tip side="left">{why}</Tip></label>
                <button className={`mini ${mod[key] ? "" : "ghost"}`} onClick={() => updateSetting({ modules: { ...mod, [key]: !mod[key] } })}>{mod[key] ? "On" : "Off"}</button>
              </div>))}
          </section>

          <section className="card">
            <h2>Settings</h2>
            <div className="setrow"><label>Default batch size (packs)</label>
              <input className="cell" type="number" min="1" max="200" value={settings.defaultBatchPacks} onChange={(e) => updateSetting({ defaultBatchPacks: Math.max(1, parseInt(e.target.value) || 10) })} /></div>
            <div className="setrow"><label>Supplier lead time (days)</label>
              <input className="cell" type="number" min="1" max="21" value={settings.leadTimeDays} onChange={(e) => updateSetting({ leadTimeDays: Math.max(1, parseInt(e.target.value) || 1) })} /></div>
            <div className="setrow"><label>Safety buffer (days of demand)</label>
              <input className="cell" type="number" min="0" max="30" value={settings.safetyDays} onChange={(e) => updateSetting({ safetyDays: Math.max(0, parseInt(e.target.value) || 0) })} /></div>
            <div className="setrow"><label>Fallback cover (batches, pre-sales-data)</label>
              <input className="cell" type="number" min="1" max="6" value={settings.reorderBatches} onChange={(e) => updateSetting({ reorderBatches: Math.max(1, parseInt(e.target.value) || 1) })} /></div>
            <div className="setrow"><label>Shelf life for new batches (months)</label>
              <input className="cell" type="number" min="1" max="36" value={settings.shelfLifeMonths} onChange={(e) => updateSetting({ shelfLifeMonths: Math.max(1, parseInt(e.target.value) || 12) })} /></div>
            <div className="setrow"><label>Single pack sell price (£)</label>
              <input className="cell" type="number" min="0" step="0.5" value={settings.sellPrice} onChange={(e) => updateSetting({ sellPrice: parseFloat(e.target.value) || 0 })} /></div>
            <div className="setrow"><label>Supplier free-delivery threshold (£)</label>
              <input className="cell" type="number" min="0" step="1" value={settings.freeShipThreshold} onChange={(e) => updateSetting({ freeShipThreshold: Math.max(0, parseFloat(e.target.value) || 0) })} /></div>
            <div className="setrow"><label>Shipping cost when under threshold (£)</label>
              <input className="cell" type="number" min="0" step="0.5" value={settings.shippingCost} onChange={(e) => updateSetting({ shippingCost: Math.max(0, parseFloat(e.target.value) || 0) })} /></div>
            <div className="setrow"><label>Margin floor alert (%)</label>
              <input className="cell" type="number" min="0" max="95" value={settings.marginFloorPct} onChange={(e) => updateSetting({ marginFloorPct: Math.max(0, parseInt(e.target.value) || 0) })} /></div>
            <h3>Channel fees (% of price + fixed £ per pack)<Tip side="left">Etsy is calibrated from a real order statement (Jan 2026): 6.5% transaction, 4% + 20p processing, 0.48% regulatory and listing renewal, with 20% VAT on fees and fees on postage.</Tip></h3>
            {["Etsy", "Shopify", "Event", "Wholesale", "Other"].map((c) => {
              const f = (settings.channelFees || {})[c] || { pct: 0, fixed: 0 };
              return (
                <div className="setrow" key={c}><label>{c}</label>
                  <span className="salerow" style={{ margin: 0 }}>
                    <input className="cell" type="number" min="0" step="0.1" value={f.pct} onChange={(e) => updateSetting({ channelFees: { ...settings.channelFees, [c]: { ...f, pct: parseFloat(e.target.value) || 0 } } })} /><span className="mut">%</span>
                    <input className="cell" type="number" min="0" step="0.01" value={f.fixed} onChange={(e) => updateSetting({ channelFees: { ...settings.channelFees, [c]: { ...f, fixed: parseFloat(e.target.value) || 0 } } })} /><span className="mut">£</span>
                  </span>
                </div>);
            })}
            <h3>Packaging per pack ({gbp(packagingTotal)} total)<Tip side="left">On every pack, however it's sold.</Tip></h3>
            {Object.entries(settings.packaging).map(([k, v]) => (
              <div className="setrow" key={k}><label>{k} (£)</label>
                <input className="cell" type="number" min="0" step="0.01" value={v} onChange={(e) => updateSetting({ packaging: { ...settings.packaging, [k]: parseFloat(e.target.value) || 0 } })} /></div>))}
            <h3>Packaging per posted order ({gbp(shippedTotal)} total)<Tip side="left">Counted once per order on the ticked channels, never per pack. Bundle extras, such as a gift-box belly band, are set on the bundle.</Tip></h3>
            {Object.entries(settings.shippedPackaging || {}).map(([k, v]) => (
              <div className="setrow" key={`s-${k}`}><label>{k} (£)</label>
                <input className="cell" type="number" min="0" step="0.01" value={v} onChange={(e) => updateSetting({ shippedPackaging: { ...settings.shippedPackaging, [k]: parseFloat(e.target.value) || 0 } })} /></div>))}
            <div className="setrow"><label>Channels that post orders</label>
              <span className="salerow" style={{ margin: 0 }}>{["Shopify", "Etsy", "Direct", "Wholesale", "Event", "Other"].map((c) => (
                <label key={c} className="mut" style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                  <input type="checkbox" checked={(settings.shippedChannels || []).includes(c)} onChange={(e) => updateSetting({ shippedChannels: e.target.checked ? [...new Set([...(settings.shippedChannels || []), c])] : (settings.shippedChannels || []).filter((x) => x !== c) })} />{c}</label>))}</span></div>
          </section>
        </main>
      )}

      {/* ============ GUIDE ============ */}
      {tab === "guide" && (
        <main className="guide">
          <section className="card">
            <h2>Guide</h2>
            <p className="hint">How each part of the stockroom works. Tap a topic to open it.</p>
            <details><summary>Daily routine</summary><ol>
              <li><b>Count.</b> On Ingredients, type the grams on each shelf into Stock. It saves when you leave the box and marks the shelf counted.</li>
              <li><b>Brew.</b> Open a blend on Recipes, set the batch size and print the weigh-out list before mixing. Brew takes the ingredients off the shelf and puts the packs on.</li>
              <li><b>Sell.</b> Log sales on Sales, or tap −1 or −3 on Finished packs.</li>
              <li><b>Order.</b> Shopping writes the order by supplier. Mark the basket ordered, then book each item in when it arrives.</li>
            </ol></details>
            <details><summary>Recipes and bulk upload</summary><ul>
              <li><b>Edit recipe</b> changes the grams; <b>+ Add blend</b> builds a new one. The editor warns when the lines don't add up to the pack weight.</li>
              <li>For many changes at once, download the Excel template, fill the Ingredients sheet and one or more Blends sheets (each Blends sheet is a product group), then upload it.</li>
              <li>The upload report lists every row as added, updated or failed, with the reason. Matching names update, new names are added and failed rows are skipped.</li>
            </ul></details>
            <details><summary>Ingredients, stock and reorder lines</summary><ul>
              <li><b>+pack</b> books in a normal delivery at the usual price. <b>buy</b> records any other purchase at the price you paid and updates the average cost of the shelf.</li>
              <li>A new ingredient needs a name, supplier, pack size in grams and pack price; the price per gram works itself out.</li>
              <li>Roles: Core is in 8 or more blends, Shared in 4 to 7, Solo in 1 to 3.</li>
              <li>Counting cadence follows yearly value: the top 70% weekly, the next 20% monthly, the rest quarterly.</li>
              <li>Reorder lines cover {settings.reorderBatches} batches of the heaviest blend until {MIN_SALES_FOR_DEMAND} sales are logged. After that they cover daily use over {settings.leadTimeDays} days of lead time plus {settings.safetyDays} days of safety, never below one batch. Your own minimum can raise a line.</li>
            </ul></details>
            <details><summary>Shopping and deliveries</summary><ul>
              <li>Items appear once stock falls below the reorder line, grouped by supplier with the packs to buy.</li>
              <li>The bar shows how close the main basket is to free delivery; top-ups are items you'll need soon anyway.</li>
              <li>Ordered stock counts toward reorder lines but not toward brewing until booked in.</li>
            </ul></details>
            <details><summary>Sales and the sales file format</summary><ul>
              <li>Sales in the last {VELOCITY_DAYS} days set each blend's selling rate, which drives days of cover and reorder lines. Backdate with the date field to catch up.</li>
              <li>Upload a Shopify, Etsy or Square export as it comes, or paste a CSV on Data &amp; settings. It needs a header row and a product column (Lineitem name, Product, Title or Item), ideally with quantity (Quantity, Qty) and date (Created at, Date).</li>
              <li>Product cells must contain the blend name: <code>Ember Imp 80g pouch</code> matches Ember Imp. Unmatched rows are reported, never guessed. Imported sales don't change shelf counts.</li>
              <li>Example: <code>Name,Lineitem name,Lineitem quantity,Created at</code> then <code>#1001,Ember Imp 80g,2,2026-06-14</code>.</li>
            </ul></details>
            <details><summary>Bundles</summary><ul>
              <li>Pick blends into slots, set bundle packaging and any posted-only extras, choose the channel and drag the price. Profit includes the channel's fees.</li>
              <li>Posted channels add one postal box per order plus the posted-only extras. Saved bundles recost themselves when prices change.</li>
            </ul></details>
            <details><summary>Events</summary><ul>
              <li>Create an event and enter the packs to take per blend. The plan rounds up to whole batches beyond what's shelved and lists the ingredients to order, with a copyable order list.</li>
            </ul></details>
            <details><summary>Shrink and gifting</summary><ul>
              <li>Log anything lost, spoiled, damaged or given away. Stock adjusts at once, and the page shows the cost as cash, as a share of stock and as the dent in profit.</li>
            </ul></details>
            <details><summary>Flavour profiles</summary><FlavourMethod /></details>
            <details><summary>Backups, exports and price refresh</summary><ul>
              <li>Restore points are taken on first open each day and before every import, upgrade or restore. The last {KEEP_RESTORE_POINTS} are kept; restore any of them on Data &amp; settings.</li>
              <li>Keep a full export somewhere outside this browser. It survives cleared site data.</li>
              <li>Import only what the export button produced. It replaces everything, so it shows what will change and takes a restore point first.</li>
              <li>Price refresh: copy the request into a Claude chat, paste back the JSON and apply. The format is a list like <code>{'{'}"name":"Cumin","costPerG":0.0155,"packSizeG":500{'}'}</code>, priced in £ per gram.</li>
            </ul></details>
            <details><summary>Modules</summary><ul>
              <li>Turn a module off when another system owns that job, for example your shop platform owning sales. Its tab and prompts go quiet and nothing is deleted. Stock, blends and brewing always stay on.</li>
            </ul></details>
          </section>
        </main>
      )}

      {/* ============ MODALS ============ */}
      {ingest && (
        <div className="overlay" onClick={() => setIngest(null)}>
          <div className="modal wide" onClick={(e) => e.stopPropagation()}>
            <h2>Import report</h2>
            <p>
              {ingest.counts.added ? <span className="okmsg">{ingest.counts.added} added</span> : null}
              {ingest.counts.updated ? <> · <span className="okmsg">{ingest.counts.updated} updated</span></> : null}
              {ingest.counts.failed ? <> · <span className="errmsg">{ingest.counts.failed} failed</span></> : null}
              {ingest.counts.warning ? <> · <span style={{ color: "var(--warnc)" }}>{ingest.counts.warning} warning{ingest.counts.warning === 1 ? "" : "s"}</span></> : null}
              {!ingest.rows.length && "Nothing recognisable found — check the file against the template."}
            </p>
            <div className="reportscroll">
              <table className="tbl">
                <thead><tr><th>Sheet</th><th className="num">Row</th><th>Name</th><th>Result</th><th>Detail</th></tr></thead>
                <tbody>{ingest.rows.map((r, i) => (
                  <tr key={i} className={r.status === "failed" ? "bad" : ""}>
                    <td className="mut">{r.sheet}</td><td className="num">{r.row}</td>
                    <td><b>{r.name}</b><div className="mut small">{r.entity}</div></td>
                    <td>{r.status === "added" ? <span className="okmsg">added</span> : r.status === "updated" ? <span className="okmsg">updated</span> : r.status === "failed" ? <span className="errmsg">failed</span> : <span style={{ color: "var(--warnc)" }}>warning</span>}</td>
                    <td className="small">{r.message}</td>
                  </tr>))}
                </tbody>
              </table>
            </div>
            <p className="hint">Failed rows were skipped, not guessed. Fix them in the spreadsheet and upload again; matching names update rather than duplicate.</p>
            <div className="actions">
              <button className="primary" onClick={() => setIngest(null)}>Done</button>
              <button onClick={downloadIngestReport}>Download report (Excel)</button>
              {undo && undo.where === "bulk" && <button onClick={() => { setIngest(null); undoChange(); }}>{undo.label}</button>}
            </div>
          </div>
        </div>
      )}

      {buyForm && (() => {
        const ing = stockMap[buyForm.name] || {};
        const gAmt = parseFloat(buyForm.grams) || 0;
        const paid = parseFloat(buyForm.price) || 0;
        const rate = gAmt > 0 ? paid / gAmt : 0;
        const std = stdOf(ing);
        const prem = std > 0 && rate > 0 ? (rate / std - 1) * 100 : 0;
        const newStock = (ing.stockG || 0) + gAmt;
        const wac = newStock > 0 ? ((ing.stockG || 0) * (ing.costPerG || 0) + paid) / newStock : 0;
        return (
          <div className="overlay" onClick={() => setBuyForm(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h2>Log a purchase · {buyForm.name}</h2>
              <div className="setrow"><label>Amount bought (g)</label>
                <input className="cell" type="number" min="1" value={buyForm.grams} onChange={(e) => setBuyForm({ ...buyForm, grams: e.target.value })} /></div>
              <div className="setrow"><label>Price paid (£)</label>
                <input className="cell" type="number" min="0" step="0.01" value={buyForm.price} onChange={(e) => setBuyForm({ ...buyForm, price: e.target.value })} /></div>
              <p>{gAmt > 0 && paid > 0 ? <>That's <b>£{(rate * 100).toFixed(2)}/100g</b> vs the normal shelf price £{(std * 100).toFixed(2)}/100g{prem > 2 ? <span className="errmsg">, {prem.toFixed(0)}% over (£{((rate - std) * gAmt).toFixed(2)} premium)</span> : prem < -2 ? <span className="okmsg">, {Math.abs(prem).toFixed(0)}% under</span> : ", on standard"}. Average cost on the shelf becomes £{(wac * 100).toFixed(2)}/100g.</> : "Enter amount and price to see the rate."}</p>
              <div className="actions">
                <button className="primary" disabled={!(gAmt > 0 && paid >= 0)} onClick={() => applyPurchase(buyForm.name, gAmt, paid)}>Book it in</button>
                <button onClick={() => setBuyForm(null)}>Cancel</button>
              </div>
            </div>
          </div>
        );
      })()}

      {confirmBatch && (
        <div className="overlay" onClick={() => setConfirmBatch(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Brew {confirmBatch.packs} packs of {confirmBatch.r.name}?</h2>
            <p>The {confirmBatch.r.lines.length} ingredients below come off the shelf <b>now</b> ({g(confirmBatch.r.lines.reduce((a, l) => a + l.perPackG, 0) * confirmBatch.packs)} total), {confirmBatch.packs} packs added to the shelf, and the batch gets a lot code with a {settings.shelfLifeMonths}-month best-before.</p>
            <div className="actions">
              <button className="primary" onClick={() => logBatch(confirmBatch.r, confirmBatch.packs)}>Brew it</button>
              <button onClick={() => setConfirmBatch(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {pickList && (
        <div className="overlay" onClick={() => setPickList(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Weigh-out list · {pickList.r.name}</h2>
            <pre className="pick">{pickListText(pickList.r, pickList.packs)}</pre>
            <div className="actions">
              <button className="primary" onClick={() => copyText(pickListText(pickList.r, pickList.packs))}>Copy list</button>
              <button onClick={() => setPickList(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function SaveBadge({ bind }) {
  const [st, setSt] = useState("idle");
  useEffect(() => { bind.current = setSt; return () => { if (bind.current === setSt) bind.current = null; }; }, [bind]);
  return <div className={`savebadge ${st}`} role="status">{st === "saving" ? "Saving…" : st === "error" ? "Save failed. Retry any edit." : st === "locked" ? "Not saving" : "Saved"}</div>;
}

// ============ HELP ============
function Help({ title = "How to use this page", children }) {
  return (
    <details className="help">
      <summary>ⓘ {title}</summary>
      <div className="helpbody">{children}</div>
    </details>
  );
}

// ============ THEME ============
function Style() {
  return (
    <style>{`
      .sos-root{
        --ink:#191420; --page:#211a2b; --panel:#2a2138; --panel2:#332845;
        --parch:#e8ddc8; --parch-dim:#a99a86; --ember:#e07b39; --ember-hi:#f0975a;
        --arcane:#7fb069; --warnc:#d9a441; --dangerc:#c75146; --line:#453757;
        min-height:100vh; background:
          radial-gradient(1200px 500px at 50% -10%, #2f2440 0%, var(--ink) 60%);
        color:var(--parch); padding:20px clamp(10px,3vw,36px) 60px;
        font-family:'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif;
      }
      .sos-root *{box-sizing:border-box}
      .loading{padding:80px 0;text-align:center;color:var(--parch-dim);font-style:italic}
      .hdr{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px}
      .brand{display:flex;gap:14px;align-items:center}
      .sigil{width:46px;height:46px;border:1px solid var(--ember);border-radius:50%;display:flex;align-items:center;justify-content:center;
        color:var(--ember-hi);font-size:20px;box-shadow:0 0 18px rgba(224,123,57,.25), inset 0 0 12px rgba(224,123,57,.15)}
      h1{margin:0;font-size:clamp(20px,3.4vw,28px);letter-spacing:.5px;font-weight:600}
      .sub{color:var(--parch-dim);font-size:13px;letter-spacing:.06em;text-transform:uppercase}
      .savebadge{font-size:12px;color:var(--parch-dim);border:1px solid var(--line);padding:4px 10px;border-radius:20px}
      .savebadge.error{color:var(--dangerc);border-color:var(--dangerc)}
      .tabs{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0 18px;border-bottom:1px solid var(--line);padding-bottom:10px}
      .tabs button{background:transparent;border:1px solid transparent;color:var(--parch-dim);padding:7px 12px;border-radius:8px;
        cursor:pointer;font:inherit;font-size:14px}
      .tabs button:hover{color:var(--parch)}
      .tabs button.on{color:var(--ember-hi);border-color:var(--ember);background:rgba(224,123,57,.08)}
      .pill{background:var(--dangerc);color:#fff;border-radius:10px;padding:0 6px;font-size:11px;margin-left:6px}
      .pill.dim{background:var(--warnc);color:#241c10}
      main{display:flex;flex-direction:column;gap:16px;max-width:1060px;margin:0 auto}
      .card{background:linear-gradient(180deg,var(--panel) 0%,var(--page) 100%);border:1px solid var(--line);border-radius:12px;padding:18px 18px 16px}
      .card.warn{border-color:var(--warnc)}
      .card h2{margin:0 0 6px;font-size:18px;color:var(--parch);font-weight:600}
      .card h3{margin:14px 0 6px;font-size:14px;color:var(--parch-dim);text-transform:uppercase;letter-spacing:.08em}
      .hint{color:var(--parch-dim);font-size:13.5px;margin:0 0 12px;line-height:1.5}
      .statrow{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}
      .stat{background:var(--panel2);border:1px solid var(--line);border-radius:12px;padding:14px}
      .stat .n{font-size:26px;color:var(--ember-hi);font-variant-numeric:tabular-nums}
      .stat .n span{font-size:15px;color:var(--parch-dim)}
      .stat .l{font-size:12.5px;color:var(--parch-dim);margin-top:2px}
      .ready-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}
      .ready{text-align:left;background:var(--panel2);border:1px solid var(--line);border-left:4px solid var(--line);
        border-radius:10px;padding:12px;cursor:pointer;color:var(--parch);font:inherit}
      .ready:hover{background:#3b2f52}
      .ready.green{border-left-color:var(--arcane)} .ready.amber{border-left-color:var(--warnc)} .ready.red{border-left-color:var(--dangerc)}
      .rname{font-weight:600} .rmeta{font-size:12.5px;color:var(--parch-dim);margin-top:3px} .rpacks{font-size:12px;color:var(--parch-dim);margin-top:6px;font-style:italic}
      .tbl{width:100%;border-collapse:collapse;font-size:14px}
      .tbl th{color:var(--parch-dim);font-weight:500;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.06em;
        border-bottom:1px solid var(--line);padding:6px 8px}
      .tbl td{padding:8px;border-bottom:1px solid rgba(69,55,87,.5);vertical-align:middle;isolation:isolate}
      .tbl td:has(.tip){isolation:auto}
      .tbl .num{text-align:right;font-variant-numeric:tabular-nums;font-family:ui-monospace,'SF Mono',Consolas,monospace;font-size:13px}
      th.num{font-family:inherit}
      .tbl tr.bad td{background:rgba(199,81,70,.08)}
      .tblscroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
      .tbl tr.grp td{padding-top:14px;color:var(--parch-dim);font-size:12px;text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid var(--line)}
      .tbl tr.costsub td{color:var(--parch-dim)}
      .tbl tr.tot td{border-top:1px solid var(--ember);color:var(--parch);font-weight:600}
      .rowlink{cursor:pointer} .rowlink:hover td{background:rgba(224,123,57,.06)}
      .chev{color:var(--parch-dim)}
      .mut{color:var(--parch-dim)} .small{font-size:11.5px;margin-top:2px}
      .dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px;vertical-align:baseline}
      .dot.green{background:var(--arcane)} .dot.amber{background:var(--warnc)} .dot.red{background:var(--dangerc)}
      .cov{font-size:12px;padding:2px 7px;border-radius:9px;border:1px solid}
      .cov.green{color:var(--arcane);border-color:var(--arcane)} .cov.amber{color:var(--warnc);border-color:var(--warnc)} .cov.red{color:var(--dangerc);border-color:var(--dangerc)}
      .abc{display:inline-block;width:22px;height:22px;border-radius:6px;text-align:center;line-height:22px;font-size:12px;font-weight:700}
      .abc.A{background:var(--ember);color:#1c1410} .abc.B{background:var(--panel2);border:1px solid var(--ember);color:var(--ember-hi)} .abc.C{background:var(--panel2);border:1px solid var(--line);color:var(--parch-dim)}
      .kkey{display:inline-block;min-width:26px;height:22px;border-radius:6px;text-align:center;line-height:22px;font-size:11.5px;font-weight:700;padding:0 3px}
      .kkey.k1{background:var(--dangerc);color:#fff} .kkey.k2{background:var(--warnc);color:#241c10} .kkey.k3{background:var(--panel2);border:1px solid var(--line);color:var(--parch-dim)}
      .tiergrid{display:grid;grid-template-columns:118px repeat(3,minmax(0,1fr));gap:8px;align-items:start}
      .tiergrid .th{font-size:12px;color:var(--parch-dim);text-transform:uppercase;letter-spacing:.06em;padding:0 2px 2px;align-self:end}
      .tiergrid .th .small{text-transform:none;letter-spacing:0;font-size:11.5px}
      .tiergrid .rowh{align-self:center;color:var(--parch)}
      .tcell{background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:6px 10px;min-width:0}
      .tcell.hot{border-color:var(--dangerc)} .tcell.warm{border-color:var(--warnc)}
      .tcell .cap{display:none;font-size:12px;color:var(--parch-dim);text-transform:uppercase;letter-spacing:.06em;margin:4px 0}
      .tchip{display:flex;justify-content:space-between;gap:8px;font-size:13px;padding:5px 0;border-bottom:1px dashed rgba(69,55,87,.7)}
      .tchip:last-child{border-bottom:0}
      .tchip .num{white-space:nowrap;font-variant-numeric:tabular-nums}
      .tchg{font-size:12px;margin-left:6px;font-variant-numeric:tabular-nums;color:var(--parch-dim)}
      .tchg.up{color:#e0705f} .tchg.down{color:var(--arcane)}
      .tier{font-size:12px;padding:1px 7px;border-radius:6px;border:1px solid var(--line);white-space:nowrap}
      .tier.t0{border-color:var(--ember);color:var(--ember-hi)} .tier.t1{color:var(--parch)} .tier.t2{color:var(--parch-dim)}
      @media (max-width:640px){.tiergrid{grid-template-columns:minmax(0,1fr)}.tiergrid .th{display:none}.tcell .cap{display:block}}
      .nowrap{white-space:nowrap}
      .guide details{border-top:1px solid var(--line);padding:2px 0}
      .guide details:last-child{border-bottom:1px solid var(--line)}
      .guide summary{cursor:pointer;padding:11px 2px;color:var(--parch);font-size:15px;list-style:none}
      .guide summary::-webkit-details-marker{display:none}
      .guide summary::before{content:"▸ ";color:var(--parch-dim)}
      .guide details[open] summary::before{content:"▾ "}
      .guide ul,.guide ol{margin:0 0 12px;padding-left:20px;color:var(--parch-dim);font-size:14px;line-height:1.6}
      .guide li{margin-bottom:6px}
      .guide li b{color:var(--parch)}
      .guide code{background:var(--ink);padding:1px 6px;border-radius:4px;font-size:12px}
      .guide .fl-method{color:var(--parch-dim);font-size:14px;line-height:1.6;padding-bottom:10px}
      ${TIP_CSS}
      .fl-backrow{display:flex;justify-content:space-between;align-items:center;gap:10px}
      .cell{width:88px;background:var(--ink);border:1px solid var(--line);color:var(--parch);border-radius:6px;padding:5px 7px;
        font-family:ui-monospace,monospace;font-size:13px;text-align:right}
      .cell.wide{width:180px;text-align:left;font-family:inherit}
      .cell:focus{outline:none;border-color:var(--ember)}
      select.cell{text-align:left;font-family:inherit;width:auto;min-width:96px}
      input[type=date].cell{width:140px;text-align:left}
      .search{flex:1;background:var(--ink);border:1px solid var(--line);color:var(--parch);border-radius:8px;
        padding:8px 12px;font:inherit;font-size:14px}
      .filterrow{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:10px;align-items:center}
      .salerow{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px}
      .twocol{display:grid;grid-template-columns:1fr 1fr;gap:20px}
      @media (max-width:640px){ .twocol{grid-template-columns:1fr} }
      .slotn{width:18px;display:inline-block}
      .pricehead{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:8px}
      .pricebig{font-size:38px;color:var(--ember-hi);font-variant-numeric:tabular-nums}
      .slider{width:100%;accent-color:var(--ember);height:26px;cursor:pointer}
      .sliderlabels{display:flex;justify-content:space-between;color:var(--parch-dim);font-size:11.5px;margin-top:-2px}
      .gpbar{position:relative;height:14px;border-radius:7px;background:var(--ink);border:1px solid var(--line);overflow:hidden;margin-top:10px}
      .gpfill{position:absolute;right:0;top:0;bottom:0;background:linear-gradient(90deg,rgba(127,176,105,.35),var(--arcane))}
      .gpcost{position:absolute;left:0;top:0;bottom:0;background:rgba(199,81,70,.45);border-right:2px solid var(--dangerc)}
      .mini{background:var(--panel2);border:1px solid var(--line);color:var(--parch);border-radius:6px;padding:4px 10px;
        cursor:pointer;font:inherit;font-size:12.5px}
      .mini:hover{border-color:var(--ember)}
      .mini.due{border-color:var(--warnc);color:var(--warnc)}
      .mini.ghost{border-color:transparent;color:var(--parch-dim)}
      .addbtn{background:var(--ember);border:1px solid var(--ember);color:#1c1410;font-weight:600;border-radius:8px;padding:8px 14px;cursor:pointer;font:inherit;font-size:14px;white-space:nowrap}
      .addbtn:hover{background:var(--ember-hi)}
      .filelabel{display:inline-block;cursor:pointer}
      .filelabel.actionsbtn{background:var(--panel2);border:1px solid var(--line);color:var(--parch);border-radius:8px;padding:9px 16px;font-size:14px}
      .filelabel.actionsbtn:hover{border-color:var(--ember)}
      .actions{display:flex;gap:10px;margin-top:14px;align-items:center;flex-wrap:wrap}
      .actions button{background:var(--panel2);border:1px solid var(--line);color:var(--parch);border-radius:8px;
        padding:9px 16px;cursor:pointer;font:inherit;font-size:14px}
      .actions button:hover:not(:disabled){border-color:var(--ember)}
      .actions button.primary{background:var(--ember);border-color:var(--ember);color:#1c1410;font-weight:600}
      .actions button.primary:hover:not(:disabled){background:var(--ember-hi)}
      .actions button:disabled{opacity:.45;cursor:not-allowed}
      .actions .mini{padding:4px 10px}
      .back{background:none;border:none;color:var(--ember-hi);cursor:pointer;font:inherit;font-size:14px;padding:0;margin-bottom:2px;text-align:left}
      .rhead{display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;align-items:flex-start}
      .bigstatus{border:1px solid var(--line);border-radius:10px;padding:10px 14px;font-weight:600;min-width:170px}
      .bigstatus .lim{font-weight:400;font-size:12px;color:var(--parch-dim);margin-top:3px}
      .bigstatus.green{border-color:var(--arcane);color:var(--arcane)}
      .bigstatus.amber{border-color:var(--warnc);color:var(--warnc)}
      .bigstatus.red{border-color:var(--dangerc);color:var(--dangerc)}
      .loglist{margin:0;padding:0;list-style:none} .loglist li{padding:5px 0;border-bottom:1px solid rgba(69,55,87,.4);font-size:14px}
      .loglist span:first-child{color:var(--parch-dim);margin-right:10px;font-size:12.5px}
      .empty{color:var(--arcane);font-style:italic}
      .paste{width:100%;background:var(--ink);border:1px solid var(--line);color:var(--parch);border-radius:8px;padding:10px;
        font-family:ui-monospace,monospace;font-size:12.5px;margin-top:10px}
      .okmsg{color:var(--arcane);font-size:13.5px} .errmsg{color:var(--dangerc);font-size:13.5px}
      .setrow{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:7px 0;border-bottom:1px solid rgba(69,55,87,.4)}
      .setrow label{font-size:14px}
      .overlay{position:fixed;inset:0;background:rgba(15,10,20,.75);display:flex;align-items:center;justify-content:center;padding:16px;z-index:50}
      .modal{background:var(--panel);border:1px solid var(--ember);border-radius:14px;padding:22px;max-width:520px;width:100%;
        box-shadow:0 0 40px rgba(224,123,57,.2)}
      .modal.wide{max-width:760px}
      .reportscroll{max-height:55vh;overflow:auto;border:1px solid var(--line);border-radius:8px}
      .modal h2{margin:0 0 10px;font-size:18px} .modal p{color:var(--parch-dim);font-size:14px;line-height:1.55}
      .pick{background:var(--ink);border:1px solid var(--line);border-radius:8px;padding:12px;font-size:12.5px;
        font-family:ui-monospace,'SF Mono',Consolas,monospace;overflow:auto;max-height:50vh;white-space:pre;color:var(--parch)}
      .help{margin:0 0 12px;border:1px dashed var(--line);border-radius:10px;background:rgba(42,33,56,.5)}
      .help summary{cursor:pointer;padding:9px 14px;color:var(--parch-dim);font-size:13.5px;list-style:none}
      .help summary::-webkit-details-marker{display:none}
      .help[open] summary{color:var(--ember-hi);border-bottom:1px solid var(--line)}
      .helpbody{padding:12px 16px;color:var(--parch-dim);font-size:13.5px;line-height:1.6}
      .helpbody b{color:var(--parch)} .helpbody code{background:var(--ink);padding:1px 6px;border-radius:4px;font-size:12px}
      .helpbody ol,.helpbody ul{margin:6px 0;padding-left:18px}
      .ftr{text-align:center;color:var(--parch-dim);font-size:12px;margin-top:30px;font-style:italic}
      .previewbar{background:var(--warnc);color:var(--ink);font-weight:600;font-size:14px;padding:9px 16px;text-align:center}
      .danger{border-color:var(--dangerc)!important;color:var(--dangerc)!important}
      .review{margin-top:14px;padding:14px;border:1px solid var(--warnc);border-radius:10px;background:rgba(217,164,65,.06)}
      .review p{margin:0 0 10px;font-size:14px;line-height:1.5;color:var(--parch)}
      .loglist.rp li{display:flex;align-items:center;gap:10px}
      .loglist.rp li .mut{flex:1}
      @media (max-width:640px){ .tbl{font-size:12.5px} .tbl td,.tbl th{padding:6px 5px} .cell{width:70px} .rhead{flex-direction:column} }
    `}</style>
  );
}

// ============ TOOLTIPS AND NUMBER CELLS ============
// An ⓘ that opens a short note: on hover with a mouse, on tap on a phone (shown as a sheet at the foot of the screen).
function Tip({ children, side = "center", label = "What this means" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const byHover = useRef(false);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <span className={`tip ${side}`} ref={ref}
      onPointerEnter={(e) => { if (e.pointerType === "mouse") { byHover.current = true; setOpen(true); } }}
      onPointerLeave={(e) => { if (e.pointerType === "mouse") { byHover.current = false; setOpen(false); } }}>
      <button type="button" className="tipbtn" aria-label={label} aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => (byHover.current ? true : !o)); }}>ⓘ</button>
      {open && <span className="tipbox" role="tooltip" onClick={(e) => e.stopPropagation()}>{children}</span>}
    </span>
  );
}

// A number box that saves when you leave it or press Enter, not on every keystroke.
function NumCell({ value, onCommit, className = "cell", ...rest }) {
  const [draft, setDraft] = useState(null);
  const commit = () => {
    if (draft === null) return;
    if (String(draft) !== String(value)) onCommit(draft);
    setDraft(null);
  };
  return (
    <input {...rest} className={className} type="number" value={draft === null ? value : draft}
      onChange={(e) => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); else if (e.key === "Escape") setDraft(null); }} />
  );
}

const TIP_CSS = `
  .tip{position:relative;display:inline-block;vertical-align:middle;margin-left:6px;line-height:1}
  .tipbtn{background:none;border:0;color:var(--parch-dim);cursor:help;font:inherit;font-size:14px;line-height:1;padding:3px;margin:-3px;border-radius:50%;text-transform:none;letter-spacing:0;font-weight:400}
  .tipbtn:hover,.tipbtn:focus-visible,.tipbtn[aria-expanded="true"]{color:var(--ember-hi);outline:none}
  .tipbox{position:absolute;z-index:40;top:calc(100% + 8px);left:50%;transform:translateX(-50%);width:max-content;max-width:min(320px,78vw);
    background:var(--ink);border:1px solid var(--line);border-radius:8px;padding:9px 11px;box-shadow:0 8px 22px rgba(0,0,0,.45);
    font:400 13px/1.5 'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif;color:var(--parch);text-transform:none;letter-spacing:0;white-space:normal;text-align:left}
  .tip.left .tipbox{left:-6px;transform:none}
  .tip.right .tipbox{left:auto;right:-6px;transform:none}
  .tipbox b{color:var(--parch)}
  @media (max-width:640px){
    .tipbox,.tip.left .tipbox,.tip.right .tipbox{position:fixed;left:16px;right:16px;top:auto;bottom:calc(16px + env(safe-area-inset-bottom,0px));transform:none;width:auto;max-width:none;font-size:14px}
  }
`;

// ============ FLAVOUR PROFILES: LIBRARY AND ENGINE ============
// Flavour engine for the Stockroom: turns per-pack grams into a flavour profile.
// Pure functions only, so the page and the tests share exactly the same maths.
// The flavour library: the 20 demo ingredients, with the private build's figures and sources.
const LIBDATA = {
 "version": "2026-10-15-demo",
 "sources": {
  "SOS": {
   "label": "Farrimond, The Science of Spice (DK, 2018): flavour groups, via Gneiss Spice listing and Bookey summary",
   "url": "https://gneissspice.com/products/science-of-spice-cookbook"
  },
  "SOS2": {
   "label": "Science of Spice chapter summary (Bookey)",
   "url": "https://cdn.bookey.app/files/pdf/book/en/science-of-spice.pdf"
  },
  "SOSDATA": {
   "label": "Grimm, data extract from The Science of Spice (figshare, CC BY 4.0)",
   "url": "https://figshare.com/articles/dataset/Data_extract_and_network_from_S_Farrimond_The_Science_of_Spice/11341199"
  },
  "FP": {
   "label": "Foodpairing: how to read an aroma profile (14 aroma types)",
   "url": "https://foodpairing.com/how-to-interpret-an-aroma-profile"
  },
  "FPBAL": {
   "label": "Foodpairing: building a balanced recipe",
   "url": "https://www.foodpairing.com/how-to-create-a-well-balanced-recipe/"
  },
  "FT": {
   "label": "Segnit, The Flavour Thesaurus: flavour families",
   "url": "https://en.wikipedia.org/wiki/The_Flavour_Thesaurus"
  },
  "FB": {
   "label": "Page & Dornenburg, The Flavor Bible: weight and volume",
   "url": "https://www.cookistry.com/2011/09/what-im-reading-flavor-bible.html"
  },
  "USDA": {
   "label": "USDA Commercial Item Description, spices (minimum volatile oil)",
   "url": "https://ams.prod.usda.gov/sites/default/files/media/CID%20Spices%20and%20Spice%20Blends.pdf"
  },
  "SIR": {
   "label": "Siruguri & Bhat 2015, spice grams per portion",
   "url": "https://link.springer.com/article/10.1186/1475-2891-14-7"
  },
  "UD": {
   "label": "University of Delaware, using herbs and spices (strength classes)",
   "url": "https://www.udel.edu/content/dam/udelImages/canr/pdfs/extension/factsheets/Using-Herbs-and-Spices.pdf"
  },
  "KSU": {
   "label": "K-State Research and Extension, seasoning amounts per lb",
   "url": "https://www.ksre.ksu.edu/humannutrition/nutrition-topics/easytasty-documents/K-StateMF2920.pdf"
  },
  "PS": {
   "label": "PepperScale heat ratings",
   "url": "https://pepperscale.com/aleppo-pepper/"
  },
  "CPM": {
   "label": "Chili Pepper Madness heat ratings",
   "url": "https://www.chilipeppermadness.com/chili-pepper-types/sweet-mild-chili-peppers/paprika-chili-peppers/"
  },
  "SCOV": {
   "label": "Scoville scale (capsaicin 1 ppm = 15 SHU)",
   "url": "https://en.wikipedia.org/wiki/Scoville_scale"
  },
  "KATZER": {
   "label": "Gernot Katzer's Spice Pages (compounds)",
   "url": "https://gernot-katzers-spice-pages.com/engl/Pime_dio.html"
  },
  "GREEN": {
   "label": "Green et al. 2010, taste interactions in mixtures",
   "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC2975745"
  },
  "BRES": {
   "label": "Breslin & Beauchamp 1997, salt suppresses bitterness",
   "url": "https://www.nature.com/articles/42388"
  },
  "IFT": {
   "label": "IFT: umami, nucleotide synergy and sodium",
   "url": "https://www.ift.org/food-technology-magazine/unleashing-the-power-of-umami"
  },
  "PSU": {
   "label": "Penn State 2019: what cuts chilli burn",
   "url": "https://www.psu.edu/news/research/story/milk-best-drink-reduce-burn-chili-peppers"
  },
  "AHN": {
   "label": "Ahn et al. 2011, flavour network and shared compounds",
   "url": "https://arxiv.org/abs/1111.6074"
  },
  "LABEL": {
   "label": "Supplier product labels: ingredients, nutrition and stated heat",
   "url": ""
  }
 },
 "ingredients": {
  "Black Pepper": {
   "p": 3.5,
   "m": {
    "pungent": 7,
    "herbal": 1,
    "citrus": 1,
    "warm": 1
   },
   "salt": 0,
   "sugar": 0,
   "shu": 0,
   "bitter": 0.1,
   "sos": "Pungent compounds",
   "sosHow": "stated",
   "cmp": "piperine (4.6 to 9.7%), rotundone, beta-caryophyllene",
   "desc": "pungent, woody, resinous",
   "basis": "USDA minimum volatile oil 1.5%; about 1 g per portion; Delaware rates it strong.",
   "src": [
    "USDA",
    "SIR",
    "UD",
    "SOS"
   ],
   "est": []
  },
  "Brown Sugar": {
   "p": 0.15,
   "m": {
    "smoky": 6,
    "warm": 4
   },
   "salt": 0,
   "sugar": 0.97,
   "shu": 0,
   "bitter": 0,
   "sos": null,
   "sosHow": null,
   "cmp": "sucrose with about 3.5% molasses",
   "desc": "mild caramel",
   "basis": "Half the molasses of dark brown sugar.",
   "src": [],
   "est": []
  },
  "Cayenne": {
   "p": 1.5,
   "m": {
    "earthy": 5,
    "smoky": 3,
    "citrus": 2
   },
   "salt": 0,
   "sugar": 0,
   "shu": 40000,
   "bitter": 0.3,
   "sos": "Pungent compounds",
   "sosHow": "stated",
   "cmp": "capsaicin, dihydrocapsaicin",
   "desc": "clean heat, faint bitterness",
   "basis": "30,000 to 50,000 SHU. Capsaicin has no smell, so the aroma side is quiet.",
   "src": [
    "PS",
    "SCOV"
   ],
   "est": []
  },
  "Celery Salt": {
   "p": 0.6,
   "m": {
    "earthy": 4,
    "herbal": 4,
    "savoury": 2
   },
   "salt": 0.873,
   "sugar": 0,
   "shu": 0,
   "bitter": 0.2,
   "sos": "Unique compounds",
   "sosHow": "stated",
   "cmp": "salt; celery-seed phthalides",
   "desc": "salty, celery, slightly bitter",
   "basis": "Label: sea salt and ground celery seed; salt 87.3 g per 100 g, so about an eighth is celery seed.",
   "src": [
    "LABEL",
    "SOS"
   ],
   "est": []
  },
  "Chilli Flakes": {
   "p": 2.5,
   "m": {
    "smoky": 4,
    "citrus": 3,
    "earthy": 3
   },
   "salt": 0,
   "sugar": 0.07,
   "shu": 17348,
   "bitter": 0,
   "sos": "Pungent compounds",
   "sosHow": "stated",
   "cmp": "capsaicinoids",
   "desc": "hot, fruity, toasty",
   "basis": "Label: 17,348 SHU, 'smoky essence with a fruity hint'.",
   "src": [
    "LABEL"
   ],
   "est": []
  },
  "Cinnamon": {
   "p": 3.5,
   "m": {
    "warm": 9,
    "smoky": 1
   },
   "salt": 0,
   "sugar": 0,
   "shu": 0,
   "bitter": 0.2,
   "sos": "Sweet warming phenols",
   "sosHow": "stated",
   "cmp": "cinnamaldehyde (75 to 90% of cassia oil), coumarin",
   "desc": "sweet, woody, slightly bitter",
   "basis": "USDA minimum volatile oil 1.5%. Assumed cassia, as UK suppliers sell.",
   "src": [
    "USDA",
    "KATZER",
    "SOS"
   ],
   "est": []
  },
  "Coriander": {
   "p": 1.5,
   "m": {
    "citrus": 6,
    "warm": 2,
    "earthy": 2
   },
   "salt": 0,
   "sugar": 0,
   "shu": 0,
   "bitter": 0,
   "sos": "Fragrant terpenes",
   "sosHow": "stated",
   "cmp": "linalool",
   "desc": "citrus, floral, nutty",
   "basis": "USDA minimum volatile oil 0.3%; Foodpairing classes coriander seed as citrus.",
   "src": [
    "USDA",
    "FP",
    "SOS"
   ],
   "est": []
  },
  "Cumin": {
   "p": 3.5,
   "m": {
    "earthy": 7,
    "warm": 2,
    "smoky": 1
   },
   "salt": 0,
   "sugar": 0,
   "shu": 0,
   "bitter": 0.3,
   "sos": "Earthy terpenes",
   "sosHow": "stated",
   "cmp": "cuminaldehyde, gamma-terpinene, p-cymene",
   "desc": "earthy, musty, warm",
   "basis": "USDA minimum volatile oil 2%; The Flavor Bible: moderately loud.",
   "src": [
    "USDA",
    "FB",
    "SOS"
   ],
   "est": []
  },
  "Garlic Granules": {
   "p": 4,
   "m": {
    "allium": 9,
    "savoury": 1
   },
   "salt": 0,
   "sugar": 0.024,
   "shu": 0,
   "bitter": 0,
   "sos": "Sulfurous compounds",
   "sosHow": "stated",
   "cmp": "alliin, giving allicin and diallyl sulfides",
   "desc": "pungent, sulfurous, sweet when cooked",
   "basis": "Label sugars 2.4 g per 100 g. Coarser than powder, so slightly slower.",
   "src": [
    "SOS",
    "LABEL",
    "KSU"
   ],
   "est": []
  },
  "Ginger": {
   "p": 5,
   "m": {
    "pungent": 4,
    "warm": 4,
    "citrus": 2
   },
   "salt": 0,
   "sugar": 0,
   "shu": 0,
   "bitter": 0,
   "sos": "Pungent compounds",
   "sosHow": "stated",
   "cmp": "gingerols, shogaols, zingiberene",
   "desc": "warm, pungent, lemony",
   "basis": "USDA minimum volatile oil 1.5%; Delaware rates it strong.",
   "src": [
    "USDA",
    "UD",
    "SOS"
   ],
   "est": [],
   "pw": "USDA minimum volatile oil 1.5%; Delaware rates it strong"
  },
  "Lemon Peel": {
   "p": 2.5,
   "m": {
    "citrus": 9,
    "herbal": 1
   },
   "salt": 0,
   "sugar": 0,
   "shu": 0,
   "bitter": 0.3,
   "sos": "Citrus terpenes",
   "sosHow": "inferred",
   "cmp": "limonene, citral",
   "desc": "bright lemon, bitter pith",
   "basis": "Citral-type aroma, like the citrus terpenes group.",
   "src": [
    "SOS"
   ],
   "est": []
  },
  "Mustard Powder": {
   "p": 5,
   "m": {
    "pungent": 9,
    "earthy": 1
   },
   "salt": 0,
   "sugar": 0,
   "shu": 0,
   "bitter": 0.5,
   "sos": "Sulfurous compounds",
   "sosHow": "stated",
   "cmp": "allyl and 4-hydroxybenzyl isothiocyanates",
   "desc": "sharp, nasal heat once wet",
   "basis": "Label: plain mustard powder. It needs moisture before it bites.",
   "src": [
    "LABEL",
    "SOS"
   ],
   "est": [],
   "pw": "sharp isothiocyanates once it meets moisture"
  },
  "Onion Powder": {
   "p": 3.5,
   "m": {
    "allium": 8,
    "savoury": 2
   },
   "salt": 0,
   "sugar": 0.07,
   "shu": 0,
   "bitter": 0,
   "sos": "Sulfurous compounds",
   "sosHow": "inferred",
   "cmp": "dipropyl disulfide, propyl trisulfides",
   "desc": "sweet, savoury, sulfurous",
   "basis": "Dried onion concentrates its glutamate as well as its sulfur notes.",
   "src": [
    "SOS"
   ],
   "est": [
    "sugar"
   ]
  },
  "Oregano": {
   "p": 3.5,
   "m": {
    "herbal": 9,
    "pungent": 1
   },
   "salt": 0,
   "sugar": 0,
   "shu": 0,
   "bitter": 0.3,
   "sos": "Unique compounds",
   "sosHow": "inferred",
   "cmp": "carvacrol, thymol",
   "desc": "pungent, peppery herb",
   "basis": "USDA minimum volatile oil 2%. Thymol links it to ajwain in Science of Spice.",
   "src": [
    "USDA",
    "SOS"
   ],
   "est": []
  },
  "Rosemary": {
   "p": 5,
   "m": {
    "herbal": 9,
    "warm": 1
   },
   "salt": 0,
   "sugar": 0,
   "shu": 0,
   "bitter": 0.3,
   "sos": "Penetrating terpenes",
   "sosHow": "inferred",
   "cmp": "1,8-cineole, camphor, alpha-pinene",
   "desc": "pine, camphor",
   "basis": "USDA minimum volatile oil 1%; Delaware rates it strong.",
   "src": [
    "USDA",
    "UD"
   ],
   "est": [],
   "pw": "Delaware rates it strong"
  },
  "Sea Salt": {
   "p": 0,
   "m": {},
   "salt": 1.0,
   "sugar": 0,
   "shu": 0,
   "bitter": 0,
   "sos": null,
   "sosHow": null,
   "cmp": "sodium chloride",
   "desc": "salty, coarse crystals",
   "basis": "Label: salt 100 g per 100 g.",
   "src": [
    "LABEL"
   ],
   "est": []
  },
  "Smoked Paprika": {
   "p": 3.5,
   "m": {
    "smoky": 8,
    "earthy": 1,
    "warm": 1
   },
   "salt": 0,
   "sugar": 0,
   "shu": 500,
   "bitter": 0,
   "sos": "Toasty pyrazines",
   "sosHow": "stated",
   "cmp": "wood-smoke phenols, pyrazines",
   "desc": "smoky, sweet, berry",
   "basis": "Label: oak-smoked, sugars nil. Sweet (dulce) heat assumed, about 500 SHU.",
   "src": [
    "LABEL",
    "SOS"
   ],
   "est": [
    "shu"
   ]
  },
  "Star Anise": {
   "p": 5,
   "m": {
    "warm": 9,
    "herbal": 1
   },
   "salt": 0,
   "sugar": 0,
   "shu": 0,
   "bitter": 0,
   "sos": "Sweet warming phenols",
   "sosHow": "stated",
   "cmp": "trans-anethole, estragole",
   "desc": "liquorice, sweet, warm",
   "basis": "Strong anethole spice.",
   "src": [
    "SOS"
   ],
   "est": [],
   "pw": "anethole-rich, like fennel but stronger"
  },
  "Sweet Paprika": {
   "p": 1.5,
   "m": {
    "smoky": 3,
    "earthy": 3,
    "warm": 2,
    "citrus": 2
   },
   "salt": 0,
   "sugar": 0.1,
   "shu": 500,
   "bitter": 0,
   "sos": "Toasty pyrazines",
   "sosHow": "stated",
   "cmp": "pyrazines; carotenoids (colour)",
   "desc": "mild, fruity, sweet",
   "basis": "250 to 1,000 SHU. Label sugars 10.3 g per 100 g.",
   "src": [
    "CPM",
    "LABEL",
    "SOS"
   ],
   "est": []
  },
  "Thyme": {
   "p": 2.5,
   "m": {
    "herbal": 9,
    "earthy": 1
   },
   "salt": 0,
   "sugar": 0,
   "shu": 0,
   "bitter": 0.3,
   "sos": "Unique compounds",
   "sosHow": "inferred",
   "cmp": "thymol, p-cymene",
   "desc": "earthy, herbal, medicinal",
   "basis": "USDA minimum volatile oil 0.8%; Delaware rates it medium.",
   "src": [
    "USDA",
    "UD"
   ],
   "est": []
  }
 }
};

const LIB_VERSION = LIBDATA.version;
const SOURCES = LIBDATA.sources;
const BASE_LIB = LIBDATA.ingredients;

// Radar axes, in the order they sit round the chart (neighbours are related flavours).
const AXES = [
  { k: "salty", label: "Salty", short: "Salty", lines: ["Salty"], kind: "taste", feeds: "Salt per cent of the blend", fw: "Basic taste. Foodpairing balance: salty against sweet and bitter" },
  { k: "savoury", label: "Savoury", short: "Savoury", lines: ["Savoury"], kind: "taste", feeds: "Stock cubes, onion and garlic glutamate, butter richness", fw: "Umami. Segnit: Meaty. Foodpairing: Animal (meaty)" },
  { k: "allium", label: "Garlic & onion", short: "Allium", lines: ["Garlic &", "onion"], kind: "aroma", feeds: "Garlic, onion, chives, asafoetida, kala namak's eggy sulfur", fw: "Science of Spice: Sulfurous compounds. Segnit: Sulphurous. Foodpairing: Vegetable (sulfurous)" },
  { k: "earthy", label: "Earthy", short: "Earthy", lines: ["Earthy"], kind: "aroma", feeds: "Cumin, nigella, turmeric, fenugreek, celery seed, poppy", fw: "Science of Spice: Earthy terpenes, Unique compounds. Segnit: Earthy" },
  { k: "smoky", label: "Smoky & roasted", short: "Smoky", lines: ["Smoky &", "roasted"], kind: "aroma", feeds: "Smoked paprika, chipotle, coffee, cocoa, paprika's toasty notes, molasses", fw: "Science of Spice: Toasty pyrazines. Foodpairing: Roasted, Woody (smoke). Segnit: Roasted" },
  { k: "warm", label: "Warm spice", short: "Warm", lines: ["Warm", "spice"], kind: "aroma", feeds: "Cinnamon, clove, allspice, nutmeg, mace, star anise, fennel, cardamom", fw: "Science of Spice: Sweet warming phenols, Warming terpenes. Foodpairing and Segnit: Spicy" },
  { k: "sweet", label: "Sweet", short: "Sweet", lines: ["Sweet"], kind: "taste", feeds: "Sugar per cent of the blend", fw: "Basic taste" },
  { k: "citrus", label: "Citrus & tang", short: "Citrus", lines: ["Citrus &", "tang"], kind: "aroma", feeds: "Zests, lime leaf, sumac, coriander, fruity chillies, dried fruit", fw: "Science of Spice: Citrus terpenes, Sweet-sour acids, Fragrant terpenes. Foodpairing: Citrus. Segnit: Citrussy" },
  { k: "herbal", label: "Herbal", short: "Herbal", lines: ["Herbal"], kind: "aroma", feeds: "Thyme, rosemary, sage, oregano, marjoram, dill, juniper, cardamom", fw: "Science of Spice: Penetrating terpenes. Foodpairing: Herbal, Green. Segnit: Green & Grassy" },
  { k: "pungent", label: "Pepper bite", short: "Pepper", lines: ["Pepper", "bite"], kind: "sensation", feeds: "Black pepper, mustard, ginger, Sichuan tingle", fw: "Science of Spice: Pungent compounds (piperine, isothiocyanates, gingerols, sanshools)" },
  { k: "heat", label: "Chilli heat", short: "Heat", lines: ["Chilli", "heat"], kind: "sensation", feeds: "Scoville heat of the dry blend", fw: "Science of Spice: Pungent compounds (capsaicin). Scoville scale" },
];
const AXIS = Object.fromEntries(AXES.map((a) => [a.k, a]));
const AROMA_KEYS = ["savoury", "allium", "earthy", "smoky", "warm", "citrus", "herbal", "pungent"];

const POTENCY = [
  { v: 1, label: "Quiet" }, { v: 1.5, label: "Quiet to moderate" }, { v: 2.5, label: "Moderate" },
  { v: 3.5, label: "Moderate to loud" }, { v: 5, label: "Loud" }, { v: 8, label: "Very loud" },
];
const potencyLabel = (p) => {
  if (!(p > 0)) return "No aroma";
  let best = POTENCY[0];
  POTENCY.forEach((x) => { if (Math.abs(x.v - p) < Math.abs(best.v - p)) best = x; });
  return best.label;
};

const SOS_GROUPS = [
  "Sweet warming phenols", "Warming terpenes", "Fragrant terpenes", "Earthy terpenes", "Penetrating terpenes", "Citrus terpenes",
  "Sweet-sour acids", "Fruity aldehydes", "Toasty pyrazines", "Sulfurous compounds", "Pungent compounds", "Unique compounds",
];
// Spices that share compounds with several groups, so they tie a blend together (Science of Spice; Foodpairing).
const LINKERS = {
  "Coriander": "linalool, limonene and cymene, shared with allspice, chilli and cumin",
  "Coriander Seeds": "linalool, limonene and cymene, shared with allspice, chilli and cumin",
  "Cinnamon": "pairs across the warming, earthy and sour groups",
  "Ginger": "pairs across the pungent, citrus and warming groups",
};

// Saturating scale: perception flattens as a note gets stronger.
const SCALE = { aroma: 50, salt: 20, sugar: 20, bitter: 25, heatFloor: 40, heatTop: 100000 };
const sat = (x, k) => 10 * (1 - Math.exp(-Math.max(0, x) / k));
const heatScore = (shu) => Math.min(10, 10 * Math.log10(1 + Math.max(0, shu) / SCALE.heatFloor) / Math.log10(1 + SCALE.heatTop / SCALE.heatFloor));
const heatLabel = (shu) => (shu < 300 ? "None" : shu < 1000 ? "Mild" : shu < 3000 ? "Medium" : shu < 10000 ? "Hot" : "Very hot");

const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const isPackaging = (name) => String(name || "").includes("(units)");

// A library entry with any saved override laid over it.
function libEntry(name, overrides) {
  const base = BASE_LIB[name] || null;
  const o = overrides && overrides[name];
  if (!o) return base;
  return { ...(base || { m: {}, src: [], est: [] }), ...o, m: { ...(o.m || (base && base.m) || {}) }, overridden: true };
}

// The profile of one set of lines. Packaging lines are ignored; grams are normalised to the blend's own weight.
function profileOf(lines, overrides) {
  const food = (lines || []).filter((l) => l && !isPackaging(l.ingredient) && num(l.perPackG) > 0);
  const G = food.reduce((a, l) => a + num(l.perPackG), 0);
  const raw = Object.fromEntries(AROMA_KEYS.map((k) => [k, 0]));
  const parts = Object.fromEntries([...AXES.map((a) => a.k), "bitter"].map((k) => [k, []]));
  let salt = 0, sugar = 0, shu = 0, bitter = 0;
  const unknown = []; const groups = {}; const linkers = [];
  food.forEach((l) => {
    const pct = G > 0 ? (num(l.perPackG) / G) * 100 : 0;
    const e = libEntry(l.ingredient, overrides);
    if (!e) { unknown.push(l.ingredient); return; }
    const s = pct * num(e.salt); if (s > 0) { salt += s; parts.salty.push([l.ingredient, s]); }
    const su = pct * num(e.sugar); if (su > 0) { sugar += su; parts.sweet.push([l.ingredient, su]); }
    const h = (pct / 100) * num(e.shu); if (h > 0) { shu += h; parts.heat.push([l.ingredient, h]); }
    const b = pct * num(e.bitter); if (b > 0) { bitter += b; parts.bitter.push([l.ingredient, b]); }
    AROMA_KEYS.forEach((k) => {
      const c = (pct * num(e.p) * num((e.m || {})[k])) / 10;
      if (c > 0) { raw[k] += c; parts[k].push([l.ingredient, c]); }
    });
    if (e.sos) groups[e.sos] = (groups[e.sos] || 0) + pct * Math.max(0.5, num(e.p));
    if (LINKERS[l.ingredient]) linkers.push(l.ingredient);
  });
  const scores = { salty: sat(salt, SCALE.salt), sweet: sat(sugar, SCALE.sugar), heat: heatScore(shu) };
  AROMA_KEYS.forEach((k) => { scores[k] = sat(raw[k], SCALE.aroma); });
  const drivers = {};
  Object.entries(parts).forEach(([k, arr]) => {
    const tot = arr.reduce((a, x) => a + x[1], 0);
    drivers[k] = [...arr].sort((a, b) => b[1] - a[1]).map(([name, v]) => ({ name, share: tot > 0 ? v / tot : 0 }));
  });
  const gTot = Object.values(groups).reduce((a, b) => a + b, 0);
  const groupShares = Object.entries(groups).map(([name, v]) => ({ name, share: gTot > 0 ? v / gTot : 0 })).sort((a, b) => b.share - a.share);
  const leads = AROMA_KEYS.map((k) => [k, scores[k]]).concat([["heat", scores.heat]]).sort((a, b) => b[1] - a[1]).filter(([, v]) => v >= 3).slice(0, 3).map(([k]) => k);
  const pcts = Object.fromEntries(food.map((l) => [l.ingredient, G > 0 ? (num(l.perPackG) / G) * 100 : 0]));
  return {
    totalG: G, saltPct: salt, sugarPct: sugar, shu, heat: heatLabel(shu), bitter: sat(bitter, SCALE.bitter),
    scores, raw, drivers, groups: groupShares, unknown, leads, linkers, pcts,
    load: AROMA_KEYS.reduce((a, k) => a + raw[k], 0),
  };
}

// Two blends with the same proportions (a gift jar of a pouch blend, say).
function sameRatios(a, b) {
  const norm = (lines) => {
    const food = lines.filter((l) => !isPackaging(l.ingredient) && num(l.perPackG) > 0);
    const G = food.reduce((s, l) => s + num(l.perPackG), 0) || 1;
    return Object.fromEntries(food.map((l) => [l.ingredient, num(l.perPackG) / G]));
  };
  const x = norm(a); const y = norm(b);
  const keys = new Set([...Object.keys(x), ...Object.keys(y)]);
  if (!keys.size) return false;
  for (const k of keys) if (Math.abs((x[k] || 0) - (y[k] || 0)) > 0.006) return false;
  return true;
}

const pct1 = (x) => `${Math.round(x * 10) / 10}%`;
const verb = (name) => (/[^s]s$/i.test(String(name).trim().split(/\s+/).pop()) ? "give" : "gives");
const PHRASE = { savoury: "savouriness", allium: "garlic and onion character", earthy: "earthiness", smoky: "smoky, roasted character", warm: "warm spice", citrus: "citrus and tang", herbal: "herbal character", pungent: "pepper bite" };
const share = (x) => `${Math.round(x * 100)}%`;
const fmtShu = (x) => Math.round(x).toLocaleString("en-GB");

// Short, computed observations about a blend. Each names the reason behind it.
function insightsOf(p, overrides) {
  const out = [];
  if (p.unknown.length) out.push({ kind: "gap", text: `No flavour data for ${p.unknown.join(", ")}, so ${p.unknown.length === 1 ? "it isn't" : "they aren't"} counted. Add ${p.unknown.length === 1 ? "it" : "them"} in the flavour library below.` });
  AROMA_KEYS.forEach((k) => {
    if (p.scores[k] < 4) return;
    const d = p.drivers[k][0];
    if (!d || d.share < 0.4) return;
    const w = p.pcts[d.name] || 0;
    const e = libEntry(d.name, overrides) || {};
    if (w > 12 || !(e.p >= 5)) return;
    out.push({ kind: "potent", text: `${d.name} ${verb(d.name)} ${share(d.share)} of the ${PHRASE[k]} from ${pct1(w)} of the weight. ${potencyLabel(e.p)} per gram${e.pw ? ` (${e.pw})` : ""}.` });
  });
  if (p.saltPct >= 15 && p.sugarPct >= 15) out.push({ kind: "balance", text: `Sugar at ${pct1(p.sugarPct)} will mute some of the ${pct1(p.saltPct)} salt: in mixtures, sugar suppresses saltiness more than any other taste (Green et al. 2010).` });
  if (p.bitter >= 5) {
    const top = p.drivers.bitter.slice(0, 2).map((x) => x.name);
    out.push({ kind: "balance", text: `${top.join(" and ")} ${top.length > 1 || verb(top[0]) === "give" ? "bring" : "brings"} noticeable bitterness. Salt suppresses bitterness more than sugar does (Breslin and Beauchamp 1997).` });
  }
  if (p.shu >= 1000 && p.drivers.heat[0]) {
    const d = p.drivers.heat[0];
    out.push({ kind: "heat", text: `About ${fmtShu(p.shu)} SHU in the dry blend (${p.heat.toLowerCase()}). ${d.name} ${verb(d.name)} ${share(d.share)} of it from ${pct1(p.pcts[d.name] || 0)} of the weight; heat scales in a straight line with chilli share.` });
  }
  if (p.groups.length >= 6 && !p.linkers.length) out.push({ kind: "balance", text: `Spans ${p.groups.length} Science of Spice groups with no linking spice. Coriander, cinnamon or ginger share compounds across groups and help a wide blend hang together.` });
  return out.slice(0, 5);
}

// ---------- asking Claude ----------
const r1 = (x) => Math.round(x * 10) / 10;
const r2 = (x) => Math.round(x * 100) / 100;
function scoreSummary(p) {
  return Object.fromEntries(AXES.map((a) => [a.k, r1(p.scores[a.k])]));
}
function entryLine(name, e, costPerG) {
  if (!e) return `${name} | no flavour data`;
  const mix = Object.entries(e.m || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${AXIS[k] ? AXIS[k].short.toLowerCase() : k} ${v}`).join(" ");
  const bits = [`strength ${e.p || 0}`, mix || "no aroma"];
  if (e.salt) bits.push(`salt ${r1(e.salt * 100)}%`);
  if (e.sugar) bits.push(`sugar ${r1(e.sugar * 100)}%`);
  if (e.shu) bits.push(`${fmtShu(e.shu)} SHU`);
  if (e.bitter) bits.push(`bitter ${e.bitter}`);
  if (e.sos) bits.push(`group: ${e.sos}`);
  bits.push(costPerG > 0 ? `£${(costPerG * 1000).toFixed(2)}/kg` : "no cost");
  return `${name} | ${bits.join(" | ")}${e.desc ? ` | ${e.desc}` : ""}`;
}

const RULES = [
  "Scores run 0 to 10 per axis. Aroma axes use grams x strength x character share, saturating as they rise. Salty and Sweet come from salt and sugar per cent. Chilli heat comes from blend SHU, which is linear in chilli share (half the chilli, half the SHU).",
  "Science of Spice: spices in the same flavour group blend seamlessly; coriander, cinnamon and ginger share compounds across groups and link a wide blend. Cumin and coriander share cymene and pinene; allspice and coriander share linalool; chilli and coriander share limonene.",
  "Strength per gram matters more than grams. Very loud spices (cloves, mace, nutmeg, star anise, asafoetida, fenugreek, cardamom) move a blend with 0.1 to 0.5 g per pack; quiet ones (coriander, sweet paprika, poppy, parsley, pink peppercorn) need several grams.",
  "Sugar suppresses saltiness strongly, and sweet suppresses sour more than sour suppresses sweet (Green et al. 2010). Cutting sugar makes the same salt taste saltier.",
  "Salt suppresses bitterness (Breslin and Beauchamp 1997); it is the targeted fix for coffee or cocoa bitterness. Potassium salts do not do this.",
  "Glutamate plus nucleotides (stock cubes, yeast extract) gives up to 8x the savouriness; MSG carries about a third of the sodium of salt, so savoury ingredients can replace some salt without losing depth (IFT). Acid dulls umami.",
  "Capsaicin has no aroma. To cut heat but keep chilli character, swap part of a superhot (habanero, scotch bonnet) for a fruity or smoky mild chilli (ancho, chipotle, Aleppo, paprika). Sugar helps tame the burn (Penn State 2019).",
  "Whole seeds release flavour slowly and mustard only bites once cracked and wet; ground versions are stronger per gram.",
  "Foodpairing: aroma carries most of the experience; a balanced blend has at least one contrasting taste (salty against sweet, sour against sweet, bitter against salty).",
];

function buildChangePrompt({ recipe, lines, profile, request, catalog, overrides, costPerPack, sellPrice, packagingCost, withTool }) {
  const G = profile.totalG || 0;
  const recipeLines = lines.filter((l) => !isPackaging(l.ingredient)).map((l) => `${l.ingredient}: ${r2(num(l.perPackG))} g (${G ? r1((num(l.perPackG) / G) * 100) : 0}%)`).join("\n");
  const drivers = AXES.map((a) => {
    const d = (profile.drivers[a.k] || []).slice(0, 3).map((x) => `${x.name} ${share(x.share)}`).join(", ");
    return `${a.label}: ${r1(profile.scores[a.k])}${d ? ` (from ${d})` : ""}`;
  }).join("\n");
  const cat = catalog.map((c) => entryLine(c.name, libEntry(c.name, overrides), c.costPerG)).join("\n");
  return `You are a spice-blend developer helping Sages of Spice, a UK maker of BBQ rubs and seasonings, adjust one of its blends. The owner has asked for a change in their own words. Propose the smallest set of ratio or ingredient changes that delivers it, keep the blend recognisably itself, and stay practical for a small producer weighing by hand.

THE BLEND: ${recipe.name} (${recipe.packSizeG} g pack; the lines below total ${r2(G)} g)
${recipeLines}

ITS FLAVOUR PROFILE NOW (0 to 10)
${drivers}
Salt ${r1(profile.saltPct)}% of the blend. Sugar ${r1(profile.sugarPct)}%. Heat about ${fmtShu(profile.shu)} SHU (${profile.heat}). Bitterness ${r1(profile.bitter)} of 10.
Science of Spice groups present: ${profile.groups.map((g) => `${g.name} ${share(g.share)}`).join(", ") || "none"}.
Ingredient cost ${costPerPack > 0 ? `£${costPerPack.toFixed(2)} per pack` : "unknown"}; packaging £${(packagingCost || 0).toFixed(2)}; sells at £${(sellPrice || 0).toFixed(2)}.

THE OWNER'S REQUEST
${request}

INGREDIENTS IN STOCK (name | strength per gram 1 quiet to 8 very loud | character points out of 10 | salt, sugar, heat | Science of Spice group | cost | descriptors)
${cat}

RULES OF THUMB, FROM THE SOURCES THE PROFILE USES
${RULES.map((r, i) => `${i + 1}. ${r}`).join("\n")}

CONSTRAINTS
- Keep the blend lines totalling ${r2(G)} g (within 0.5 g) unless the owner asks for a different pack weight.
- Prefer ingredients already in stock, written exactly as named above. If something new is truly needed, include it and list it in newIngredients.
- Leave unchanged lines exactly as they are. Give changed amounts to one decimal place (two below 1 g). Change as few lines as will do the job.
${withTool ? "- Check your draft with the score_blend tool before you answer, and adjust once if the scores miss the request.\n" : ""}- If the request is unclear or would break the blend, still propose your best reading and put your question in "question".

Reply with only a JSON object in this shape:
{"summary":"one or two plain sentences on what changes and why","lines":[{"ingredient":"Exact name","perPackG":0}],"changes":[{"ingredient":"Exact name","fromG":0,"toG":0,"why":"short reason"}],"newIngredients":[{"name":"","why":""}],"watch":["one short caution"],"confidence":"high | medium | low","question":""}
"lines" must be the complete new recipe, every ingredient that stays included. Use fromG 0 for an added ingredient and toG 0 for a removed one.`;
}

// Normalises Claude's proposal and checks it against the stock list.
function readProposal(raw, stockNames, current) {
  const problems = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, problems: ["The reply wasn't a proposal."] };
  const known = new Map(stockNames.map((n) => [n.toLowerCase(), n]));
  const fix = (name) => known.get(String(name || "").trim().toLowerCase()) || String(name || "").trim();
  const seen = new Map();
  (Array.isArray(raw.lines) ? raw.lines : []).forEach((l) => {
    const name = fix(l && l.ingredient);
    const g = Math.max(0, num(l && l.perPackG));
    if (!name || !(g > 0)) return;
    seen.set(name, (seen.get(name) || 0) + g);
  });
  const cur = new Map((current || []).filter((l) => !isPackaging(l.ingredient)).map((l) => [l.ingredient, num(l.perPackG)]));
  // Amounts within 0.05 g of today's are rounding, not a change: keep today's exact figure.
  const lines = [...seen.entries()].map(([ingredient, g]) => {
    const was = cur.get(ingredient);
    return { ingredient, perPackG: was !== undefined && Math.abs(was - g) <= 0.05 ? was : r2(g) };
  });
  if (!lines.length) return { ok: false, problems: ["The proposal had no recipe lines."] };
  const newOnes = lines.filter((l) => !known.has(l.ingredient.toLowerCase())).map((l) => l.ingredient);
  if (newOnes.length) problems.push(`Not in your stock list yet: ${newOnes.join(", ")}.`);
  const diff = [];
  new Set([...cur.keys(), ...lines.map((l) => l.ingredient)]).forEach((name) => {
    const a = cur.get(name) || 0; const b = (lines.find((l) => l.ingredient === name) || {}).perPackG || 0;
    if (Math.abs(a - b) >= 0.01) diff.push({ ingredient: name, fromG: a, toG: b });
  });
  const whyOf = {};
  (Array.isArray(raw.changes) ? raw.changes : []).forEach((c) => { const n = fix(c && c.ingredient); if (n && c.why) whyOf[n] = String(c.why).slice(0, 240); });
  return {
    ok: true,
    summary: String(raw.summary || "").slice(0, 600),
    lines,
    diff: diff.map((d) => ({ ...d, why: whyOf[d.ingredient] || "" })).sort((a, b) => Math.abs(b.toG - b.fromG) - Math.abs(a.toG - a.fromG)),
    newIngredients: newOnes,
    watch: (Array.isArray(raw.watch) ? raw.watch : []).map((w) => String(w).slice(0, 240)).filter(Boolean).slice(0, 4),
    confidence: ["high", "medium", "low"].includes(String(raw.confidence).toLowerCase()) ? String(raw.confidence).toLowerCase() : "medium",
    question: String(raw.question || "").slice(0, 300),
    problems,
  };
}

// Asking Claude to profile an ingredient the library doesn't know.
function buildProfilePrompt({ name, supplier, note }) {
  return `You are building a flavour library for a UK spice-blend maker. Profile one ingredient so it can be scored on a flavour radar.

INGREDIENT: ${name}${supplier ? ` (supplier: ${supplier})` : ""}${note ? `\nOWNER'S NOTE: ${note}` : ""}

How the library works:
- "p" is strength per gram: 1 quiet, 1.5 quiet to moderate, 2.5 moderate, 3.5 moderate to loud, 5 loud, 8 very loud. Anchor it on typical usage: spices used under 1 g per portion (cloves, nutmeg, mace) are 5 to 8; ones used by the spoonful (paprika, coriander) are 1 to 2.5. Pure salt and sugar are 0.
- "m" splits the aroma and sensation character into 10 points across: savoury, allium (garlic and onion), earthy, smoky (smoky and roasted), warm (warm spice), citrus (citrus and tang), herbal, pungent (pepper, mustard, ginger, Sichuan tingle; not chilli). Points must sum to 10, or be empty for pure salt or sugar.
- "salt" and "sugar" are grams per gram (0 to 1) from the label where you know it. "shu" is Scoville heat units (0 if no chilli). "bitter" is 0 to 3.
- "sos" is the Science of Spice (Farrimond, 2018) flavour group, one of: ${SOS_GROUPS.join(", ")}; or "" if none fits.

Reply with only a JSON object:
{"p":2.5,"m":{"earthy":6,"warm":4},"salt":0,"sugar":0,"shu":0,"bitter":0,"sos":"","cmp":"key aroma compounds","desc":"three to six descriptor words","basis":"one sentence on where the numbers come from","confidence":"high | medium | low"}`;
}

function readLibEntry(raw) {
  if (!raw || typeof raw !== "object") return null;
  const m = {};
  AROMA_KEYS.forEach((k) => { const v = Math.max(0, num(raw.m && raw.m[k])); if (v > 0) m[k] = v; });
  const tot = Object.values(m).reduce((a, b) => a + b, 0);
  if (tot > 0) Object.keys(m).forEach((k) => { m[k] = r1((m[k] / tot) * 10); });
  const clamp01 = (v) => Math.min(1, Math.max(0, num(v)));
  return {
    p: Math.min(8, Math.max(0, num(raw.p))), m,
    salt: clamp01(raw.salt), sugar: clamp01(raw.sugar), shu: Math.max(0, Math.round(num(raw.shu))), bitter: Math.min(3, Math.max(0, num(raw.bitter))),
    sos: SOS_GROUPS.includes(raw.sos) ? raw.sos : null, sosHow: SOS_GROUPS.includes(raw.sos) ? "inferred" : null,
    cmp: String(raw.cmp || "").slice(0, 160), desc: String(raw.desc || "").slice(0, 120), basis: String(raw.basis || "").slice(0, 300),
    src: [], est: ["p", "m", "salt", "sugar", "shu"],
  };
}

// ============ FLAVOUR PROFILES: TAB ============
// ---------- small formatters ----------
const grams = (n) => `${(n < 1 ? Math.round(n * 100) / 100 : Math.round(n * 10) / 10).toLocaleString("en-GB")} g`;
const pct = (x) => `${(Math.round(x * 10) / 10).toLocaleString("en-GB")}%`;
const shuFmt = (x) => Math.round(x).toLocaleString("en-GB");
const one = (x) => (Math.round(x * 10) / 10).toFixed(1);
const when = (iso) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const MAX_HISTORY = 30;
const EXAMPLES = ["Less salty, same punch", "More smoke, less sugar", "Half the heat but keep the fruitiness", "Cheaper per pack without losing the garlic", "Make it more like a Texas brisket rub"];

// Claude from the page: absent outside a Claude viewer, so every AI control is optional.
async function getSample() {
  if (globalThis.__SOS_SAMPLE__ !== undefined) return globalThis.__SOS_SAMPLE__; // tests
  const c = typeof window !== "undefined" ? window.claude : null;
  if (!c || typeof c.use !== "function") return null;
  try { return await c.use("sample"); } catch (e) { return null; }
}
const GONE = ["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed"];
const ERR_TEXT = {
  rate_limited: "Claude is busy or you've reached a usage limit. Try again in a little while.",
  session_expired: "Your Claude sign-in has expired. Sign in again, then retry.",
  refused: "Claude declined that request. Try wording it differently.",
  empty_completion: "No answer came back. Try a shorter, simpler request.",
  invalid_json: "Claude's answer couldn't be read as a recipe. Try again.",
  prompt_too_large: "That request was too long to send. Shorten it and try again.",
  tools_unavailable: "Checking drafts isn't available in this view, so the next try skips it.",
};
const errText = (e) => ERR_TEXT[e && e.code] || "Couldn't reach Claude just now. Try again.";

// ---------- radar ----------
function Radar({ series, size = "sm", drivers, label }) {
  const big = size === "lg";
  const W = big ? 420 : 240, H = big ? 392 : 214;
  const cx = W / 2, cy = big ? 198 : 110, R = big ? 120 : 68, off = big ? 16 : 10;
  const N = AXES.length;
  const ang = (i) => ((-90 + (360 / N) * i) * Math.PI) / 180;
  const at = (i, v) => [cx + Math.cos(ang(i)) * R * (v / 10), cy + Math.sin(ang(i)) * R * (v / 10)];
  const [hover, setHover] = useState(null);
  const svgRef = useRef(null);
  const poly = (vals) => AXES.map((a, i) => at(i, Math.max(0, Math.min(10, vals[a.k] || 0))).map((n) => n.toFixed(1)).join(",")).join(" ");
  const pick = (ev) => {
    const el = svgRef.current; if (!el) return;
    const box = el.getBoundingClientRect(); if (!box.width) return;
    const x = ((ev.clientX - box.left) * W) / box.width - cx;
    const y = ((ev.clientY - box.top) * H) / box.height - cy;
    if (Math.hypot(x, y) < 6) { setHover(null); return; }
    let deg = (Math.atan2(y, x) * 180) / Math.PI + 90;
    deg = ((deg % 360) + 360) % 360;
    setHover(Math.round(deg / (360 / N)) % N);
  };
  const keys = (ev) => {
    if (ev.key === "ArrowRight" || ev.key === "ArrowDown") { ev.preventDefault(); setHover((h) => (h === null ? 0 : (h + 1) % N)); }
    else if (ev.key === "ArrowLeft" || ev.key === "ArrowUp") { ev.preventDefault(); setHover((h) => (h === null ? N - 1 : (h - 1 + N) % N)); }
    else if (ev.key === "Escape") setHover(null);
  };
  const tip = hover === null ? null : (() => {
    const a = AXES[hover];
    const top = Math.max(...series.map((s) => s.scores[a.k] || 0));
    const [tx, ty] = at(hover, Math.max(top, 2.5));
    const from = drivers && drivers[a.k] ? drivers[a.k].filter((d) => d.share >= 0.05).slice(0, 3) : [];
    return { a, left: Math.min(88, Math.max(12, (tx / W) * 100)), top: (ty / H) * 100, from };
  })();
  return (
    <div className={`fl-radar ${big ? "lg" : "sm"}`}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} tabIndex={big ? 0 : undefined}
        onPointerMove={pick} onPointerLeave={() => setHover(null)} onKeyDown={big ? keys : undefined} onBlur={() => setHover(null)}>
        {[2.5, 5, 7.5, 10].map((v) => (
          <polygon key={v} className="fl-ring" points={AXES.map((a, i) => at(i, v).map((n) => n.toFixed(1)).join(",")).join(" ")} />
        ))}
        {AXES.map((a, i) => { const [x, y] = at(i, 10); return <line key={a.k} className={`fl-spoke ${hover === i ? "on" : ""}`} x1={cx} y1={cy} x2={x.toFixed(1)} y2={y.toFixed(1)} />; })}
        {big && [5, 10].map((v) => <text key={v} className="fl-tick" x={cx + 4} y={(cy - (R * v) / 10 + 11).toFixed(1)}>{v}</text>)}
        {series.map((s, si) => (
          <g key={s.name} className={`fl-series s${si + 1}`}>
            <polygon className="fl-area" points={poly(s.scores)} />
            <polygon className="fl-line" points={poly(s.scores)} />
            {AXES.map((a, i) => { const [x, y] = at(i, Math.max(0, Math.min(10, s.scores[a.k] || 0))); return <circle key={a.k} className={`fl-dot ${hover === i ? "on" : ""}`} cx={x.toFixed(1)} cy={y.toFixed(1)} r={big ? 4.5 : 3.5} />; })}
          </g>
        ))}
        {AXES.map((a, i) => {
          const c = Math.cos(ang(i)), sn = Math.sin(ang(i));
          const x = cx + c * (R + off), y = cy + sn * (R + off);
          const anchor = c > 0.3 ? "start" : c < -0.3 ? "end" : "middle";
          const rows = big ? a.lines : [a.short];
          const lh = big ? 14 : 11;
          const y0 = sn > 0.3 ? y + (big ? 6 : 5) : sn < -0.3 ? y - (rows.length - 1) * lh - 2 : y - ((rows.length - 1) * lh) / 2 + 4;
          return (
            <text key={a.k} className={`fl-axis ${hover === i ? "on" : ""}`} x={x.toFixed(1)} y={y0.toFixed(1)} textAnchor={anchor}>
              {rows.map((t, j) => <tspan key={j} x={x.toFixed(1)} dy={j === 0 ? 0 : lh}>{t}</tspan>)}
            </text>
          );
        })}
      </svg>
      {tip && (
        <div className="fl-tip" style={{ left: `${tip.left}%`, top: `${tip.top}%` }} role="status">
          {series.map((s, si) => (
            <div key={s.name} className="fl-tiprow">
              {series.length > 1 && <span className={`fl-key s${si + 1}`} />}
              <b>{one(s.scores[tip.a.k] || 0)}</b><span>{series.length > 1 ? s.name : tip.a.label}</span>
            </div>
          ))}
          {series.length > 1 && <div className="fl-tipaxis">{tip.a.label}</div>}
          {tip.from.length > 0 && <div className="fl-tipfrom">{tip.from.map((d) => `${d.name} ${Math.round(d.share * 100)}%`).join(" · ")}</div>}
        </div>
      )}
    </div>
  );
}

function Legend({ series }) {
  if (series.length < 2) return null;
  return (
    <div className="fl-legend">
      {series.map((s, i) => <span key={s.name}><span className={`fl-key s${i + 1}`} />{s.name}</span>)}
    </div>
  );
}

// How the profiles are worked out, shown in the Guide.
function FlavourMethod() {
  return (
    <div className="fl-method">
      <p>Every ingredient in the library has a strength per gram (quiet to very loud), a split of its character across the aroma axes, and its salt, sugar and Scoville heat. A blend's score on an axis adds up grams × strength × character for every line, as a share of the blend's weight, then flattens as it rises: a note that is already strong gains less from each extra gram.</p>
      <ul>
        <li><b>Salty</b> and <b>Sweet</b> come from salt and sugar per cent, using your suppliers' labels where they publish them.</li>
        <li><b>Chilli heat</b> comes from the blend's Scoville rating, a weighted average of its chillies (1 ppm capsaicin = 15 SHU).</li>
        <li>Strength per gram is anchored on USDA minimum volatile oil, measured grams per portion, Delaware's strength classes and The Flavor Bible's volume ratings.</li>
        <li>Values marked <b>est.</b> in the flavour library are estimates. Edit any of them and your figure replaces the library's everywhere.</li>
        <li>Ask Claude sends the blend, its profile, every stocked ingredient with cost and flavour data, and the rules of thumb below. Claude in the page can't browse the web.</li>
      </ul>
      <div className="tblscroll"><table className="tbl">
        <thead><tr><th>Axis</th><th>What feeds it</th><th>Recognised flavour families</th></tr></thead>
        <tbody>{AXES.map((a) => <tr key={a.k}><td className="nowrap"><b>{a.label}</b></td><td>{a.feeds}</td><td className="mut">{a.fw}</td></tr>)}</tbody>
      </table></div>
      <p style={{ marginTop: 10 }}>Sources:</p>
      <ul className="fl-sources">{Object.entries(SOURCES).map(([k, src]) => <li key={k}>{src.url ? <a href={src.url} target="_blank" rel="noreferrer">{src.label}</a> : src.label}</li>)}</ul>
    </div>
  );
}

function FHelp({ title, children }) {
  return (
    <details className="help">
      <summary>ⓘ {title}</summary>
      <div className="helpbody">{children}</div>
    </details>
  );
}

const Lead = ({ k }) => <span className="fl-chip">{AXIS[k].label}</span>;
const heatClass = (shu) => (shu < 300 ? "h0" : shu < 1000 ? "h1" : shu < 3000 ? "h2" : shu < 10000 ? "h3" : "h4");

// ---------- the tab ----------
const FlavourTab = memo(FlavourTabView);
function FlavourTabView({ recipes, ings, stockMap, settings, packagingTotal, updateSetting, onOpenDraft, focus }) {
  const live = useRef(null);
  live.current = { settings, updateSetting };
  const overrides = useMemo(() => settings.flavourOverrides || {}, [settings.flavourOverrides]);
  const history = Array.isArray(settings.flavourHistory) ? settings.flavourHistory : [];
  const [open, setOpen] = useState(null);
  const [sortBy, setSortBy] = useState("range");
  const [view, setView] = useState("charts");
  const [compare, setCompare] = useState("");
  const [sample, setSample] = useState(undefined); // undefined while checking; null when Claude isn't available
  const [toolsOK, setToolsOK] = useState(false);
  const [aiGone, setAiGone] = useState(false);
  const [request, setRequest] = useState("");
  const [run, setRun] = useState({ status: "idle" });
  const [result, setResult] = useState(null);
  const ctlRef = useRef(null);
  const topRef = useRef(null);
  const [libFilter, setLibFilter] = useState("");
  const [libOpen, setLibOpen] = useState(false);
  const [libEdit, setLibEdit] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const s = await getSample();
      if (!alive) return;
      setSample(() => s || null); // sample is itself a function, so it must not be passed to setState directly
      if (s && typeof s.limits === "function") {
        try { const lim = await s.limits(); if (alive) setToolsOK(!!(lim && lim.tools)); } catch (e) { /* plain calls still work */ }
      }
    })();
    return () => { alive = false; };
  }, []);
  const canAsk = !!sample && !aiGone;

  const costPerG = useCallback((name) => ((stockMap[name] || {}).costPerG) || 0, [stockMap]);
  const costOf = useCallback((lines) => lines.reduce((a, l) => a + (parseFloat(l.perPackG) || 0) * costPerG(l.ingredient), 0), [costPerG]);
  const stockNames = useMemo(() => ings.map((i) => i.name), [ings]);

  const blends = useMemo(() => recipes.map((r, idx) => {
    const food = r.lines.filter((l) => !isPackaging(l.ingredient) && (parseFloat(l.perPackG) || 0) > 0);
    const twin = recipes.find((o, j) => j < idx && sameRatios(o.lines, r.lines));
    return { r, food, p: profileOf(r.lines, overrides), twin: twin ? twin.name : null };
  }).filter((b) => b.food.length > 0), [recipes, overrides]);
  const distinct = blends.filter((b) => !b.twin);

  const goTo = (name) => {
    if (ctlRef.current) ctlRef.current.abort();
    setOpen(name); setCompare(""); setResult(null); setRun({ status: "idle" }); setRequest("");
    if (topRef.current && topRef.current.scrollIntoView) topRef.current.scrollIntoView({ block: "start" });
  };
  const focusAt = focus ? focus.at : 0;
  useEffect(() => { if (focus && focus.name) goTo(focus.name); }, [focusAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- library (with your overrides) ----------
  const libRows = useMemo(() => {
    const names = new Set([...Object.keys(BASE_LIB), ...ings.filter((i) => !isPackaging(i.name)).map((i) => i.name), ...Object.keys(overrides)]);
    const usedIn = {};
    recipes.forEach((r) => r.lines.forEach((l) => { usedIn[l.ingredient] = (usedIn[l.ingredient] || 0) + 1; }));
    return [...names].sort((a, b) => a.localeCompare(b)).map((name) => ({ name, e: libEntry(name, overrides), inStock: !!stockMap[name], blends: usedIn[name] || 0 }));
  }, [ings, overrides, recipes, stockMap]);
  const gaps = libRows.filter((x) => !x.e && x.inStock);

  const saveOverride = (name, entry) => {
    const L = live.current;
    const next = { ...(L.settings.flavourOverrides || {}) };
    if (entry) next[name] = { ...entry, at: new Date().toISOString() }; else delete next[name];
    L.updateSetting({ flavourOverrides: next });
  };
  const startEdit = (name) => {
    const e = libEntry(name, overrides) || { p: 2.5, m: {}, salt: 0, sugar: 0, shu: 0, bitter: 0, sos: null, basis: "" };
    setLibEdit({ name, status: "idle", msg: null, form: {
      p: String(e.p ?? 0), salt: String(Math.round((e.salt || 0) * 1000) / 10), sugar: String(Math.round((e.sugar || 0) * 1000) / 10),
      shu: String(e.shu || 0), bitter: String(e.bitter || 0), sos: e.sos || "", basis: e.basis || "", desc: e.desc || "", cmp: e.cmp || "",
      ...Object.fromEntries(AROMA_KEYS.map((k) => [`m_${k}`, String((e.m || {})[k] || 0)])),
    } });
  };
  const formPoints = (f) => AROMA_KEYS.reduce((a, k) => a + Math.max(0, parseFloat(f[`m_${k}`]) || 0), 0);
  const saveEdit = () => {
    const f = libEdit.form;
    const m = {}; const tot = formPoints(f);
    AROMA_KEYS.forEach((k) => { const v = Math.max(0, parseFloat(f[`m_${k}`]) || 0); if (v > 0 && tot > 0) m[k] = Math.round((v / tot) * 100) / 10; });
    const base = BASE_LIB[libEdit.name] || {};
    saveOverride(libEdit.name, {
      p: Math.min(8, Math.max(0, parseFloat(f.p) || 0)), m,
      salt: Math.min(1, Math.max(0, (parseFloat(f.salt) || 0) / 100)), sugar: Math.min(1, Math.max(0, (parseFloat(f.sugar) || 0) / 100)),
      shu: Math.max(0, Math.round(parseFloat(f.shu) || 0)), bitter: Math.min(3, Math.max(0, parseFloat(f.bitter) || 0)),
      sos: SOS_GROUPS.includes(f.sos) ? f.sos : null, sosHow: SOS_GROUPS.includes(f.sos) ? (f.sos === base.sos ? base.sosHow : "yours") : null,
      basis: f.basis.slice(0, 300), desc: f.desc.slice(0, 120), cmp: f.cmp.slice(0, 160), src: base.src || [], est: [], by: libEdit.by || "you",
    });
    setLibEdit(null);
  };
  const askProfile = async () => {
    if (!canAsk || !libEdit) return;
    const name = libEdit.name;
    setLibEdit((x) => ({ ...x, status: "thinking", msg: null }));
    try {
      const ing = stockMap[name] || {};
      const raw = await sample.json(buildProfilePrompt({ name, supplier: ing.supplier, note: libEdit.form.basis }), { modelTier: "default", cache: false });
      const e = readLibEntry(raw);
      if (!e) throw { code: "invalid_json" };
      setLibEdit((x) => (x && x.name === name ? { ...x, status: "idle", by: "claude", msg: { ok: true, text: `Claude's estimate${raw && raw.confidence ? ` (${raw.confidence} confidence)` : ""}. Check it, then save.` }, form: {
        ...x.form, p: String(e.p), salt: String(Math.round(e.salt * 1000) / 10), sugar: String(Math.round(e.sugar * 1000) / 10), shu: String(e.shu), bitter: String(e.bitter),
        sos: e.sos || "", basis: e.basis || x.form.basis, desc: e.desc || x.form.desc, cmp: e.cmp || x.form.cmp,
        ...Object.fromEntries(AROMA_KEYS.map((k) => [`m_${k}`, String(e.m[k] || 0)])),
      } } : x));
    } catch (err) {
      if (err && GONE.includes(err.code)) setAiGone(true);
      setLibEdit((x) => (x && x.name === name ? { ...x, status: "idle", msg: { ok: false, text: err && GONE.includes(err.code) ? "Claude isn't available for this page, so fill it in by hand." : errText(err) } } : x));
    }
  };

  // ---------- asking Claude to change a blend ----------
  const cur = open ? blends.find((b) => b.r.name === open) : null;
  useEffect(() => { if (open && !cur) setOpen(null); }, [open, cur]);
  const unitCostOf = (r, lines) => costOf(lines) + (r.pkgOverride !== undefined ? r.pkgOverride : packagingTotal);
  const sellOf = (r) => (r.priceOverride !== undefined ? r.priceOverride : settings.sellPrice);

  const stop = () => { if (ctlRef.current) ctlRef.current.abort(); };
  const ask = async () => {
    if (!cur || !canAsk || !request.trim() || run.status === "thinking") return;
    const r = cur.r; const text = request.trim().slice(0, 600);
    const ctl = new AbortController(); ctlRef.current = ctl;
    setResult(null);
    setRun({ status: "thinking", phase: "Thinking…", checks: 0, request: text });
    const catalog = ings.filter((i) => !isPackaging(i.name)).map((i) => ({ name: i.name, costPerG: i.costPerG || 0 }));
    const foodLines = r.lines.filter((l) => !isPackaging(l.ingredient));
    const prompt = buildChangePrompt({
      recipe: r, lines: foodLines, profile: cur.p, request: text, catalog, overrides,
      costPerPack: costOf(foodLines), sellPrice: sellOf(r), packagingCost: r.pkgOverride !== undefined ? r.pkgOverride : packagingTotal, withTool: toolsOK,
    });
    const opts = { signal: ctl.signal, modelTier: "default", onText: () => setRun((x) => (x.status === "thinking" ? { ...x, phase: "Writing the suggestion…" } : x)) };
    if (toolsOK) {
      opts.tools = [{
        name: "score_blend",
        description: "Scores a draft recipe with the same flavour model the owner sees. Pass every line of the draft (ingredient names exactly as in stock, grams per pack). Returns 0-10 scores per axis, salt and sugar per cent, Scoville heat, total grams and ingredient cost per pack.",
        inputSchema: { type: "object", properties: { lines: { type: "array", items: { type: "object", properties: { ingredient: { type: "string" }, perPackG: { type: "number" } }, required: ["ingredient", "perPackG"] } } }, required: ["lines"] },
        execute: (input) => {
          const lines = (Array.isArray(input && input.lines) ? input.lines : []).map((l) => ({ ingredient: String((l && l.ingredient) || "").trim(), perPackG: Number(l && l.perPackG) || 0 })).filter((l) => l.ingredient && l.perPackG > 0);
          if (!lines.length) throw new Error("Send at least one line with grams above zero.");
          const p = profileOf(lines, overrides);
          setRun((x) => (x.status === "thinking" ? { ...x, checks: (x.checks || 0) + 1, phase: `Checking a draft (${(x.checks || 0) + 1})…` } : x));
          return { totalG: Math.round(p.totalG * 100) / 100, saltPct: Math.round(p.saltPct * 10) / 10, sugarPct: Math.round(p.sugarPct * 10) / 10, shu: Math.round(p.shu), heat: p.heat, scores: scoreSummary(p), ingredientCostPerPack: Math.round(costOf(lines) * 100) / 100, unknownIngredients: p.unknown };
        },
      }];
    } else opts.cache = false;
    try {
      const raw = await sample.json(prompt, opts);
      const prop = readProposal(raw, stockNames, r.lines);
      if (!prop.ok) { setRun({ status: "error", text: prop.problems[0] || "Claude's answer couldn't be used.", request: text }); return; }
      const entry = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, at: new Date().toISOString(), blend: r.name, request: text,
        summary: prop.summary, lines: prop.lines, diff: prop.diff, watch: prop.watch, confidence: prop.confidence, question: prop.question, newIngredients: prop.newIngredients, problems: prop.problems };
      setResult(entry);
      setRun({ status: "done" });
      const L = live.current;
      const prev = Array.isArray(L.settings.flavourHistory) ? L.settings.flavourHistory : [];
      L.updateSetting({ flavourHistory: [entry, ...prev].slice(0, MAX_HISTORY) });
    } catch (err) {
      if (err && err.code === "cancelled") { setRun({ status: "idle" }); return; }
      if (err && GONE.includes(err.code)) { setAiGone(true); setRun({ status: "idle" }); return; }
      if (err && err.code === "tools_unavailable") setToolsOK(false);
      setRun({ status: "error", text: errText(err), request: text });
    } finally {
      if (ctlRef.current === ctl) ctlRef.current = null;
    }
  };

  // ---------- views ----------
  const sorters = {
    range: () => 0,
    name: (a, b) => a.r.name.localeCompare(b.r.name),
    salt: (a, b) => b.p.saltPct - a.p.saltPct,
    sugar: (a, b) => b.p.sugarPct - a.p.sugarPct,
    heat: (a, b) => b.p.shu - a.p.shu,
    groups: (a, b) => b.p.groups.length - a.p.groups.length,
  };
  const ranked = [...blends].sort(sorters[sortBy] || sorters.range);
  const maxBy = (f) => distinct.reduce((best, b) => (!best || f(b) > f(best) ? b : best), null);
  const hottest = maxBy((b) => b.p.shu), saltiest = maxBy((b) => b.p.saltPct), sweetest = maxBy((b) => b.p.sugarPct), richest = maxBy((b) => b.p.groups.length);
  const edited = Object.keys(overrides).length;

  return (
    <main className="fl" ref={topRef}>
      <FlavourStyle />
      {!cur && (
        <>
          <section className="card">
            <h2>Flavour profiles<Tip side="left">Worked out from each blend's grams per pack and a library of {Object.keys(BASE_LIB).length} ingredients built from The Science of Spice, Foodpairing's aroma research, USDA spice specs and your suppliers' labels. The Guide explains the method and lists the sources.</Tip></h2>
            <p className="hint">Scores run 0 to 10. Open a blend to see what drives each score{canAsk ? " and ask Claude for changes" : ""}.</p>
            <div className="statrow">
              {hottest && <div className="stat"><div className="n fl-n">{hottest.r.name}</div><div className="l">hottest, about {shuFmt(hottest.p.shu)} SHU ({hottest.p.heat.toLowerCase()})</div></div>}
              {saltiest && <div className="stat"><div className="n fl-n">{saltiest.r.name}</div><div className="l">saltiest, {pct(saltiest.p.saltPct)} salt</div></div>}
              {sweetest && <div className="stat"><div className="n fl-n">{sweetest.r.name}</div><div className="l">sweetest, {pct(sweetest.p.sugarPct)} sugar</div></div>}
              {richest && <div className="stat"><div className="n fl-n">{richest.r.name}</div><div className="l">widest, across {richest.p.groups.length} Science of Spice groups</div></div>}
            </div>
            {gaps.length > 0 && <p className="errmsg" style={{ marginTop: 10, marginBottom: 0 }}>No flavour data yet for {gaps.map((x) => x.name).join(", ")}. Blends using {gaps.length === 1 ? "it" : "them"} leave {gaps.length === 1 ? "it" : "them"} out until you add {gaps.length === 1 ? "it" : "them"} in the flavour library below.</p>}
          </section>

          <section className="card">
            <h2>Range at a glance<Tip side="left">Heat is the estimated Scoville rating of the dry blend, not of the cooked food.</Tip></h2>
            <div className="salerow">
              <span className="mut">Sort by</span>
              {[["range", "Your order"], ["name", "Name"], ["salt", "Salt"], ["sugar", "Sugar"], ["heat", "Heat"], ["groups", "Groups"]].map(([k, l]) => (
                <button key={k} className={`mini ${sortBy === k ? "due" : ""}`} onClick={() => setSortBy(k)}>{l}</button>))}
            </div>
            <div className="tblscroll"><table className="tbl">
              <thead><tr><th>Blend</th><th>Leads with</th><th className="num">Salt</th><th className="num">Sugar</th><th className="num">Heat</th><th className="num">Groups</th><th></th></tr></thead>
              <tbody>{ranked.map((b) => (
                <tr key={b.r.name} className="rowlink" onClick={() => goTo(b.r.name)}>
                  <td><b>{b.r.name}</b><div className="mut small">{b.r.packSizeG}g{b.twin ? ` · same ratios as ${b.twin}` : b.r.group ? ` · ${b.r.group}` : ""}{b.p.unknown.length ? ` · ${b.p.unknown.length} not profiled` : ""}</div></td>
                  <td><div className="fl-chips">{b.p.leads.length ? b.p.leads.map((k) => <Lead key={k} k={k} />) : <span className="mut small">nothing stands out</span>}</div></td>
                  <td className="num">{pct(b.p.saltPct)}</td>
                  <td className="num">{pct(b.p.sugarPct)}</td>
                  <td className="num nowrap"><span className={`fl-heat ${heatClass(b.p.shu)}`}>{b.p.heat}</span><div className="mut small">{shuFmt(b.p.shu)} SHU</div></td>
                  <td className="num">{b.p.groups.length}</td>
                  <td className="chev">›</td>
                </tr>))}
              </tbody>
            </table></div>
          </section>

          <section className="card">
            <div className="filterrow fl-head">
              <h2 style={{ margin: 0, flex: 1 }}>Flavour radars<Tip side="left">Every radar uses the same 0 to 10 scale, so shapes compare directly. Hover for values; tap a chart to open the blend.</Tip></h2>
              <div className="fl-seg" role="group" aria-label="Show radars as">
                <button className={view === "charts" ? "on" : ""} onClick={() => setView("charts")}>Charts</button>
                <button className={view === "table" ? "on" : ""} onClick={() => setView("table")}>Table</button>
              </div>
            </div>
            {view === "charts" ? (
              <div className="fl-grid">
                {ranked.map((b) => (
                  <button key={b.r.name} className="fl-card" onClick={() => goTo(b.r.name)} aria-label={`${b.r.name}: open its flavour profile`}>
                    <div className="fl-cardname">{b.r.name}</div>
                    <Radar series={[{ name: b.r.name, scores: b.p.scores }]} label={`${b.r.name} flavour radar. ${AXES.map((a) => `${a.label} ${one(b.p.scores[a.k])}`).join(", ")}.`} />
                    <div className="fl-cardfoot">{b.twin ? `Same ratios as ${b.twin}` : b.p.leads.length ? b.p.leads.map((k) => AXIS[k].label).join(" · ") : "Nothing stands out"}</div>
                  </button>))}
              </div>
            ) : (
              <div className="tblscroll"><table className="tbl fl-matrix">
                <thead><tr><th>Blend</th>{AXES.map((a) => <th key={a.k} className="num">{a.short}</th>)}</tr></thead>
                <tbody>{ranked.map((b) => (
                  <tr key={b.r.name} className="rowlink" onClick={() => goTo(b.r.name)}>
                    <td><b>{b.r.name}</b></td>
                    {AXES.map((a) => <td key={a.k} className="num">{one(b.p.scores[a.k])}</td>)}
                  </tr>))}
                </tbody>
              </table></div>
            )}
          </section>


          <section className="card">
            <details className="fl-lib" onToggle={(ev) => setLibOpen(ev.currentTarget.open)}>
              <summary><h2 style={{ display: "inline", margin: 0 }}>Flavour library</h2> <span className="mut small">{libRows.filter((x) => x.e).length} ingredients{edited ? ` · ${edited} edited by you` : ""} · library {LIB_VERSION}</span></summary>
              {libOpen && <>
              <p className="hint" style={{ marginTop: 10 }}>Edit an ingredient to match your supplier's pack{canAsk ? ", or ask Claude to estimate one" : ""}. Your figures replace the library's in every blend.</p>
              <div className="salerow"><input className="search" placeholder="Filter ingredients…" value={libFilter} onChange={(ev) => setLibFilter(ev.target.value)} /></div>
              {libEdit && renderEditor()}
              <div className="tblscroll"><table className="tbl fl-libtbl">
                <thead><tr><th>Ingredient</th><th>Science of Spice group</th><th>Strength</th><th>Character</th><th className="num">Salt</th><th className="num">Sugar</th><th className="num">SHU</th><th></th></tr></thead>
                <tbody>{libRows.filter((x) => !libFilter.trim() || x.name.toLowerCase().includes(libFilter.trim().toLowerCase())).map((x) => {
                  const e = x.e; const est = (k) => (e && Array.isArray(e.est) && e.est.includes(k) ? <span className="fl-est"> est.</span> : null);
                  return (
                    <tr key={x.name}>
                      <td><b>{x.name}</b>{e && e.overridden && <span className="fl-chip mine">{e.by === "claude" ? "Claude's estimate" : "yours"}</span>}<div className="mut small">{e ? e.desc : "No flavour data yet"}{x.blends ? ` · in ${x.blends} blend${x.blends === 1 ? "" : "s"}` : x.inStock ? " · not in a blend" : " · not in stock"}</div></td>
                      <td className="small">{e && e.sos ? <>{e.sos}{e.sosHow === "inferred" && <span className="fl-est"> inferred</span>}</> : <span className="mut">none</span>}</td>
                      <td className="nowrap">{e ? potencyLabel(e.p) : "-"}</td>
                      <td className="small">{e ? Object.entries(e.m || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${AXIS[k] ? AXIS[k].short : k} ${v}`).join(", ") || "none" : "-"}</td>
                      <td className="num">{e && e.salt ? pct(e.salt * 100) : "-"}{e && est("salt")}</td>
                      <td className="num">{e && e.sugar ? pct(e.sugar * 100) : "-"}{e && est("sugar")}</td>
                      <td className="num">{e && e.shu ? shuFmt(e.shu) : "-"}{e && est("shu")}</td>
                      <td><button className="mini" onClick={() => startEdit(x.name)}>{e ? "Edit" : "Add"}</button></td>
                    </tr>);
                })}</tbody>
              </table></div>
              </>}
            </details>
          </section>
        </>
      )}

      {cur && renderDetail()}
    </main>
  );

  function renderEditor() {
    const f = libEdit.form; const set = (k, v) => setLibEdit((x) => ({ ...x, form: { ...x.form, [k]: v } }));
    const pts = formPoints(f); const base = BASE_LIB[libEdit.name]; const mine = overrides[libEdit.name];
    return (
      <div className="fl-editor">
        <h3>{libEdit.name}</h3>
        <div className="fl-form">
          <label>Strength per gram
            <select className="cell" value={f.p} onChange={(ev) => set("p", ev.target.value)}>
              <option value="0">No aroma (salt or sugar)</option>
              {POTENCY.map((x) => <option key={x.v} value={String(x.v)}>{x.label}</option>)}
              {!["0", ...POTENCY.map((x) => String(x.v))].includes(String(f.p)) && <option value={f.p}>{f.p}</option>}
            </select>
          </label>
          <label>Salt %<input className="cell" type="number" min="0" max="100" step="0.1" value={f.salt} onChange={(ev) => set("salt", ev.target.value)} /></label>
          <label>Sugar %<input className="cell" type="number" min="0" max="100" step="0.1" value={f.sugar} onChange={(ev) => set("sugar", ev.target.value)} /></label>
          <label>Heat (SHU)<input className="cell" type="number" min="0" step="100" value={f.shu} onChange={(ev) => set("shu", ev.target.value)} /></label>
          <label>Bitterness 0 to 3<input className="cell" type="number" min="0" max="3" step="0.1" value={f.bitter} onChange={(ev) => set("bitter", ev.target.value)} /></label>
          <label>Science of Spice group
            <select className="cell" value={f.sos} onChange={(ev) => set("sos", ev.target.value)}>
              <option value="">None</option>{SOS_GROUPS.map((gname) => <option key={gname} value={gname}>{gname}</option>)}
            </select>
          </label>
        </div>
        <div className="fl-mix">
          <div className="mut small">Character: share 10 points across the axes ({pts.toFixed(1).replace(/\.0$/, "")} given{pts > 0 && Math.abs(pts - 10) > 0.05 ? ", scaled to 10 on save" : ""})</div>
          <div className="fl-form">
            {AROMA_KEYS.map((k) => <label key={k}>{AXIS[k].label}<input className="cell" type="number" min="0" max="10" step="0.5" value={f[`m_${k}`]} onChange={(ev) => set(`m_${k}`, ev.target.value)} /></label>)}
          </div>
        </div>
        <label className="fl-wide">Descriptors<input className="cell wide" value={f.desc} onChange={(ev) => set("desc", ev.target.value)} placeholder="e.g. smoky, sweet, berry" /></label>
        <label className="fl-wide">Where the figures come from<input className="cell wide" value={f.basis} onChange={(ev) => set("basis", ev.target.value)} placeholder="e.g. pack label, 15 g salt per 100 g" /></label>
        {libEdit.msg && <p className={libEdit.msg.ok ? "okmsg" : "errmsg"}>{libEdit.msg.text}</p>}
        <div className="actions">
          <button className="primary" onClick={saveEdit} disabled={libEdit.status === "thinking"}>Save</button>
          {canAsk && <button onClick={askProfile} disabled={libEdit.status === "thinking"}>{libEdit.status === "thinking" ? "Asking Claude…" : "Ask Claude to estimate"}</button>}
          {mine && base && <button onClick={() => { saveOverride(libEdit.name, null); setLibEdit(null); }}>Back to the library's figures</button>}
          {mine && !base && <button onClick={() => { saveOverride(libEdit.name, null); setLibEdit(null); }}>Remove</button>}
          <button onClick={() => setLibEdit(null)}>Cancel</button>
        </div>
      </div>
    );
  }

  function renderDetail() {
    const r = cur.r; const p = cur.p;
    const foodNow = cur.food;
    const cmp = !result && compare ? blends.find((b) => b.r.name === compare) : null;
    const after = result ? profileOf(result.lines, overrides) : null;
    const series = [{ name: result ? "Now" : r.name, scores: p.scores }];
    if (after) series.push({ name: "Claude's suggestion", scores: after.scores });
    else if (cmp) series.push({ name: cmp.r.name, scores: cmp.p.scores });
    const notes = insightsOf(p, overrides);
    const pastHere = history.filter((h) => h.blend === r.name);
    const sell = sellOf(r);
    const costNow = unitCostOf(r, foodNow);
    const costAfter = result ? unitCostOf(r, result.lines) : null;
    const margin = (c) => (sell > 0 ? Math.round(((sell - c) / sell) * 100) : 0);
    const afterG = after ? after.totalG : 0;
    const packing = r.lines.filter((l) => isPackaging(l.ingredient));
    return (
      <>
        <section className="card">
          <button className="back" onClick={() => setOpen(null)}>‹ All flavour profiles</button>
          <div className="rhead">
            <div>
              <h2 style={{ marginBottom: 2 }}>{r.name}</h2>
              <div className="mut small">{r.sku} · {r.packSizeG}g pack · {foodNow.length} ingredients{cur.twin ? ` · same ratios as ${cur.twin}` : ""}</div>
              <div className="fl-chips" style={{ marginTop: 8 }}>{p.leads.map((k) => <Lead key={k} k={k} />)}</div>
            </div>
            <div className="fl-facts">
              <div><b>{pct(p.saltPct)}</b><span>salt</span></div>
              <div><b>{pct(p.sugarPct)}</b><span>sugar</span></div>
              <div><b className={`fl-heat ${heatClass(p.shu)}`}>{p.heat}</b><span>{shuFmt(p.shu)} SHU</span></div>
              <div><b>{p.groups.length}</b><span>spice groups</span></div>
            </div>
          </div>
          <div className="fl-detail">
            <div className="fl-chartcol">
              <Radar size="lg" series={series} drivers={p.drivers} label={`${r.name} flavour radar${series.length > 1 ? ` compared with ${series[1].name}` : ""}.`} />
              <Legend series={series} />
              {!result && (
                <div className="salerow fl-compare">
                  <span className="mut">Compare with</span>
                  <select className="cell" value={compare} onChange={(ev) => setCompare(ev.target.value)}>
                    <option value="">nothing</option>
                    {blends.filter((b) => b.r.name !== r.name).map((b) => <option key={b.r.name} value={b.r.name}>{b.r.name}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="fl-tablecol">
              <div className="tblscroll"><table className="tbl fl-axes">
                <thead><tr><th>Axis</th><th className="num">{after ? "Now" : "Score"}</th>{after && <th className="num">After</th>}{cmp && <th className="num">{cmp.r.name}</th>}<th>Mostly from</th></tr></thead>
                <tbody>{AXES.map((a) => {
                  const from = (p.drivers[a.k] || []).filter((d) => d.share >= 0.05).slice(0, 3);
                  const d = after ? after.scores[a.k] - p.scores[a.k] : 0;
                  return (
                    <tr key={a.k}>
                      <td className="nowrap">{a.label}</td>
                      <td className="num">{one(p.scores[a.k])}</td>
                      {after && <td className="num">{one(after.scores[a.k])}{Math.abs(d) >= 0.2 && <span className="fl-d">{d > 0 ? "▲" : "▼"}{one(Math.abs(d))}</span>}</td>}
                      {cmp && <td className="num">{one(cmp.p.scores[a.k])}</td>}
                      <td className="small">{from.length ? from.map((x) => `${x.name} ${Math.round(x.share * 100)}%`).join(", ") : <span className="mut">nothing</span>}</td>
                    </tr>);
                })}</tbody>
              </table></div>
            </div>
          </div>
          {p.groups.length > 0 && (
            <>
              <h3>Science of Spice groups in this blend</h3>
              <div className="fl-chips">{p.groups.map((x) => <span key={x.name} className="fl-chip grp">{x.name} <span className="mut">{Math.round(x.share * 100)}%</span></span>)}</div>
              <p className="hint" style={{ marginTop: 8, marginBottom: 0 }}>{p.linkers.length ? `Linking spices: ${p.linkers.join(", ")}.` : "No linking spice (coriander, cinnamon or ginger)."}<Tip side="left">Linking spices share compounds with several flavour groups, which helps a wide blend read as one flavour.</Tip></p>
            </>
          )}
          {notes.length > 0 && (
            <>
              <h3>Worth knowing</h3>
              <ul className="fl-notes">{notes.map((n, i) => <li key={i}>{n.text}</li>)}</ul>
            </>
          )}
        </section>

        <section className="card fl-ask">
          <h2>Ask Claude to change it<Tip side="left">Claude sees this blend's grams and profile, every ingredient in stock with its cost and flavour data, and the rules of thumb behind the scores{toolsOK ? ", and checks its draft against the same scoring" : ""}. Each question uses your own Claude allowance; the first asks permission.</Tip></h2>
          {sample === undefined ? <p className="hint">Checking whether Claude is available here…</p>
            : !canAsk ? <p className="hint">Claude isn't available in this view{aiGone ? " (permission was declined or isn't enabled)" : ""}.</p>
            : (
              <>
                <p className="hint">Say what you want changed. Nothing saves until you open the suggestion in the recipe editor and save it.</p>
                <textarea className="paste fl-input" rows={3} maxLength={600} value={request} placeholder="e.g. Make it less salty but keep it punchy" onChange={(ev) => setRequest(ev.target.value)} disabled={run.status === "thinking"} />
                <div className="fl-chips" style={{ marginTop: 8 }}>{EXAMPLES.map((x) => <button key={x} className="mini ghost" onClick={() => setRequest(x)} disabled={run.status === "thinking"}>{x}</button>)}</div>
                <div className="actions">
                  <button className="primary" onClick={ask} disabled={!request.trim() || run.status === "thinking"}>Ask Claude</button>
                  {run.status === "thinking" && <button onClick={stop}>Stop</button>}
                  {run.status === "thinking" && <span className="mut fl-pulse">{run.phase}</span>}
                </div>
                {run.status === "error" && <p className="errmsg" style={{ marginTop: 10 }}>{run.text}</p>}
              </>
            )}
          {result && (
            <div className="fl-result">
              <div className="fl-resulthead">
                <h3 style={{ margin: 0 }}>Claude's suggestion</h3>
                <span className={`fl-conf ${result.confidence}`}>{result.confidence} confidence</span>
              </div>
              <p className="mut small" style={{ margin: "4px 0 8px" }}>You asked: “{result.request}” · {when(result.at)}</p>
              {result.summary && <p className="fl-summary">{result.summary}</p>}
              {result.question && <p className="fl-question"><b>Claude asks:</b> {result.question}</p>}
              <div className="statrow fl-compstats">
                <div className="stat"><div className="n">{pct(p.saltPct)} → {pct(after.saltPct)}</div><div className="l">salt</div></div>
                <div className="stat"><div className="n">{pct(p.sugarPct)} → {pct(after.sugarPct)}</div><div className="l">sugar</div></div>
                <div className="stat"><div className="n">{shuFmt(p.shu)} → {shuFmt(after.shu)}</div><div className="l">SHU ({p.heat.toLowerCase()} → {after.heat.toLowerCase()})</div></div>
                <div className="stat"><div className="n">{gbp(costNow)} → {gbp(costAfter)}</div><div className="l">cost per pack · margin {margin(costNow)}% → {margin(costAfter)}%</div></div>
              </div>
              <div className="tblscroll" style={{ marginTop: 12 }}><table className="tbl">
                <thead><tr><th>Ingredient</th><th className="num">Now</th><th className="num">Suggested</th><th className="num">Change</th><th>Why</th></tr></thead>
                <tbody>{result.diff.map((d) => (
                  <tr key={d.ingredient}>
                    <td><b>{d.ingredient}</b>{!stockMap[d.ingredient] && <span className="fl-chip warn">not in stock</span>}</td>
                    <td className="num">{d.fromG ? grams(d.fromG) : "-"}</td>
                    <td className="num">{d.toG ? grams(d.toG) : "removed"}</td>
                    <td className="num"><span className="fl-d strong">{d.toG > d.fromG ? "+" : "−"}{grams(Math.abs(d.toG - d.fromG))}</span></td>
                    <td className="small">{d.why}</td>
                  </tr>))}
                </tbody>
              </table></div>
              {result.diff.length === 0 && <p className="hint">Claude kept the recipe as it is.</p>}
              <p className="hint" style={{ marginTop: 10 }}>Suggested lines total <b>{grams(afterG)}</b> against a {r.packSizeG}g pack{Math.abs(afterG - r.packSizeG) > 0.6 ? <span className="errmsg">: {afterG > r.packSizeG ? "over" : "under"} by {grams(Math.abs(afterG - r.packSizeG))}. Adjust in the editor before saving.</span> : " ✓"}</p>
              {(result.watch.length > 0 || result.problems.length > 0) && (
                <ul className="fl-notes">{[...result.problems, ...result.watch].map((w, i) => <li key={i}>{w}</li>)}</ul>
              )}
              <div className="actions">
                <button className="primary" onClick={() => onOpenDraft({ mode: "draft", base: r.name, lines: [...result.lines, ...packing], note: `From Claude's suggestion for ${r.name}: “${result.request}”` })}>Open as a new draft blend</button>
                <button onClick={() => onOpenDraft({ mode: "edit", base: r.name, lines: [...result.lines, ...packing], note: `Claude's suggested amounts, not saved yet: “${result.request}”` })}>Edit {r.name} with these amounts</button>
                <button onClick={() => setResult(null)}>Close</button>
              </div>
            </div>
          )}
          {pastHere.length > 0 && (
            <>
              <h3>Earlier suggestions for {r.name}</h3>
              <ul className="loglist fl-past">{pastHere.map((h) => (
                <li key={h.id}>
                  <span>{when(h.at)}</span>
                  <span className="fl-pastq">“{h.request}”</span>
                  <button className="mini" onClick={() => { setResult(h); setRun({ status: "idle" }); }}>{result && result.id === h.id ? "Showing" : "Show"}</button>
                </li>))}
              </ul>
            </>
          )}
        </section>
      </>
    );
  }
}

function FlavourStyle() {
  return (
    <style>{`
      .sos-root{--series-1:#3987e5;--series-2:#d95926}
      .fl .fl-n{font-size:19px;line-height:1.2}
      .fl-backrow{display:flex;justify-content:space-between;align-items:center;gap:10px}
      .fl-chips{display:flex;flex-wrap:wrap;gap:6px}
      .fl-chip{display:inline-block;font-size:12px;padding:2px 8px;border-radius:10px;border:1px solid var(--line);color:var(--parch);background:var(--panel2);white-space:nowrap;margin-left:0}
      .fl-chip.grp{background:transparent}
      .fl-chip.mine{margin-left:8px;border-color:var(--ember);color:var(--ember-hi);font-size:11px;padding:0 6px}
      .fl-chip.warn{margin-left:8px;border-color:var(--warnc);color:var(--warnc);font-size:11px;padding:0 6px}
      .fl-est{color:var(--warnc);font-size:11px;font-family:inherit}
      .fl-heat{font-size:12px;padding:1px 7px;border-radius:8px;border:1px solid var(--line);font-family:inherit;font-weight:600}
      .fl-heat.h0{color:var(--parch-dim)} .fl-heat.h1{color:var(--parch)} .fl-heat.h2{color:var(--warnc);border-color:var(--warnc)}
      .fl-heat.h3{color:var(--ember-hi);border-color:var(--ember)} .fl-heat.h4{color:#fff;background:var(--dangerc);border-color:var(--dangerc)}
      .fl-head{flex-wrap:wrap}
      .fl-seg{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden}
      .fl-seg button{background:transparent;border:0;color:var(--parch-dim);font:inherit;font-size:13px;padding:5px 12px;cursor:pointer}
      .fl-seg button.on{background:rgba(224,123,57,.12);color:var(--ember-hi)}
      .fl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px}
      .fl-card{background:var(--panel2);border:1px solid var(--line);border-radius:12px;padding:10px 8px 10px;color:var(--parch);font:inherit;text-align:center;cursor:pointer;min-width:0;content-visibility:auto;contain-intrinsic-size:auto 260px}
      .fl-card:hover,.fl-card:focus-visible{border-color:var(--ember);outline:none}
      .fl-cardname{font-weight:600;font-size:14.5px}
      .fl-cardfoot{font-size:12px;color:var(--parch-dim);margin-top:2px;min-height:16px}
      .fl-radar{position:relative;width:100%}
      .fl-radar svg{display:block;width:100%;height:auto;overflow:visible;touch-action:pan-y}
      .fl-radar.lg{max-width:460px;margin:0 auto}
      .fl-radar.lg svg:focus-visible{outline:1px solid var(--ember);outline-offset:2px;border-radius:8px}
      .fl-ring{fill:none;stroke:var(--line);stroke-width:1}
      .fl-spoke{stroke:var(--line);stroke-width:1}
      .fl-spoke.on{stroke:var(--parch-dim)}
      .fl-tick{fill:var(--parch-dim);font-size:10px;font-family:ui-monospace,monospace}
      .fl-axis{fill:var(--parch-dim);font-size:10.5px;font-family:inherit}
      .fl-radar.lg .fl-axis{font-size:14px}
      .fl-axis.on{fill:var(--parch)}
      .fl-series .fl-area{stroke:none;opacity:.12}
      .fl-series .fl-line{fill:none;stroke-width:2;stroke-linejoin:round}
      .fl-series .fl-dot{stroke:var(--panel2);stroke-width:2}
      .fl-radar.lg .fl-series .fl-dot{stroke:var(--panel)}
      .fl-series .fl-dot.on{r:6}
      .fl-series.s1 .fl-area{fill:var(--series-1)} .fl-series.s1 .fl-line{stroke:var(--series-1)} .fl-series.s1 .fl-dot{fill:var(--series-1)}
      .fl-series.s2 .fl-area{fill:var(--series-2)} .fl-series.s2 .fl-line{stroke:var(--series-2)} .fl-series.s2 .fl-dot{fill:var(--series-2)}
      .fl-tip{position:absolute;transform:translate(-50%,calc(-100% - 10px));background:var(--ink);border:1px solid var(--line);border-radius:8px;padding:6px 9px;font-size:12px;pointer-events:none;white-space:nowrap;z-index:5;text-align:left;box-shadow:0 4px 14px rgba(0,0,0,.35)}
      .fl-tiprow{display:flex;align-items:center;gap:6px}
      .fl-tiprow b{color:var(--parch);font-size:13px;font-variant-numeric:tabular-nums}
      .fl-tiprow span:last-child{color:var(--parch-dim)}
      .fl-tipaxis{color:var(--parch);margin-top:2px}
      .fl-tipfrom{color:var(--parch-dim);font-size:11.5px;margin-top:3px;white-space:normal;max-width:220px}
      .fl-key{display:inline-block;width:14px;height:2px;border-radius:1px;vertical-align:middle;margin-right:6px}
      .fl-key.s1{background:var(--series-1)} .fl-key.s2{background:var(--series-2)}
      .fl-legend{display:flex;gap:16px;justify-content:center;flex-wrap:wrap;font-size:13px;color:var(--parch);margin-top:4px}
      .fl-legend .fl-key{height:3px;width:18px}
      .fl-detail{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:18px;align-items:start;margin-top:10px}
      .fl-chartcol,.fl-tablecol{min-width:0}
      .fl-compare{justify-content:center;margin-top:8px}
      .fl-facts{display:grid;grid-template-columns:repeat(4,minmax(84px,auto));gap:8px}
      .fl-facts>div{background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:8px 12px;text-align:center;min-width:0}
      .fl-d{font-size:12px;margin-left:6px;color:var(--parch-dim);font-variant-numeric:tabular-nums}
      .fl-d.strong{margin-left:0;color:var(--parch)}
      .fl-facts b{display:block;font-size:17px;color:var(--parch)}
      .fl-facts span{font-size:11.5px;color:var(--parch-dim)}
      .fl-facts b.fl-heat{display:inline-block;font-size:13px;margin-bottom:2px}
      .fl-notes{margin:6px 0 0;padding-left:18px;color:var(--parch);font-size:13.5px;line-height:1.55}
      .fl-notes li{margin-bottom:4px}
      .fl-input{min-height:72px;font-family:inherit;font-size:14px;resize:vertical}
      .fl-pulse{animation:flpulse 1.6s ease-in-out infinite}
      @keyframes flpulse{50%{opacity:.45}}
      @media (prefers-reduced-motion: reduce){.fl-pulse{animation:none}}
      .fl-result{margin-top:16px;padding:14px;border:1px solid var(--series-2);border-radius:12px;background:rgba(217,89,38,.05)}
      .fl-resulthead{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
      .fl-conf{font-size:12px;padding:1px 8px;border-radius:8px;border:1px solid var(--line);color:var(--parch-dim)}
      .fl-conf.high{border-color:var(--arcane);color:var(--arcane)} .fl-conf.low{border-color:var(--warnc);color:var(--warnc)}
      .fl-summary{font-size:14.5px;line-height:1.55;margin:4px 0 8px}
      .fl-question{font-size:13.5px;color:var(--warnc)}
      .fl-compstats .stat .n{font-size:17px}
      .fl-past li{display:flex;gap:10px;align-items:center}
      .fl-pastq{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .fl-lib>summary{cursor:pointer;list-style:none}
      .fl-lib>summary::-webkit-details-marker{display:none}
      .fl-lib>summary::before{content:"▸ ";color:var(--parch-dim)}
      .fl-lib[open]>summary::before{content:"▾ "}
      .fl-libtbl td{vertical-align:top}
      .fl-editor{border:1px solid var(--ember);border-radius:12px;padding:14px;margin-bottom:12px;background:rgba(224,123,57,.04)}
      .fl-editor h3{margin-top:0}
      .fl-form{display:flex;flex-wrap:wrap;gap:10px 14px;margin:8px 0}
      .fl-form label,.fl-wide{display:flex;flex-direction:column;gap:4px;font-size:12.5px;color:var(--parch-dim)}
      .fl-wide{margin-top:8px}
      .fl-wide .cell.wide{width:100%;max-width:520px}
      .fl-sources{margin:4px 0 0;padding-left:18px}
      .fl-sources a{color:var(--ember-hi)}
      .fl-matrix td,.fl-matrix th{white-space:nowrap}
      @media (max-width:760px){.fl-detail{grid-template-columns:minmax(0,1fr)}}
      @media (max-width:640px){.fl-grid{grid-template-columns:minmax(0,1fr)}.fl-card .fl-radar{max-width:300px;margin:0 auto}.fl-facts{grid-template-columns:repeat(2,minmax(0,1fr));width:100%}.fl-facts>div{padding:6px 8px}.fl .fl-n{font-size:16px}}
    `}</style>
  );
}
