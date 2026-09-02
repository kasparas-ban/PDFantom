import { defineConfig } from "@playwright/test"

export default defineConfig({
  outputDir: "test-results/performance",
  reporter: "list",
  testDir: "tests/performance",
  timeout: 120_000,
  workers: 1,
  use: {
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
})
