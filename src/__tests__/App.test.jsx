import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// Mocked storage: every test controls exactly what the app reads on load.
const store = { get: vi.fn(), set: vi.fn(), delete: vi.fn(), list: vi.fn() };
vi.mock("../storage.js", () => ({ appStorage: store }));

const { default: App } = await import("../App.jsx");
const STORE_KEY = "sos_stockroom_demo_v1";

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  store.set.mockResolvedValue({ key: STORE_KEY, value: "" });
});

describe("App load", () => {
  // exception paths first
  it("still opens when stored state is corrupt JSON", async () => {
    store.get.mockResolvedValue({ key: STORE_KEY, value: "{not json" });
    render(<App />);
    expect(await screen.findByText("The Stockroom Grimoire")).toBeTruthy();
    expect(screen.getByText("Ember Imp")).toBeTruthy(); // seed data used instead
  });

  it("still opens when storage itself rejects", async () => {
    store.get.mockRejectedValue(new Error("storage unavailable"));
    render(<App />);
    expect(await screen.findByText("The Stockroom Grimoire")).toBeTruthy();
  });

  // happy paths
  it("seeds the demo blends on first run", async () => {
    store.get.mockResolvedValue(null);
    render(<App />);
    await screen.findByText("The Stockroom Grimoire");
    for (const name of ["Ember Imp", "Arcane Ancho", "Wyrmwood Wanderer"]) {
      expect(screen.getByText(name)).toBeTruthy();
    }
    expect(store.get).toHaveBeenCalledWith(STORE_KEY);
  });

  it("restores saved finished-pack counts over the seed", async () => {
    store.get.mockResolvedValue({ key: STORE_KEY, value: JSON.stringify({ finished: { "Ember Imp": 42 } }) });
    render(<App />);
    await screen.findByText("The Stockroom Grimoire");
    expect(screen.getByText(/42 packs/)).toBeTruthy();
  });
});
