import { expect, test as base } from "@playwright/test"

import { installFakeCodex, type FakeCodexOptions } from "../fixtures/fake-codex/fake-codex"
import { configuredApplicationWindowMode } from "./application-window-mode"
import { launchTestApplication } from "./launch-application"

type TestFixtures = {
  application: Awaited<ReturnType<typeof launchTestApplication>>
}

type TestOptions = {
  fakeCodex: FakeCodexOptions | null
}

export const test = base.extend<TestFixtures & TestOptions>({
  fakeCodex: [null, { option: true }],
  application: async ({ fakeCodex }, provide) => {
    const application = await launchTestApplication({
      workspacePrefix: "pdfantom-test",
      windowMode: configuredApplicationWindowMode(),
      ...(fakeCodex && {
        codexExecutable: (workspace: string) => installFakeCodex(workspace, fakeCodex),
      }),
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
