import { expect, test } from "vitest"

import {
  BACKGROUND_E2E_SWITCH,
  resolveApplicationLaunchConfiguration,
} from "../../src/shared/application-launch"

test("coordinates a background macOS E2E launch", () => {
  expect(
    resolveApplicationLaunchConfiguration({
      commandLine: [BACKGROUND_E2E_SWITCH],
      isPackaged: false,
      platform: "darwin",
    }),
  ).toEqual({
    activationPolicy: "accessory",
    setDevelopmentDockIcon: false,
    showWindow: false,
  })
})

test("coordinates a visible macOS development launch", () => {
  expect(
    resolveApplicationLaunchConfiguration({
      commandLine: [],
      isPackaged: false,
      platform: "darwin",
    }),
  ).toEqual({
    activationPolicy: undefined,
    setDevelopmentDockIcon: true,
    showWindow: true,
  })
})

test("does not configure a development dock icon for a packaged launch", () => {
  expect(
    resolveApplicationLaunchConfiguration({
      commandLine: [],
      isPackaged: true,
      platform: "darwin",
    }),
  ).toEqual({
    activationPolicy: undefined,
    setDevelopmentDockIcon: false,
    showWindow: true,
  })
})
