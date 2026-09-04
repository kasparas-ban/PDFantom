import path from "node:path"

import { defineConfig } from "vite-plus"

export default defineConfig({
  base: "./",
  resolve: { alias: { "@": path.resolve("src/renderer/src") } },
  build: {
    rollupOptions: {
      input: {
        "reader-boundary": path.resolve("tests/renderer/reader-boundary.ts"),
        "routing-boundary": path.resolve("tests/renderer/routing-boundary.ts"),
      },
      preserveEntrySignatures: "strict",
      output: { entryFileNames: "[name].mjs" },
    },
    outDir: ".vite/reader-tests",
    emptyOutDir: true,
  },
})
