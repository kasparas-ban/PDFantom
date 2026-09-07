import { defineConfig } from "vite-plus"

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: "src/main/index.ts",
      formats: ["cjs"],
      fileName: () => "main.js",
    },
    outDir: ".vite/build",
    rollupOptions: {
      external: [
        "electron",
        "node:child_process",
        "node:crypto",
        "node:fs",
        "node:fs/promises",
        "node:os",
        "node:path",
        "node:readline",
        "node:url",
      ],
    },
  },
})
