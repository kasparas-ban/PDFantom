import { test as base } from "@playwright/test"

import { launchTestApplication } from "./launch-application"

type TestFixtures = {
  application: Awaited<ReturnType<typeof launchTestApplication>>
}

export const test = base.extend<TestFixtures>({
  application: async ({ playwright: _playwright }, provide) => {
    const application = await launchTestApplication({ workspacePrefix: "pdfantom-test" })

    try {
      await provide(application)
    } finally {
      await application.close()
    }
  },
})

export { expect } from "@playwright/test"
