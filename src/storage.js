// Storage adapter: uses Claude's window.storage when present (artifact),
// falls back to localStorage everywhere else (Vite, Lovable, any browser).
const hasClaude = typeof window !== "undefined" && window.storage && typeof window.storage.get === "function";

export const appStorage = hasClaude ? window.storage : {
  async get(key) {
    const v = localStorage.getItem(key);
    return v === null ? null : { key, value: v };
  },
  async set(key, value) {
    localStorage.setItem(key, value);
    return { key, value };
  },
  async delete(key) { localStorage.removeItem(key); return { key, deleted: true }; },
  async list(prefix = "") {
    return { keys: Object.keys(localStorage).filter((k) => k.startsWith(prefix)) };
  },
};
