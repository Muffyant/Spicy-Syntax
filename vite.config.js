import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// BASE_PATH is set by the Pages deploy workflow ("/Spicy-Syntax/"); local dev stays at "/".
export default defineConfig({
  base: process.env.BASE_PATH || "/",
  plugins: [react()],
  test: { environment: "jsdom" },
});
