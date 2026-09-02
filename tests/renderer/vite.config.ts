import path from "node:path"

import { defineConfig } from "vite-plus"

export default defineConfig({
  base: "./",
  build: {
    rollupOptions: {
      input: path.resolve("tests/renderer/reader-boundary.ts"),
      preserveEntrySignatures: "strict",
      output: { entryFileNames: "reader-boundary.mjs" },
    },
    outDir: ".vite/reader-tests",
    emptyOutDir: true,
  },
})
