import { expect, test as base } from "@playwright/test"

import { configuredApplicationWindowMode } from "./application-window-mode"
import { launchTestApplication } from "./launch-application"

type TestFixtures = {
  application: Awaited<ReturnType<typeof launchTestApplication>>
}

export const test = base.extend<TestFixtures>({
  application: async ({ playwright: _playwright }, provide) => {
    const application = await launchTestApplication({
      workspacePrefix: "pdfantom-test",
      windowMode: configuredApplicationWindowMode(),
    })

    try {
      await provide(application)
    } finally {
      await application.close()
    }
  },
})

test.afterEach(async ({ application }) => {
  if (application.windowMode === "background") {
    expect(await application.hasVisibleWindow()).toBe(false)
  }
})

export { expect }
