import { useState, useEffect, useMemo, useCallback } from "react";
import * as XLSX from "xlsx";
import { appStorage } from "./storage.js";

// ============ SEED DATA (parsed & normalised from SOS_business_cost_1_1.xlsx) ============
// Demo seed: all blends and ratios are fictional.
const SEED = {"ingredients":[{"name":"Black Pepper","costPerG":0.016,"packSizeG":500,"supplier":"wholesale-spices.example","stockG":0},{"name":"Brown Sugar","costPerG":0.003,"packSizeG":500,"supplier":"wholesale-spices.example","stockG":0},{"name":"Cayenne","costPerG":0.0196,"packSizeG":250,"supplier":"wholesale-spices.example","stockG":0},{"name":"Celery Salt","costPerG":0.0047,"packSizeG":500,"supplier":"wholesale-spices.example","stockG":0},{"name":"Chilli Flakes","costPerG":0.014,"packSizeG":250,"supplier":"wholesale-spices.example","stockG":0},{"name":"Cinnamon","costPerG":0.0154,"packSizeG":250,"supplier":"wholesale-spices.example","stockG":0},{"name":"Coriander","costPerG":0.0075,"packSizeG":250,"supplier":"wholesale-spices.example","stockG":0},{"name":"Cumin","costPerG":0.016,"packSizeG":250,"supplier":"wholesale-spices.example","stockG":0},{"name":"Garlic Granules","costPerG":0.014,"packSizeG":500,"supplier":"wholesale-spices.example","stockG":0},{"name":"Ginger","costPerG":0.013,"packSizeG":250,"supplier":"wholesale-spices.example","stockG":0},{"name":"Lemon Peel","costPerG":0.03,"packSizeG":100,"supplier":"wholesale-spices.example","stockG":0},{"name":"Mustard Powder","costPerG":0.025,"packSizeG":125,"supplier":"wholesale-spices.example","stockG":0},{"name":"Onion Powder","costPerG":0.007,"packSizeG":500,"supplier":"wholesale-spices.example","stockG":0},{"name":"Oregano","costPerG":0.0156,"packSizeG":250,"supplier":"wholesale-spices.example","stockG":0},{"name":"Rosemary","costPerG":0.0176,"packSizeG":250,"supplier":"wholesale-spices.example","stockG":0},{"name":"Sea Salt","costPerG":0.003,"packSizeG":500,"supplier":"wholesale-spices.example","stockG":0},{"name":"Smoked Paprika","costPerG":0.0115,"packSizeG":500,"supplier":"wholesale-spices.example","stockG":0},{"name":"Star Anise","costPerG":0.068,"packSizeG":100,"supplier":"wholesale-spices.example","stockG":0},{"name":"Sweet Paprika","costPerG":0.0085,"packSizeG":500,"supplier":"wholesale-spices.example","stockG":0},{"name":"Thyme","costPerG":0.0105,"packSizeG":250,"supplier":"wholesale-spices.example","stockG":0}],"recipes":[{"name":"Goblin's Garland","sku":"DEMOGG","packSizeG":70,"batchPacks":10,"lines":[{"ingredient":"Thyme","perPackG":15.56},{"ingredient":"Rosemary","perPackG":12.44},{"ingredient":"Oregano","perPackG":9.33},{"ingredient":"Garlic Granules","perPackG":12.44},{"ingredient":"Sea Salt","perPackG":9.33},{"ingredient":"Black Pepper","perPackG":6.22},{"ingredient":"Lemon Peel","perPackG":4.67}]},{"name":"Frost Giant Fish Rub","sku":"DEMOFG","packSizeG":65,"batchPacks":10,"lines":[{"ingredient":"Sea Salt","perPackG":22.94},{"ingredient":"Lemon Peel","perPackG":13.38},{"ingredient":"Black Pepper","perPackG":11.47},{"ingredient":"Mustard Powder","perPackG":5.74},{"ingredient":"Ginger","perPackG":3.82},{"ingredient":"Coriander","perPackG":7.65}]},{"name":"Ember Imp","sku":"DEMOEI","packSizeG":80,"batchPacks":10,"lines":[{"ingredient":"Brown Sugar","perPackG":26.67},{"ingredient":"Smoked Paprika","perPackG":14.81},{"ingredient":"Chilli Flakes","perPackG":8.89},{"ingredient":"Cayenne","perPackG":4.44},{"ingredient":"Garlic Granules","perPackG":7.41},{"ingredient":"Sea Salt","perPackG":11.85},{"ingredient":"Cumin","perPackG":5.93}]},{"name":"Wyrmwood Wanderer","sku":"DEMOWW","packSizeG":80,"batchPacks":10,"lines":[{"ingredient":"Sweet Paprika","perPackG":24.89},{"ingredient":"Onion Powder","perPackG":14.22},{"ingredient":"Celery Salt","perPackG":12.44},{"ingredient":"Black Pepper","perPackG":8.89},{"ingredient":"Cinnamon","perPackG":3.56},{"ingredient":"Sea Salt","perPackG":16.0}]},{"name":"Arcane Ancho","sku":"DEMOAA","packSizeG":65,"batchPacks":10,"lines":[{"ingredient":"Cumin","perPackG":16.03},{"ingredient":"Coriander","perPackG":8.74},{"ingredient":"Smoked Paprika","perPackG":10.2},{"ingredient":"Star Anise","perPackG":2.33},{"ingredient":"Brown Sugar","perPackG":11.66},{"ingredient":"Sea Salt","perPackG":10.2},{"ingredient":"Chilli Flakes","perPackG":5.83}]},{"name":"Pixie's Picnic","sku":"DEMOPP","packSizeG":70,"batchPacks":10,"lines":[{"ingredient":"Brown Sugar","perPackG":26.25},{"ingredient":"Cinnamon","perPackG":10.94},{"ingredient":"Ginger","perPackG":8.75},{"ingredient":"Sea Salt","perPackG":13.12},{"ingredient":"Sweet Paprika","perPackG":10.94}]}],"finished":{"Goblin's Garland":4,"Frost Giant Fish Rub":2,"Ember Imp":6,"Wyrmwood Wanderer":1,"Arcane Ancho":3,"Pixie's Picnic":5}};

const DEFAULT_SETTINGS = {
  reorderBatches: 2,        // fallback cover when no sales data: N batches of heaviest-drawing blend
  defaultBatchPacks: 10,    // packs per standard batch (recipe pages can scale per brew)
  leadTimeDays: 3,          // supplier order-to-door
  safetyDays: 7,            // demand buffer on top of lead time
  shelfLifeMonths: 12,      // best-before applied to new batches
  packaging: { "Kraft packet": 0.16, "Front label": 0.32, "Back label": 0.24, "Postal box (printed)": 1.07 },
  sellPrice: 7.99,
  priceLastSynced: null,
  channelFees: { Etsy: { pct: 13.2, fixed: 0.65 }, Shopify: { pct: 2.9, fixed: 0.3 }, Event: { pct: 0, fixed: 0 }, Wholesale: { pct: 0, fixed: 0 }, Other: { pct: 0, fixed: 0 }, Quick: { pct: 0, fixed: 0 }, Direct: { pct: 0, fixed: 0 } },
  freeShipThreshold: 60,    // supplier free-delivery threshold (£) — check BuyWholefoods' current figure
  shippingCost: 4.99,       // what a sub-threshold order costs you
  marginFloorPct: 50,       // flag blends whose gross margin drops below this
  lastPriceImpact: null,    // captured on each price refresh
  // modules: turn a capability off when an external integration owns that job (system-of-record delegation)
  modules: { sales: true, purchasing: true, bundles: true, events: true, shrink: true, counts: true, lots: true },
};

