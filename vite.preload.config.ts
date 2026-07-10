import { defineConfig } from "vite-plus"

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: "src/preload/index.ts",
      formats: ["cjs"],
      fileName: () => "preload.js",
    },
    outDir: ".vite/build",
    rollupOptions: {
      external: ["electron"],
    },
  },
})
