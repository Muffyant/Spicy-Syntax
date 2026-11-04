import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";

// Mocked storage: every test controls exactly what the app reads on load.
const store = { get: vi.fn(), set: vi.fn(), delete: vi.fn(), list: vi.fn() };
vi.mock("../storage.js", () => ({ appStorage: store }));
globalThis.__SOS_TEST__ = true; // storage retries wait 1 ms instead of 400 ms
window.scrollTo = () => {}; // jsdom doesn't implement it

const { default: App } = await import("../App.jsx");
const STORE_KEY = "sos_stockroom_demo_v1";

// A stored record, as storage would hand it back.
const stored = (record) => {
  store.get.mockImplementation(async (key) => (key === STORE_KEY ? { key, value: JSON.stringify(record) } : null));
  store.list.mockResolvedValue({ keys: [STORE_KEY] });
};
const recordWrites = () => store.set.mock.calls.filter(([key]) => key === STORE_KEY);
const openTab = async (name) => {
  const nav = await screen.findByRole("navigation");
  fireEvent.click(within(nav).getByRole("button", { name: new RegExp(`^${name}`) }));
};

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  store.set.mockImplementation(async (key, value) => ({ key, value }));
  store.delete.mockImplementation(async (key) => ({ key, deleted: true }));
  store.list.mockResolvedValue({ keys: [] });
});

describe("App load", () => {
  // exception paths first
  it("shows the recovery screen, and never overwrites a record it can't read", async () => {
    store.get.mockResolvedValue({ key: STORE_KEY, value: "{not json" });
    store.list.mockResolvedValue({ keys: [STORE_KEY] });
    render(<App />);
    expect(await screen.findByText("Your stockroom record couldn't be read")).toBeTruthy();
    expect(recordWrites()).toHaveLength(0);
  });

  it("offers a retry, and writes nothing, when storage doesn't answer", async () => {
    store.get.mockRejectedValue(new Error("storage unavailable"));
    store.list.mockRejectedValue(new Error("storage unavailable"));
    render(<App />);
    expect(await screen.findByText("Couldn't open your stockroom data")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(store.set).not.toHaveBeenCalled();
  });

  // happy paths
  it("seeds the demo blends on first run", async () => {
    store.get.mockResolvedValue(null);
    render(<App />);
    expect(await screen.findByText("The Stockroom Grimoire")).toBeTruthy();
    for (const name of ["Ember Imp", "Arcane Ancho", "Wyrmwood Wanderer"]) {
      expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    }
    expect(store.get).toHaveBeenCalledWith(STORE_KEY);
  });

  it("restores saved finished-pack counts over the seed", async () => {
    stored({ finished: { "Ember Imp": 42 } });
    render(<App />);
    expect(await screen.findByText(/42 packs/)).toBeTruthy();
  });

  it("takes an upgrade restore point before saving over an older record", async () => {
    stored({ finished: { "Ember Imp": 42 } }); // no dataSchema, so it predates this version
    render(<App />);
    await screen.findByText(/42 packs/);
    await waitFor(() => expect(store.set.mock.calls.some(([key]) => /_rp_\d+_upgrade$/.test(key))).toBe(true));
    expect(recordWrites()).toHaveLength(0);
  });
});

describe("Stock counts", () => {
  // exception paths first
  it("doesn't save while you're still typing a count", async () => {
    store.get.mockResolvedValue(null);
    render(<App />);
    await openTab("Ingredients");
    const box = (await screen.findAllByRole("spinbutton"))[0];
    fireEvent.change(box, { target: { value: "1250" } });
    expect(recordWrites()).toHaveLength(0);
  });

  // happy paths
  it("saves the count once, when you leave the box", async () => {
    store.get.mockResolvedValue(null);
    render(<App />);
    await openTab("Ingredients");
    const box = (await screen.findAllByRole("spinbutton"))[0];
    const name = box.closest("tr").querySelector("td b").textContent;
    fireEvent.change(box, { target: { value: "1250" } });
    fireEvent.blur(box);
    await waitFor(() => expect(recordWrites()).toHaveLength(1));
    const saved = JSON.parse(recordWrites()[0][1]);
    expect(saved.ings.find((i) => i.name === name).stockG).toBe(1250);
  });
});

describe("Tabs", () => {
  it("opens every tab without an error", async () => {
    store.get.mockResolvedValue(null);
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<App />);
    const nav = await screen.findByRole("navigation");
    const count = within(nav).getAllByRole("button").length;
    expect(count).toBeGreaterThan(10);
    for (let i = 0; i < count; i += 1) {
      fireEvent.click(within(screen.getByRole("navigation")).getAllByRole("button")[i]);
    }
    expect(screen.getByRole("navigation")).toBeTruthy();
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it("draws a flavour profile for every demo blend", async () => {
    store.get.mockResolvedValue(null);
    const { container } = render(<App />);
    await openTab("Flavour");
    expect(await screen.findByText(/hottest, about/)).toBeTruthy();
    expect(container.querySelectorAll(".fl-card")).toHaveLength(6);
  });

  it("keeps the how-to topics on the Guide tab", async () => {
    store.get.mockResolvedValue(null);
    render(<App />);
    await openTab("Guide");
    for (const topic of ["Daily routine", "Recipes and bulk upload", "Flavour profiles"]) {
      expect(await screen.findByText(topic)).toBeTruthy();
    }
  });
});
