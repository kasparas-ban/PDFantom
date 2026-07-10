import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [react()],
  root: "src/renderer",
  build: {
    emptyOutDir: true,
    outDir: "../../.vite/renderer/main_window",
  },
});
