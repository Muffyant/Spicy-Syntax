import { describe, it, expect, beforeEach } from "vitest";
import { appStorage } from "../storage.js";

// jsdom has no window.storage, so the adapter must fall back to localStorage.
describe("storage adapter (localStorage fallback)", () => {
  beforeEach(() => localStorage.clear());

  // exception paths first
  it("returns null for a key that was never set", async () => {
    expect(await appStorage.get("missing")).toBeNull();
  });

  it("deleting a key that does not exist still resolves", async () => {
    await expect(appStorage.delete("missing")).resolves.toEqual({ key: "missing", deleted: true });
  });

  // happy paths
  it("round-trips a value through set and get", async () => {
    await appStorage.set("k", "v");
    expect(await appStorage.get("k")).toEqual({ key: "k", value: "v" });
  });

  it("lists only keys matching the prefix and delete removes them", async () => {
    await appStorage.set("sos_a", "1");
    await appStorage.set("sos_b", "2");
    await appStorage.set("other", "3");
    expect((await appStorage.list("sos_")).keys.sort()).toEqual(["sos_a", "sos_b"]);
    await appStorage.delete("sos_a");
    expect(await appStorage.get("sos_a")).toBeNull();
  });
});
