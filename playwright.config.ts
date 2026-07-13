import { defineConfig } from "@playwright/test"

import { configuredApplicationWindowMode } from "./tests/app/application-window-mode"

const windowMode = configuredApplicationWindowMode()

export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  grepInvert: windowMode === "background" ? /@native-window/ : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  retries: 0,
  testDir: "tests/app",
  timeout: 30_000,
  workers: 1,
  use: {
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
})
