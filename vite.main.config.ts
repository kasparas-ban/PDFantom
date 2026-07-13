import { defineConfig } from "vite-plus"

export default defineConfig({
  build: {
    emptyOutDir: true,
    lib: {
      entry: "src/main/index.ts",
      formats: ["cjs"],
      fileName: () => "main.js",
    },
    outDir: ".vite/build",
    rollupOptions: {
      external: [
        "electron",
        "node:crypto",
        "node:fs",
        "node:path",
        "node:url",
      ],
    },
  },
})