const STORE_KEY = "sos_stockroom_demo_v1";
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

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState("idle");
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
  const [builder, setBuilder] = useState({ name: "", items: [SEED.recipes[0].name, SEED.recipes[1].name, SEED.recipes[2].name], packagingCost: 2.22, salePrice: 19.99 });
  const [csvText, setCsvText] = useState("");
  const [csvChannel, setCsvChannel] = useState("Shopify");
  const [csvMsg, setCsvMsg] = useState(null);
  const [stateIO, setStateIO] = useState("");
  const [ioMsg, setIoMsg] = useState(null);
  const [editIng, setEditIng] = useState(null); // {name(original), newName, supplier, packSizeG, packPrice, parG, isNew}
  const [purchases, setPurchases] = useState([]); // {ts, name, grams, cost, kind:'standard'|'top-up'}
  const [buyForm, setBuyForm] = useState(null); // {name, grams, price}

  // ---------- load ----------
  useEffect(() => {
    (async () => {
      try {
        const res = await appStorage.get(STORE_KEY);
        if (res && res.value) {
          const d = JSON.parse(res.value);
          if (d.ings) {
            const saved = Object.fromEntries(d.ings.map((i) => [i.name, i]));
            const seedNames = new Set(SEED.ingredients.map((s) => s.name));
            const merged = SEED.ingredients.map((s) => saved[s.name] ? { ...s, ...saved[s.name] } : s);
            const customs = d.ings.filter((i) => !seedNames.has(i.name)); // user-added products
            setIngs([...merged, ...customs]);
          }
          if (d.recipes) {
            const saved = Object.fromEntries(d.recipes.map((r) => [r.name, r]));
            const seedNames = new Set(SEED.recipes.map((s) => s.name));
            setRecipes([...SEED.recipes.map((s) => saved[s.name] ? { ...s, ...saved[s.name] } : s),
              ...d.recipes.filter((r) => !seedNames.has(r.name))]);
          }
          if (d.finished) setFinished({ ...SEED.finished, ...d.finished });
          if (d.settings) {
            const pkg = { ...DEFAULT_SETTINGS.packaging, ...(d.settings.packaging || {}) };
            const cf = { ...DEFAULT_SETTINGS.channelFees, ...(d.settings.channelFees || {}) };
            if (cf.Etsy && cf.Etsy.pct === 13 && cf.Etsy.fixed === 0.45) cf.Etsy = { pct: 13.2, fixed: 0.65 }; // calibrated from real statement
            if ("Box / seal" in pkg) { delete pkg["Box / seal"]; pkg["Postal box (printed)"] = DEFAULT_SETTINGS.packaging["Postal box (printed)"]; } // printed box replaces old box cost in COGS
            setSettings({ ...DEFAULT_SETTINGS, ...d.settings, packaging: pkg, channelFees: cf, modules: { ...DEFAULT_SETTINGS.modules, ...(d.settings.modules || {}) } });
          }
          if (d.log) setLog(d.log);
          if (d.sales) setSales(d.sales);
          if (d.events) setEvents(d.events);
          if (d.shrink) setShrink(d.shrink);
          if (d.bundles) setBundles(d.bundles);
          if (d.purchases) setPurchases(d.purchases);
        }
      } catch (e) { /* first run */ }
      setLoaded(true);
    })();
  }, []);

  // ---------- save ----------
  const persist = useCallback(async (next) => {
    setSaveState("saving");
    try {
      const payload = JSON.stringify({
        ings: next.ings ?? ings, finished: next.finished ?? finished, settings: next.settings ?? settings,
        log: next.log ?? log, sales: next.sales ?? sales, events: next.events ?? events,
        shrink: next.shrink ?? shrink, bundles: next.bundles ?? bundles, recipes: next.recipes ?? recipes,
        purchases: next.purchases ?? purchases,
      });
      const r = await appStorage.set(STORE_KEY, payload);
      setSaveState(r ? "idle" : "error");
    } catch (e) { setSaveState("error"); }
  }, [ings, finished, settings, log, sales, events, shrink, bundles, recipes, purchases]);

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
      sellAt: sell, margin: sell - unitCost, startable: lines.every((l) => l.status !== "red"),
      rate, salesInWindow: velocity.count[r.name] || 0, daysCover, oldestBB };
  }); }, [recipes, stockMap, packagingTotal, settings.sellPrice, settings.defaultBatchPacks, velocity, finished, log]);

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
    const gp = revenue - fees - cogs;
    const gpAfter = gp - winValue;
    // per-channel P&L
    const byChannel = {};
    salesWin.forEach((s) => {
      if (!byChannel[s.channel]) byChannel[s.channel] = { channel: s.channel, units: 0, gross: 0, fees: 0, cogs: 0 };
      const r = recipeCalc.find((x) => x.name === s.sku);
      const b = byChannel[s.channel];
      b.units += s.qty; b.gross += s.qty * settings.sellPrice;
      b.fees += s.qty * feeFor(s.channel, settings.sellPrice);
      b.cogs += s.qty * (r ? r.unitCost : 0);
    });
    return {
      win, winValue, allValue, stockValue,
      byReason: Object.entries(byReason).sort((a, b) => b[1] - a[1]),
      byItem: Object.values(byItem).sort((a, b) => b.value - a.value),
      byChannel: Object.values(byChannel).map((b) => ({ ...b, net: b.gross - b.fees, gp: b.gross - b.fees - b.cogs })).sort((a, b) => b.gross - a.gross),
      pctOfStock: stockValue > 0 ? winValue / stockValue * 100 : 0,
      pctOfSales: revenue > 0 ? winValue / revenue * 100 : null,
      revenue, fees, gp, gpAfter,
      gpPct: revenue > 0 ? gp / revenue * 100 : null,
      gpAfterPct: revenue > 0 ? gpAfter / revenue * 100 : null,
    };
  }, [shrink, ings, finished, recipeCalc, sales, settings.sellPrice, feeFor]);

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
    const nextP = [rec, ...purchases].slice(0, 300);
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
    const nextP = [rec, ...purchases].slice(0, 300);
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
    const nextLog = [{ ts: now.toISOString(), recipe: r.name, packs: p, ...(mod.lots ? { code, bestBefore: addMonths(now, settings.shelfLifeMonths).toISOString() } : {}) }, ...log].slice(0, 100);
    setIngs(nextIngs); setFinished(nextFin); setLog(nextLog);
    persist({ ings: nextIngs, finished: nextFin, log: nextLog });
    setConfirmBatch(null);
  };
  const recordSale = (name, qty, channel = "Quick", dateIso = null) => {
    const nextFin = { ...finished, [name]: Math.max(0, (finished[name] ?? 0) - qty) };
    if (!mod.sales) { setFinished(nextFin); persist({ finished: nextFin }); return; }
    const nextSales = [{ ts: dateIso || new Date().toISOString(), sku: name, qty, channel }, ...sales].slice(0, 500);
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
    const rec = { name: e.isNew ? name : e.orig, sku: e.sku.trim() || `SOS${name.replace(/[^A-Za-z]/g, "").slice(0, 5).toUpperCase()}`,
      packSizeG: Math.max(1, parseFloat(e.packSizeG) || 80), batchPacks: settings.defaultBatchPacks || 10, lines, ...(String(e.pkgOverride ?? "").trim() !== "" ? { pkgOverride: Math.max(0, parseFloat(e.pkgOverride) || 0) } : {}), ...(String(e.priceOverride ?? "").trim() !== "" ? { priceOverride: Math.max(0, parseFloat(e.priceOverride) || 0) } : {}), ...(e.isNew ? { custom: true } : {}) };
    const next = e.isNew ? [...recipes, rec] : recipes.map((r) => (r.name === e.orig ? { ...r, ...rec } : r));
    setRecipes(next); persist({ recipes: next }); setEditRecipe(null);
  };
  const deleteRecipe = (name) => {
    const next = recipes.filter((r) => r.name !== name);
    setRecipes(next); persist({ recipes: next }); setEditRecipe(null); setOpenRecipe(null);
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
    setIngs(next); persist({ ings: next }); setEditIng(null);
  };
  const deleteIngredient = (name) => {
    if (usedInRecipes(name) > 0) return; // recipe ingredients can't be removed
    const next = ings.filter((i) => i.name !== name);
    setIngs(next); persist({ ings: next }); setEditIng(null);
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
    const nextShrink = [entry, ...shrink].slice(0, 300);
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
  const bundleCost = (items, packagingCost) => {
    const rows = items.map((n) => recipeCalc.find((r) => r.name === n)).filter(Boolean);
    const ingredientCost = rows.reduce((a, r) => a + r.ingredientCost, 0);
    const packPackaging = rows.length * packagingTotal;
    const total = ingredientCost + packPackaging + (parseFloat(packagingCost) || 0);
    return { rows, ingredientCost, packPackaging, total };
  };
  const saveBundle = () => {
    if (!builder.name.trim() || builder.items.length === 0) return;
    const b = { id: uid(), name: builder.name.trim(), items: [...builder.items], packagingCost: parseFloat(builder.packagingCost) || 0, salePrice: parseFloat(builder.salePrice) || 0 };
    const next = [...bundles.filter((x) => x.name !== b.name), b];
    setBundles(next); persist({ bundles: next });
  };
  const deleteBundle = (id) => {
    const next = bundles.filter((b) => b.id !== id);
    setBundles(next); persist({ bundles: next });
  };
  const loadBundle = (b) => setBuilder({ name: b.name, items: [...b.items], packagingCost: b.packagingCost, salePrice: b.salePrice });

  // ---------- bulk import: Excel template, workbook ingestion, line-by-line report ----------
  const [ingest, setIngest] = useState(null); // {rows:[{sheet,row,entity,name,status,message}], counts}

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const readme = [
      ["STOCKROOM GRIMOIRE (DEMO) — BULK IMPORT TEMPLATE"], [],
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

  const ingestWorkbook = (wb) => {
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
      setIngs(nextIngs); setRecipes(nextRecipes);
      persist({ ings: nextIngs, recipes: nextRecipes });
    }
    setIngest({ rows: report, counts });
  };

  const handleImportFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try { ingestWorkbook(XLSX.read(ev.target.result, { type: "array" })); }
      catch (e) { setIngest({ rows: [{ sheet: "-", row: "-", entity: "file", name: file.name, status: "failed", message: "Couldn't read this file — save as .xlsx or .csv and try again." }], counts: { failed: 1 } }); }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSalesFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: "array" });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" }).map((r) => r.map(String));
        ingestSalesRows(rows);
      } catch (e) { setCsvMsg({ ok: false, text: "Couldn't read that file — export as CSV or Excel from your sales platform and try again." }); }
    };
    reader.readAsArrayBuffer(file);
  };

  const downloadIngestReport = () => {
    if (!ingest) return;
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
  const ingestSalesRows = (rows) => {
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
      const nextSales = [...newSales, ...sales].slice(0, 500);
      // note: import records history only — it does not deduct shelf stock (assumed already gone)
      setSales(nextSales); persist({ sales: nextSales });
      setCsvMsg({ ok: true, text: `${applied} packs across ${newSales.length} lines imported.${unmatched.size ? ` Unmatched: ${[...unmatched].slice(0, 3).join("; ")}${unmatched.size > 3 ? "…" : ""}` : ""}` });
      setCsvText("");
    } catch (e) { setCsvMsg({ ok: false, text: "Couldn't read that data — it needs a header row with a product column (and ideally quantity + date), with product names containing your blend names." }); }
  };
  const importCSVSales = () => ingestSalesRows(parseCSV(csvText));

  // ---------- open schema: full state export / import ----------
  const exportState = () => JSON.stringify({
    schema: "sos.stockroom.v1", exportedAt: new Date().toISOString(),
    settings, ingredients: ings, finishedPacks: finished, batchLog: log, sales, events, shrink, bundles,
    recipes: recipes.map((r) => ({ name: r.name, sku: r.sku, packSizeG: r.packSizeG, batchPacks: r.batchPacks, lines: r.lines })),
  }, null, 1);
  const importState = () => {
    try {
      const d = JSON.parse(stateIO);
      if (d.schema !== "sos.stockroom.v1") throw new Error("wrong schema");
      if (d.ingredients) {
        const saved = Object.fromEntries(d.ingredients.map((i) => [i.name, i]));
        const seedNames = new Set(SEED.ingredients.map((s) => s.name));
        const nextIngs = [...SEED.ingredients.map((s) => saved[s.name] ? { ...s, ...saved[s.name] } : s),
          ...d.ingredients.filter((i) => !seedNames.has(i.name))];
        setIngs(nextIngs);
        const nextFin = { ...SEED.finished, ...(d.finishedPacks || {}) };
        const nextSet = { ...DEFAULT_SETTINGS, ...(d.settings || {}) };
        setFinished(nextFin); setSettings(nextSet);
        setLog(d.batchLog || []); setSales(d.sales || []); setEvents(d.events || []); setShrink(d.shrink || []); setBundles(d.bundles || []);
        let nextRecipes = recipes;
        if (d.recipes) {
          const savedR = Object.fromEntries(d.recipes.map((r) => [r.name, r]));
          const seedR = new Set(SEED.recipes.map((s) => s.name));
          nextRecipes = [...SEED.recipes.map((s) => savedR[s.name] ? { ...s, ...savedR[s.name] } : s), ...d.recipes.filter((r) => !seedR.has(r.name))];
          setRecipes(nextRecipes);
        }
        persist({ ings: nextIngs, finished: nextFin, settings: nextSet, log: d.batchLog || [], sales: d.sales || [], events: d.events || [], shrink: d.shrink || [], bundles: d.bundles || [], recipes: nextRecipes });
        setIoMsg({ ok: true, text: "State imported — everything replaced with the file's contents." });
        setStateIO("");
      }
    } catch (e) { setIoMsg({ ok: false, text: "Import failed — expected sos.stockroom.v1 JSON from the export button." }); }
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
  const importPrices = () => {
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
      setIngs(next);
      const ns = { ...settings, priceLastSynced: new Date().toISOString(), lastPriceImpact: impact.length ? impact : null };
      setSettings(ns); persist({ ings: next, settings: ns });
      setImportMsg({ ok: true, text: `${applied} price${applied === 1 ? "" : "s"} updated.` });
      setImportText("");
    } catch (e) { setImportMsg({ ok: false, text: "Couldn't read that JSON — check the format and try again." }); }
  };
  const copyText = async (t) => { try { await navigator.clipboard.writeText(t); } catch (e) {} };
  const exportForRefresh = () => JSON.stringify(
    ings.filter((i) => i.supplier.includes("wholesale")).map((i) => ({ name: i.name, costPerG: stdOf(i), packSizeG: i.packSizeG })), null, 1);
  const pickListText = (r, packs = 10) => {
    const lines = r.lines.map((l) => `${l.ingredient.padEnd(26)} ${g(l.perPackG * packs)}`).join("\n");
    return `SAGES OF SPICE — WEIGH-OUT LIST\n${r.name} · ${packs} × ${r.packSizeG}g packs\n${"—".repeat(38)}\n${lines}\n${"—".repeat(38)}\nTotal blend: ${g(r.lines.reduce((a, l) => a + l.perPackG, 0) * packs)}\nWeigh everything out BEFORE mixing.`;
  };

  if (!loaded) return (<div className="sos-root"><Style /><div className="loading">Opening the stockroom ledger…</div></div>);

  const dot = (s) => <span className={`dot ${s}`} />;
  const coverBadge = (d) => d === null ? <span className="mut">no sales data</span>
    : d < settings.leadTimeDays + settings.safetyDays ? <span className="cov red">{Math.floor(d)}d cover</span>
    : d < 30 ? <span className="cov amber">{Math.floor(d)}d cover</span>
    : <span className="cov green">{d > 365 ? "365+" : Math.floor(d)}d cover</span>;

  return (
    <div className="sos-root"><Style />
      <header className="hdr">
        <div className="brand">
          <div className="sigil">✦</div>
          <div>
            <h1>The Stockroom Grimoire</h1>
            <div className="sub">Demo edition · fictional blends &amp; ratios</div>
          </div>
        </div>
        <div className={`savebadge ${saveState}`}>{saveState === "saving" ? "Saving…" : saveState === "error" ? "Save failed — retry any edit" : "Saved"}</div>
      </header>

      <nav className="tabs">
        {[["overview", "Overview"], ["recipes", "Recipes"], ["ingredients", "Ingredients"], ["stock", "Finished packs"], ["sales", "Sales"], ["bundles", "Bundles"], ["events", "Events"], ["shrinkage", "Shrink & gifting"], ["shopping", "Shopping"], ["sync", "Data, API & settings"]].filter(([k]) => (
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
              <h2>Welcome to the stockroom — three steps to wake it up</h2>
              <p className="hint">Everything below shows red and zero because the ledger is empty, not because anything's wrong. Do these in order and the intelligence switches on:</p>
              <div className="actions" style={{ marginTop: 4 }}>
                <button onClick={() => setTab("ingredients")}>1 · Count your ingredients</button>
                <button onClick={() => setTab("sync")}>2 · Check prices are current</button>
                <button onClick={() => setTab("sales")}>3 · Log a few recent sales</button>
              </div>
              <p className="hint" style={{ marginTop: 10 }}>Step 1 unlocks brew feasibility and the shopping list. Step 3 (5+ sales) switches reordering from rule-of-thumb to demand-driven, and lights up days-of-cover everywhere.</p>
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
            <h2>Batch readiness</h2>
            <p className="hint">Green means you can brew it today; red names what\u2019s missing. Days-of-cover appears once sales are logged ({velocity.total < MIN_SALES_FOR_DEMAND ? `${MIN_SALES_FOR_DEMAND - velocity.total} more sale${MIN_SALES_FOR_DEMAND - velocity.total === 1 ? "" : "s"} switches reordering to demand-driven` : "demand-driven reordering is active"}).</p>
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
              {mod.lots && bbSoon.length > 0 && <p>{dot("amber")} <b>Best-before inside 60 days:</b> {bbSoon.map((r) => `${r.name} (${fmtD(r.oldestBB)})`).join(" · ")} — sell these packs first (FEFO).</p>}
              {mod.counts && countsDue.length > 0 && <p>{dot("amber")} <b>Cycle counts due:</b> {countsDue.filter((i) => i.abc === "A").length} A-class, {countsDue.filter((i) => i.abc === "B").length} B, {countsDue.filter((i) => i.abc === "C").length} C — see Ingredients tab.</p>}
            </section>
          )}

          {(marginBreaches.length > 0 || deadPacks.length > 0 || overstocked.length > 0 || priceImpact.length > 0 || topupPremium > 1) && (
            <section className="card">
              <h2>Insights — GP &amp; cash</h2>
              {mod.purchasing && topupPremium > 1 && <p>{dot("amber")} <b>Non-standard buying cost {gbp(topupPremium)} over standard rates in {VELOCITY_DAYS} days</b> — emergency top-ups are pure GP leakage; the reorder lines exist to make them rare.</p>}
              {priceImpact.length > 0 && <p>{dot("amber")} <b>Costs moved ≥5% on last price refresh:</b> {priceImpact.map((x) => `${x.name} ${gbp(x.before)}→${gbp(x.after)}`).join(" · ")} — check pricing still holds.</p>}
              {marginBreaches.length > 0 && <p>{dot("red")} <b>Below your {settings.marginFloorPct}% margin floor at {gbp(settings.sellPrice)}:</b> {marginBreaches.map((r) => `${r.name} (${Math.round(r.margin / r.sellAt * 100)}%)`).join(" · ")} — reprice, reformulate, or push through bundles.</p>}
              {deadPacks.length > 0 && <p>{dot("amber")} <b>No sales in {VELOCITY_DAYS} days but still shelved:</b> {deadPacks.map((r) => `${r.name} (${finished[r.name]} packs, ${gbp(r.unitCost * (finished[r.name] ?? 0))})`).join(" · ")} — classic move: bundle a slow mover with a bestseller.</p>}
              {overstocked.length > 0 && <p>{dot("amber")} <b>90+ days of ingredient cover (cash sitting still):</b> {overstocked.slice(0, 6).map((i) => `${i.name} (${gbp(i.stockG * i.costPerG)})`).join(" · ")}{overstocked.length > 6 ? ` · +${overstocked.length - 6} more` : ""} — pause reordering these.</p>}
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
            const matches = e.search.trim() ? ings.filter((i) => i.name.toLowerCase().includes(e.search.toLowerCase()) && !e.lines.some((l) => l.ingredient === i.name)).slice(0, 6) : [];
            return (
              <section className="card" style={{ borderColor: "var(--ember)" }}>
                <h2>{e.isNew ? "Add a blend" : `Edit ${e.orig}`}</h2>
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
                  <table className="tbl">
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
                  </table>
                )}
                <p className="hint" style={{ marginTop: 10 }}>
                  Lines total <b>{g(sumG)}</b> against a {g(packG)} pack{drift > 2 ? <span className="errmsg"> — {sumG > packG ? "over" : "under"} by {g(Math.abs(sumG - packG))}; the pack won't weigh what the label says</span> : " ✓"}. Ingredient cost {gbp(cost)} + packaging {gbp(packagingTotal)} = <b>{gbp(cost + packagingTotal)}/pack</b> ({settings.sellPrice > 0 ? Math.round((settings.sellPrice - cost - packagingTotal) / settings.sellPrice * 100) : 0}% margin at {gbp(settings.sellPrice)}).
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
            <Help>
              Tap any blend to see its full make-up, whether you can brew it today, and what's blocking it. Inside a blend: set the batch size, print the <b>weigh-out list</b> before mixing (your insurance against running out mid-batch), and <b>Brew it</b> when you start — ingredients come off the shelf immediately and packs go on. <b>Edit recipe</b> changes ratios; <b>+ Add blend</b> builds one on screen; for many at once, <b>Download Excel template</b>, fill the Ingredients sheet and one or more Blends tabs (each tab = a product group), then <b>Upload template</b> — you'll get a line-by-line report of everything added, updated, or failed and exactly why.
            </Help>
            <div className="filterrow">
              <h2 style={{ margin: 0, flex: 1 }}>Blend pages</h2>
              <button className="mini" onClick={downloadTemplate}>Download Excel template</button>
              <label className="mini filelabel">Upload template<input type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={(e) => { handleImportFile(e.target.files[0]); e.target.value = ""; }} /></label>
              <button className="addbtn" onClick={() => openRecipeEditor(null)}>+ Add blend</button>
            </div>
            <table className="tbl">
              <thead><tr><th>Blend</th><th className="num">Cost/pack</th><th className="num">Margin</th><th className="num">Sold/60d</th><th>Cover</th><th className="num">Buildable</th><th></th></tr></thead>
              <tbody>{recipeCalc.map((r) => (
                <tr key={r.name} className="rowlink" onClick={() => setOpenRecipe(r.name)}>
                  <td><b>{r.name}</b><div className="mut small">{r.sku} · {r.packSizeG}g{r.group ? ` · ${r.group}` : ""}</div></td>
                  <td className="num">{gbp(r.unitCost)}</td>
                  <td className="num">{gbp(r.margin)} <span className="mut">({Math.round(r.margin / r.sellAt * 100)}% @ {gbp(r.sellAt)})</span></td>
                  <td className="num">{r.salesInWindow}</td>
                  <td>{coverBadge(r.daysCover)}</td>
                  <td className="num">{dot(r.startable ? (r.buildable >= 2 ? "green" : "amber") : "red")} {r.buildable}</td>
                  <td className="chev">›</td>
                </tr>))}
              </tbody>
            </table>
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
          return { ...l, needN, canMakeN: canMake, statusN: status, shortN: Math.max(0, needN - l.stockG) };
        });
        const startableN = scaled.every((l) => l.statusN !== "red");
        const limitingN = scaled.reduce((worst, l) => (l.stockG / l.needN < (worst ? worst.stockG / worst.needN : Infinity) ? l : worst), null);
        return (
          <main>
            <button className="back" onClick={() => setOpenRecipe(null)}>‹ All blends</button>
            <section className="card">
              <div className="rhead">
                <div>
                  <h2>{r.name} <span className="mut">{r.sku}</span></h2>
                  <p className="hint">Ingredients {gbp(r.ingredientCost)} + packaging {gbp(packagingTotal)} = <b>{gbp(r.unitCost)}/pack</b> · selling {r.rate > 0 ? `${(r.rate * 7).toFixed(1)} packs/week` : "no recent sales"}{r.oldestBB && <> · oldest batch BB {fmtD(r.oldestBB)}</>}</p>
                  <div className="salerow" style={{ marginTop: 4 }}>
                    <span className="mut">Batch size</span>
                    <input className="cell" type="number" min="1" step="1" value={brewPacksInput} onChange={(e) => setBrewPacksInput(e.target.value)} />
                    <span className="mut">packs = {g(r.packSizeG * packs)} of blend</span>
                    {[10, 20, 30, 50].map((n) => <button key={n} className={`mini ${packs === n ? "due" : ""}`} onClick={() => setBrewPacksInput(n)}>{n}</button>)}
                  </div>
                </div>
                <div className={`bigstatus ${startableN ? (Math.min(...scaled.map((l) => l.canMakeN)) >= 2 ? "green" : "amber") : "red"}`}>
                  {startableN ? `${packs}-pack batch possible` : `Can't make ${packs} packs`}
                  <div className="lim">{limitingN ? (startableN ? `constraint: ${limitingN.ingredient}` : `short on ${limitingN.ingredient}`) : ""}</div>
                </div>
              </div>
              <table className="tbl">
                <thead><tr><th>Ingredient</th><th className="num">Per pack</th><th className="num">This batch ({packs})</th><th className="num">In stock</th><th className="num">Batches</th><th>Status</th></tr></thead>
                <tbody>{scaled.map((l) => (
                  <tr key={l.ingredient} className={l.statusN === "red" ? "bad" : ""}>
                    <td>{l.ingredient}</td>
                    <td className="num">{g(l.perPackG)}</td>
                    <td className="num"><b>{g(l.needN)}</b></td>
                    <td className="num">{g(l.stockG)}</td>
                    <td className="num">{isFinite(l.canMakeN) ? l.canMakeN : "∞"}</td>
                    <td>{dot(l.statusN)} {l.statusN === "red" ? `short ${g(l.shortN)}` : l.statusN === "amber" ? "this batch only" : "ok"}</td>
                  </tr>))}
                </tbody>
              </table>
              <div className="actions">
                <button className="primary" disabled={!startableN} onClick={() => setConfirmBatch({ r, packs })}>
                  {startableN ? `Brew ${packs} packs — uses ingredients` : "Not enough stock — top up or brew fewer"}
                </button>
                <button onClick={() => setPickList({ r, packs })}>Weigh-out list</button>
                <button className="mini" onClick={() => { setOpenRecipe(null); openRecipeEditor(recipes.find((x) => x.name === r.name)); }}>Edit recipe</button>
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
              <div className="setrow"><label>Order volume — pack size (g)</label>
                <input className="cell" type="number" min="0" value={editIng.packSizeG} onChange={(e) => setEditIng({ ...editIng, packSizeG: e.target.value })} /></div>
              <div className="setrow"><label>Cost price per pack (£)</label>
                <input className="cell" type="number" min="0" step="0.01" value={editIng.packPrice} onChange={(e) => setEditIng({ ...editIng, packPrice: e.target.value })} /></div>
              <div className="setrow"><label>Manual par level (g, optional — raises the reorder line)</label>
                <input className="cell" type="number" min="0" value={editIng.parG} onChange={(e) => setEditIng({ ...editIng, parG: e.target.value })} placeholder="auto" /></div>
              <p className="hint">Works out to {(() => { const s = parseFloat(editIng.packSizeG) || 0; const p = parseFloat(editIng.packPrice) || 0; return s > 0 ? `£${(p / s * 100).toFixed(2)}/100g (£${(p / s).toFixed(4)}/g)` : "—"; })()} normal shelf price.{!editIng.isNew && editIng.stockNow > 0 && Math.abs(editIng.carryRate - (parseFloat(editIng.packPrice) || 0) / (parseFloat(editIng.packSizeG) || 1)) > 0.0002 && <> Your current stock actually cost £{(editIng.carryRate * 100).toFixed(2)}/100g on average (top-up buys included) — blend costs use that true figure; shopping lists use the normal shelf price.</>}</p>
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
            <h2>Ingredient stock</h2>
            <Help>
              <b>Daily use:</b> type grams into <b>Stock</b> after counting a shelf (this also marks it counted). <b>+pack</b> books in a normal delivery at the usual price; <b>buy</b> records any other purchase — enter amount and price paid, and the true average cost updates itself. <b>edit</b> changes supplier, pack size, price or your own minimum level. <b>＋ New ingredient</b> needs just four things: name, supplier, pack size in grams, and price per pack — the per-gram rate calculates for you.
            </Help>
            <p className="hint"><b>Role</b> shows how many blends need each ingredient: <b>Core</b> (8+ blends — never run out, a stockout blocks most of the range), <b>Shared</b> (4–7), <b>Solo</b> (1–3). <b>Count</b> tells you how often to check it — busy, valuable ingredients get counted more. Reorder lines are {velocity.total >= MIN_SALES_FOR_DEMAND ? `demand-driven (daily use × ${settings.leadTimeDays}d lead + ${settings.safetyDays}d safety), floored at one batch` : `batch-cover (${settings.reorderBatches} batches of heaviest blend) until ${MIN_SALES_FOR_DEMAND}+ sales are logged`}; a manual par overrides upward.</p>
            <div className="filterrow">
              <input className="search" placeholder="Filter ingredients…" value={ingFilter} onChange={(e) => setIngFilter(e.target.value)} />
              <button className="mini" onClick={downloadTemplate}>Excel template</button>
              <label className="mini filelabel">Upload<input type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={(e) => { handleImportFile(e.target.files[0]); e.target.value = ""; }} /></label>
              <button className="addbtn" onClick={() => openEditor(null)}>＋ New ingredient</button>
            </div>
            <table className="tbl">
              <thead><tr><th>Ingredient</th><th>Role</th><th className="num">Stock (g)</th><th className="num">Reorder at</th><th>Status</th>{mod.counts && <th>Count</th>}<th></th></tr></thead>
              <tbody>{[...ingCalc].sort((a, b) => (a.key || 9) - (b.key || 9) || b.totalDrawG - a.totalDrawG).filter((i) => i.name.toLowerCase().includes(ingFilter.toLowerCase())).map((i) => (
                <tr key={i.name} className={i.status === "red" ? "bad" : ""}>
                  <td><b>{i.name}</b><div className="mut small">{i.supplier} · {i.blends > 0 ? `${i.blends} blend${i.blends === 1 ? "" : "s"} · ${g(i.totalDrawG)}/full cycle` : "not in any recipe yet"}{i.parSet ? " · manual par" : ""}{i.onOrderG > 0 ? <span className="okmsg"> · {g(i.onOrderG)} on order</span> : ""}</div></td>
                  <td>{i.key ? <span className={`kkey k${i.key}`}>{["","Core","Shared","Solo"][i.key]}</span> : <span className="mut">—</span>}</td>
                  <td className="num"><input className="cell" type="number" min="0" step="10" value={i.stockG} onChange={(e) => setStock(i.name, e.target.value)} /></td>
                  <td className="num">{g(i.threshold)}<div className="mut small">{i.parSet ? "your par" : i.demandMode ? "lead + safety days" : `${settings.reorderBatches}× ${i.drivenBy}`}</div></td>
                  <td>{dot(i.status)} {i.status === "red" ? "below 1 batch" : i.status === "amber" ? "reorder soon" : "ok"}</td>
                  {mod.counts && <td>{({ A: "weekly", B: "monthly", C: "quarterly" })[i.abc]}{i.countDue ? <div><button className="mini due" onClick={() => markCounted(i.name)}>overdue — tap when counted</button></div> : <div className="mut small">✓ {i.lastCounted ? fmtD(i.lastCounted) : "not yet"}</div>}</td>}
                  <td className="nowrap">{mod.purchasing && i.onOrderG > 0 ? <button className="mini due" onClick={() => bookInOrder(i.name)}>book in</button> : (i.packSizeG > 0 && <button className="mini" onClick={() => receivePack(i.name)}>+{i.packSizeG}g</button>)} {mod.purchasing && <button className="mini" onClick={() => setBuyForm({ name: i.name, grams: i.packSizeG || 250, price: Math.round(stdOf(i) * (i.packSizeG || 250) * 100) / 100 })}>buy</button>} <button className="mini" onClick={() => openEditor(i)}>edit</button></td>
                </tr>))}
              </tbody>
            </table>
          </section>
        </main>
      )}

      {/* ============ FINISHED PACKS ============ */}
      {tab === "stock" && (
        <main>
          <section className="card">
            <Help>
              This is your shelf. Type a number to correct it after a count; <b>−1/−3</b> records a sale and removes the packs in one tap. Brews add packs automatically. Oldest best-before shows so the earliest-dated stock goes to market first.
            </Help>
            <h2>Finished packs on the shelf</h2>
            <p className="hint">The −1/−3 buttons record a sale (which feeds velocity) as well as reducing the shelf. Batches carry a code and best-before once logged — oldest shown here so the earliest-dated stock goes out first.</p>
            <table className="tbl">
              <thead><tr><th>Blend</th><th className="num">Packs</th><th>Cover</th><th>Oldest BB</th><th className="num">Shelf value</th><th>Sell</th></tr></thead>
              <tbody>{recipeCalc.map((r) => {
                const n = finished[r.name] ?? 0;
                return (
                  <tr key={r.name} className={n === 0 ? "bad" : ""}>
                    <td><b>{r.name}</b></td>
                    <td className="num"><input className="cell" type="number" min="0" value={n} onChange={(e) => setPacks(r.name, e.target.value)} /></td>
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
            </table>
          </section>
        </main>
      )}

      {/* ============ SALES ============ */}
      {tab === "sales" && (
        <main>
          <section className="card">
            <Help title="How to use this page & bulk upload format">
              Log sales here (or with −1/−3 on Finished packs) and the system learns how fast each blend sells — that switches reordering to demand-driven and lights up days-of-cover. Backdate with the date field to catch up a month in one sitting. <b>Bulk upload:</b> paste a CSV order export on the Data &amp; settings tab. Format rules: first row must be headers; needs a <b>product column</b> (any of: Lineitem name, Product, Title, Item), ideally a <b>quantity</b> column (Quantity, Qty) and a <b>date</b> column (Created at, Date, Order date). Product cells must contain the blend name, e.g. <code>Ember Imp 80g pouch</code> matches Ember Imp. Anything unmatched is reported, never guessed.
            </Help>
            <p className="hint">Sales in the last {VELOCITY_DAYS} days set each blend's velocity, which drives days-of-cover and demand-based reorder lines. Backdate with the date field for catch-up entry (e.g. a month of Etsy orders).</p>
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
            <table className="tbl">
              <thead><tr><th>Blend</th><th className="num">Sold</th><th className="num">Per week</th><th>Cover on shelf</th></tr></thead>
              <tbody>{[...recipeCalc].sort((a, b) => b.salesInWindow - a.salesInWindow).map((r) => (
                <tr key={r.name}><td><b>{r.name}</b></td><td className="num">{r.salesInWindow}</td><td className="num">{(r.rate * 7).toFixed(1)}</td><td>{coverBadge(r.daysCover)}</td></tr>))}
              </tbody>
            </table>
          </section>
          {shrinkCalc.byChannel.length > 0 && (
            <section className="card">
              <h2>Channel P&amp;L, last {VELOCITY_DAYS} days</h2>
              <p className="hint">Net of each channel's fees (editable in settings) — the honest margin per route to market.</p>
              <table className="tbl">
                <thead><tr><th>Channel</th><th className="num">Units</th><th className="num">Gross</th><th className="num">Fees</th><th className="num">Net</th><th className="num">GP</th><th className="num">GP%</th></tr></thead>
                <tbody>{shrinkCalc.byChannel.map((c) => (
                  <tr key={c.channel}><td><b>{c.channel}</b></td><td className="num">{c.units}</td><td className="num">{gbp(c.gross)}</td><td className="num">{gbp(c.fees)}</td><td className="num">{gbp(c.net)}</td><td className="num">{gbp(c.gp)}</td><td className="num">{c.gross > 0 ? Math.round(c.gp / c.gross * 100) : 0}%</td></tr>))}
                </tbody>
              </table>
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
        const bc = bundleCost(builder.items, builder.packagingCost);
        const price = parseFloat(builder.salePrice) || 0;
        const chan = builder.channel || "Direct";
        const fee = feeFor(chan, price);
        const gp = price - fee - bc.total;
        const gpPct = price > 0 ? gp / price * 100 : 0;
        const gpClass = gpPct >= 60 ? "green" : gpPct >= 40 ? "amber" : "red";
        const singlesPrice = builder.items.length * settings.sellPrice;
        return (
          <main>
            <section className="card">
              <Help>
                Pick blends into slots (swap freely), set bundle packaging cost, then drag the price slider — profit recalculates live, including the selling channel's fees. Green means healthy margin. Save bundles by name; their costs stay live as ingredient prices change.
              </Help>
              <h2>Build your bundle</h2>
              <p className="hint">Swap any slot with its dropdown, add or remove slots freely. Bundle packaging defaults to the gift-box setup (belly band £1.15 + printed box £1.07 = £2.22) — zero the band out for bundles that don't carry one. The slider prices against the live rolled-up cost.</p>
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
              <div className="gpbar"><div className="gpfill" style={{ width: `${Math.max(0, Math.min(100, gpPct))}%` }} /><div className="gpcost" style={{ width: `${price > 0 ? Math.min(100, bc.total / price * 100) : 100}%` }} /></div>
              <p className="hint" style={{ marginTop: 10 }}>
                Cost stack: ingredients {gbp(bc.ingredientCost)} + pack packaging {gbp(bc.packPackaging)} ({builder.items.length} × {gbp(packagingTotal)}) + bundle packaging {gbp(parseFloat(builder.packagingCost) || 0)} = <b>{gbp(bc.total)}</b>{fee > 0 && <>, plus {chan} fees {gbp(fee)} at this price</>}.
                {builder.items.length > 1 && <> Bought as singles this would be {gbp(singlesPrice)} — at {gbp(price)} the customer saves {gbp(Math.max(0, singlesPrice - price))} ({singlesPrice > 0 ? Math.round(Math.max(0, singlesPrice - price) / singlesPrice * 100) : 0}%).</>}
              </p>
              <table className="tbl">
                <thead><tr><th>Slot</th><th className="num">Ingredients</th><th className="num">Full cost/pack</th></tr></thead>
                <tbody>{bc.rows.map((r, i) => (
                  <tr key={i}><td>{r.name}</td><td className="num">{gbp(r.ingredientCost)}</td><td className="num">{gbp(r.unitCost)}</td></tr>))}
                </tbody>
              </table>
            </section>

            {bundles.length > 0 && (
              <section className="card">
                <h2>Saved bundles</h2>
                <table className="tbl">
                  <thead><tr><th>Bundle</th><th>Contents</th><th className="num">Cost</th><th className="num">Price</th><th className="num">GP</th><th></th></tr></thead>
                  <tbody>{bundles.map((b) => {
                    const c = bundleCost(b.items, b.packagingCost);
                    const bgp = b.salePrice - c.total;
                    return (
                      <tr key={b.id}>
                        <td><b>{b.name}</b></td>
                        <td className="mut small">{b.items.join(" + ")}</td>
                        <td className="num">{gbp(c.total)}</td>
                        <td className="num">{gbp(b.salePrice)}</td>
                        <td className="num">{gbp(bgp)} <span className="mut">({b.salePrice > 0 ? Math.round(bgp / b.salePrice * 100) : 0}%)</span></td>
                        <td><button className="mini" onClick={() => loadBundle(b)}>edit</button> <button className="mini ghost" onClick={() => deleteBundle(b.id)}>delete</button></td>
                      </tr>);
                  })}
                  </tbody>
                </table>
                <p className="hint">Costs and GP recalculate live — a price refresh on the ingredients ripples straight through every saved bundle.</p>
              </section>
            )}
          </main>
        );
      })()}

      {/* ============ EVENTS ============ */}
      {tab === "events" && !openEvent && (
        <main>
          <section className="card">
            <Help>
              Create an event, type how many packs of each blend you want on the table, and it works backwards: batches to brew beyond what's shelved, every gram of ingredient required, and a ready-to-send order list for anything you're short of.
            </Help>
            <h2>Event planner</h2>
            <p className="hint">Set a target pack count per blend for an event and the planner explodes it through the recipes: batches to brew beyond what's shelved, ingredients required, and exactly what to order.</p>
            <div className="salerow">
              <input className="cell wide" placeholder="Event name, e.g. GBFF 2026" value={evForm.name} onChange={(e) => setEvForm({ ...evForm, name: e.target.value })} />
              <input className="cell" type="date" value={evForm.date} onChange={(e) => setEvForm({ ...evForm, date: e.target.value })} />
              <button className="mini" onClick={addEvent}>Create</button>
            </div>
            {events.length === 0 ? <p className="empty">No events planned yet.</p> : (
              <table className="tbl">
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
              </table>
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
              <h2>{ev.name} {ev.date && <span className="mut">· {fmtD(ev.date)}</span>}</h2>
              <p className="hint">Enter how many packs of each blend you want to take. Brew plan rounds up to whole {settings.defaultBatchPacks}-pack batches; spare packs go back on the shelf.</p>
              <table className="tbl">
                <thead><tr><th>Blend</th><th className="num">Take to event</th><th className="num">On shelf</th><th className="num">Brew</th></tr></thead>
                <tbody>{recipeCalc.map((r) => {
                  const item = plan.items.find((x) => x.r.name === r.name);
                  return (
                    <tr key={r.name}>
                      <td><b>{r.name}</b></td>
                      <td className="num"><input className="cell" type="number" min="0" value={ev.targets[r.name] ?? 0} onChange={(e) => setTarget(ev.id, r.name, e.target.value)} /></td>
                      <td className="num">{finished[r.name] ?? 0}</td>
                      <td className="num">{item ? (item.batches > 0 ? `${item.batches} batch${item.batches === 1 ? "" : "es"} (+${item.brewPacks - item.toBrew} spare)` : "covered") : "—"}</td>
                    </tr>);
                })}
                </tbody>
              </table>
            </section>
            {plan.totBatches > 0 && (
              <section className="card">
                <h2>Brew plan: {plan.totBatches} batches</h2>
                {plan.buy.length === 0 ? <p className="empty">Current ingredient stock covers the whole brew plan.</p> : (
                  <>
                    <p className="hint">Ingredient shortfall for the full plan — order this before brew day. Estimated spend {gbp(plan.buyCost)}.</p>
                    <table className="tbl">
                      <thead><tr><th>Ingredient</th><th className="num">Needed</th><th className="num">In stock</th><th className="num">Order</th><th className="num">Est. cost</th></tr></thead>
                      <tbody>{plan.buy.map((b) => (
                        <tr key={b.name}><td><b>{b.name}</b><div className="mut small">{b.supplier}</div></td>
                          <td className="num">{g(b.grams)}</td><td className="num">{g(b.stockG)}</td>
                          <td className="num">{b.packs > 0 ? `${b.packs} × ${g(b.packSizeG)}` : g(b.short)}</td>
                          <td className="num">{gbp(b.cost)}</td></tr>))}
                      </tbody>
                    </table>
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
            <Help>
              Anything lost, spoiled, damaged or given away gets logged here — pick the item, amount and reason, and stock adjusts in the same tap. The dashboards then show what leakage is really costing: as cash, as a share of your stock, and as the dent in profit. Gifts count on purpose — knowing what you give away is the point.
            </Help>
            <h2>Record shrink or a gift</h2>
            <p className="hint">Logs a loss and deducts the stock in one move. Gifted packs are shrink too — deliberate shrink, but the GP impact is the same, and knowing how much you're giving away is the point.</p>
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
            <section className="card warn"><h2>No sales in the window</h2>
              <p className="hint">Shrink % of sales and GP impact need sales logged in the last {VELOCITY_DAYS} days — record some on the Sales tab and these figures light up.</p></section>
          )}

          {shrinkCalc.win.length > 0 && (
            <section className="card">
              <h2>Where it's going, last {VELOCITY_DAYS} days</h2>
              <div className="twocol">
                <div>
                  <h3>By reason</h3>
                  <table className="tbl"><tbody>{shrinkCalc.byReason.map(([r, v]) => (
                    <tr key={r}><td>{r}</td><td className="num">{gbp(v)}</td><td className="num mut">{shrinkCalc.winValue > 0 ? Math.round(v / shrinkCalc.winValue * 100) + "%" : ""}</td></tr>))}
                  </tbody></table>
                </div>
                <div>
                  <h3>By item</h3>
                  <table className="tbl"><tbody>{shrinkCalc.byItem.slice(0, 8).map((x) => (
                    <tr key={x.name}><td>{x.name}<div className="mut small">{x.kind === "pack" ? `${x.qty} packs` : g(x.qty)}</div></td><td className="num">{gbp(x.value)}</td></tr>))}
                  </tbody></table>
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
          {shrink.length === 0 && <section className="card"><p className="empty">Nothing lost or gifted yet — long may it continue.</p></section>}
        </main>
      )}

      {/* ============ SHOPPING ============ */}
      {tab === "shopping" && (
        <main>
          {onOrderItems.length > 0 && (
            <section className="card">
              <h2>On order</h2>
              <p className="hint">These count toward reorder lines (so the list below stays quiet) but not toward brewing until booked in.</p>
              <table className="tbl">
                <thead><tr><th>Ingredient</th><th className="num">Inbound</th><th>Ordered</th><th></th></tr></thead>
                <tbody>{onOrderItems.map((i) => {
                  const days = i.orderedAt ? Math.floor(daysAgo(i.orderedAt)) : 0;
                  return (
                    <tr key={i.name}>
                      <td><b>{i.name}</b><div className="mut small">{i.supplier}</div></td>
                      <td className="num">{g(i.onOrderG)}</td>
                      <td className={days > 7 ? "errmsg" : "mut"}>{days === 0 ? "today" : `${days}d ago`}{days > 7 ? " — overdue?" : ""}</td>
                      <td className="nowrap"><button className="mini" onClick={() => bookInOrder(i.name)}>Book in delivery</button> <button className="mini ghost" onClick={() => cancelOrder(i.name)}>cancel</button></td>
                    </tr>);
                })}
                </tbody>
              </table>
            </section>
          )}

          {baskets.length === 0 && <section className="card"><Help>
              This page writes your order for you. Items appear when stock falls below its reorder line, grouped by supplier, with the exact packs to buy. The bar shows progress to free delivery — top-up suggestions are items you'll need soon anyway, added so you never pay postage on a small order. <b>Mark basket as ordered</b> silences the alerts while stock is in transit; <b>book in delivery</b> when it arrives.
            </Help><h2>Shopping list</h2><p className="empty">Nothing to order — the stockroom is fully provisioned.</p></section>}

          {baskets.map((b) => {
            const all = [...b.need, ...b.pull, ...b.topup];
            const line = (i) => i.packsToOrder * i.packSizeG * stdOf(i);
            return (
              <section className="card" key={b.supplier}>
                <h2>{b.supplier} basket · {gbp(b.subtotal)}</h2>
                {b.isMain && (
                  <>
                    <div className="gpbar" style={{ marginBottom: 6 }}><div className="gpfill" style={{ width: `${Math.min(100, b.subtotal / settings.freeShipThreshold * 100)}%` }} /></div>
                    <p className="hint">{b.subtotal >= settings.freeShipThreshold
                      ? `Over the ${gbp(settings.freeShipThreshold)} free-delivery line — ${gbp(settings.shippingCost)} of shipping saved, straight to GP.`
                      : `${gbp(b.gapToFree)} short of free delivery (${gbp(settings.freeShipThreshold)}) — a sub-threshold order costs ${gbp(settings.shippingCost)} in shipping.`}</p>
                  </>
                )}
                <table className="tbl">
                  <thead><tr><th>Ingredient</th><th>Role</th><th>Why</th><th className="num">Order</th><th className="num">Cost</th></tr></thead>
                  <tbody>
                    {b.need.map((i) => (
                      <tr key={i.name}><td><b>{i.name}</b></td><td>{i.key ? <span className={`kkey k${i.key}`}>{["","Core","Shared","Solo"][i.key]}</span> : ""}</td><td className="mut">needed — short {g(i.deficit)}</td><td className="num">{i.packsToOrder} × {g(i.packSizeG)}</td><td className="num">{gbp(line(i))}</td></tr>))}
                    {b.pull.map((i) => (
                      <tr key={i.name}><td><b>{i.name}</b></td><td>{i.key ? <span className={`kkey k${i.key}`}>{["","Core","Shared","Solo"][i.key]}</span> : ""}</td><td className="mut">will run low before a new order lands — add now, save a delivery fee</td><td className="num">{i.packsToOrder} × {g(i.packSizeG)}</td><td className="num">{gbp(line(i))}</td></tr>))}
                    {b.topup.map((i) => (
                      <tr key={i.name}><td><b>{i.name}</b></td><td>{i.key ? <span className={`kkey k${i.key}`}>{["","Core","Shared","Solo"][i.key]}</span> : ""}</td><td className="mut">top-up to free shipping — {i.daysCover !== null ? `${Math.floor(i.daysCover)}d cover` : "core item"}</td><td className="num">{i.packsToOrder} × {g(i.packSizeG)}</td><td className="num">{gbp(line(i))}</td></tr>))}
                  </tbody>
                </table>
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
          <section className="card">
            <Help title="Bulk upload formats (all of them)">
              <b>1 · Sales CSV</b> — header row required; product column (Lineitem name / Product / Title / Item), quantity (Quantity / Qty), date (Created at / Date). Product cells must contain the blend name. Example:<br /><code>Name,Lineitem name,Lineitem quantity,Created at</code><br /><code>#1001,Ember Imp 80g,2,2026-06-14</code><br />
              <b>2 · Price refresh JSON</b> — an array of objects: <code>{'{'}"name":"Cumin","costPerG":0.0155,"packSizeG":500{'}'}</code>. Names must match ingredients exactly (case doesn't matter). Prices are £ per gram.<br />
              <b>3 · Full state (sos.stockroom.v1)</b> — only ever paste what the export button produced; it replaces everything, so export a backup first.
            </Help>
            <h2>Sales import (Shopify / Etsy / Square CSV)</h2>
            <p className="hint">Paste an order export CSV — any file with a header row containing a product column (plus quantity and date if available). Product names are matched to blends automatically; imported sales feed velocity but don't touch shelf counts, since those packs already left the building.</p>
            <div className="salerow">
              <span className="mut">Channel</span>
              <select className="cell" value={csvChannel} onChange={(e) => setCsvChannel(e.target.value)}>
                {["Shopify", "Etsy", "Event", "Wholesale", "Other"].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="actions" style={{ marginTop: 0 }}>
              <label className="filelabel actionsbtn">Upload sales file (CSV / Excel)<input type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={(e) => { handleSalesFile(e.target.files[0]); e.target.value = ""; }} /></label>
              <span className="mut">— straight from Shopify / Etsy / Square, no reformatting — or paste CSV below:</span>
            </div>
            <textarea className="paste" rows={5} placeholder={"Name,Lineitem name,Lineitem quantity,Created at\n#1001,Ember Imp 80g,2,2026-06-14"} value={csvText} onChange={(e) => setCsvText(e.target.value)} />
            <div className="actions">
              <button className="primary" onClick={importCSVSales} disabled={!csvText.trim()}>Import pasted CSV</button>
              {csvMsg && <span className={csvMsg.ok ? "okmsg" : "errmsg"}>{csvMsg.text}</span>}
            </div>
          </section>

          <section className="card">
            <h2>Open data schema (sos.stockroom.v1)</h2>
            <p className="hint">The whole system speaks one versioned JSON document: settings, ingredients (with stock and prices), recipes as bills of materials, finished packs, batch log with lot codes, sales, events, shrink, and bundles. Export it for backup, spreadsheet analysis, or to feed any other system; import a modified document to load state back in. This schema is the contract a future hosted REST API would serve — the artifact can't listen for HTTP calls itself, but anything that can read or write this JSON integrates today.</p>
            <div className="actions">
              <button onClick={() => copyText(exportState())}>Copy full export</button>
              <button onClick={() => setStateIO(exportState())}>Preview in box below</button>
            </div>
            <textarea className="paste" rows={6} placeholder="Paste a sos.stockroom.v1 export here to restore or migrate state…" value={stateIO} onChange={(e) => setStateIO(e.target.value)} />
            <div className="actions">
              <button className="primary" onClick={importState} disabled={!stateIO.trim()}>Import state (replaces everything)</button>
              {ioMsg && <span className={ioMsg.ok ? "okmsg" : "errmsg"}>{ioMsg.text}</span>}
            </div>
          </section>

          <section className="card">
            <h2>Price refresh (wholesaler)</h2>
            <p className="hint">Copy the request below into a Claude chat; paste the returned JSON here and apply. Last synced: {settings.priceLastSynced ? fmtD(settings.priceLastSynced) : "never"}.</p>
            <div className="actions">
              <button onClick={() => copyText("Please fetch current prices from wholesale-spices.example for these ingredients and return the same JSON array with updated costPerG (GBP per gram) and packSizeG:\n\n" + exportForRefresh())}>Copy refresh request</button>
            </div>
            <textarea className="paste" rows={5} placeholder='Paste updated JSON here, e.g. [{"name":"Kosher Salt","costPerG":0.0026,"packSizeG":500}]' value={importText} onChange={(e) => setImportText(e.target.value)} />
            <div className="actions">
              <button className="primary" onClick={importPrices} disabled={!importText.trim()}>Apply prices</button>
              {importMsg && <span className={importMsg.ok ? "okmsg" : "errmsg"}>{importMsg.text}</span>}
            </div>
          </section>

          <section className="card">
            <h2>Modules — who owns each job</h2>
            <p className="hint">Turn a module off when another platform becomes the system of record for that data (e.g. your e-commerce stack owns sales, or a procurement tool owns ordering). The tab disappears, related prompts go quiet, and the rest of the system adapts — nothing is deleted, so switching back restores everything. Core stockroom, blends and brewing can't be turned off; they're the platform.</p>
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
                <label>{label}<div className="mut small">{why}</div></label>
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
            <h3>Channel fees (% of price + fixed £ per pack)</h3>
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
            <p className="hint">Etsy figures are calibrated from a real order statement (Jan 2026): 6.5% transaction + 4% + 20p processing + 0.48% regulatory + listing renewal, all with 20% VAT on fees, plus fees charged on postage.</p>
            <h3>Packaging per pack ({gbp(packagingTotal)} total)</h3>
            {Object.entries(settings.packaging).map(([k, v]) => (
              <div className="setrow" key={k}><label>{k} (£)</label>
                <input className="cell" type="number" min="0" step="0.01" value={v} onChange={(e) => updateSetting({ packaging: { ...settings.packaging, [k]: parseFloat(e.target.value) || 0 } })} /></div>))}
            <p className="hint">Lemon Zest is priced at £0 (fresh) and never blocks a batch — keep an eye on lemons the old-fashioned way.</p>
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
            <p className="hint">Failed rows were skipped, not guessed — fix them in the spreadsheet and upload again; matching names update rather than duplicate.</p>
            <div className="actions">
              <button className="primary" onClick={() => setIngest(null)}>Done</button>
              <button onClick={downloadIngestReport}>Download report (Excel)</button>
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
              <p>{gAmt > 0 && paid > 0 ? <>That's <b>£{(rate * 100).toFixed(2)}/100g</b> vs the normal shelf price £{(std * 100).toFixed(2)}/100g{prem > 2 ? <span className="errmsg"> — a top-up buy, {prem.toFixed(0)}% over the odds (£{((rate - std) * gAmt).toFixed(2)} premium)</span> : prem < -2 ? <span className="okmsg"> — {Math.abs(prem).toFixed(0)}% better than standard, nice find</span> : " — bang on standard"}. Your stock\u2019s true average cost becomes £{(wac * 100).toFixed(2)}/100g after this.</> : "Enter amount and price to see the rate."}</p>
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

      <footer className="ftr">Demo data — every blend and ratio is fictional. Default batch: {settings.defaultBatchPacks} packs (adjustable per brew) · reorder lines switch to demand-driven once {MIN_SALES_FOR_DEMAND}+ sales are logged</footer>
    </div>
  );
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
      .tbl td{padding:8px;border-bottom:1px solid rgba(69,55,87,.5);vertical-align:middle}
      .tbl .num{text-align:right;font-variant-numeric:tabular-nums;font-family:ui-monospace,'SF Mono',Consolas,monospace;font-size:13px}
      th.num{font-family:inherit}
      .tbl tr.bad td{background:rgba(199,81,70,.08)}
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
      .nowrap{white-space:nowrap}
      .cell{width:88px;background:var(--ink);border:1px solid var(--line);color:var(--parch);border-radius:6px;padding:5px 7px;
        font-family:ui-monospace,monospace;font-size:13px;text-align:right}
      .cell.wide{width:180px;text-align:left;font-family:inherit}
      .cell:focus{outline:none;border-color:var(--ember)}
      select.cell{text-align:left;font-family:inherit;width:auto;min-width:96px}
      input[type=date].cell{width:140px;text-align:left}
      .search{flex:1;background:var(--ink);border:1px solid var(--line);color:var(--parch);border-radius:8px;
        padding:8px 12px;font:inherit;font-size:14px}
      .filterrow{display:flex;gap:10px;margin-bottom:10px;align-items:center}
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
      @media (max-width:640px){ .tbl{font-size:12.5px} .tbl td,.tbl th{padding:6px 5px} .cell{width:70px} .rhead{flex-direction:column} }
    `}</style>
  );
}
