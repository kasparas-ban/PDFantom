import { afterEach, describe, expect, test, vi } from "vitest"

import { configuredApplicationWindowMode } from "../app/application-window-mode"

describe("configured application window mode", () => {
  afterEach(() => vi.unstubAllEnvs())

  test.each([
    [undefined, "background"],
    ["background", "background"],
    ["visible", "visible"],
  ] as const)("maps %s to %s", (configuredMode, expectedMode) => {
    vi.stubEnv("PDFANTOM_E2E_WINDOW", configuredMode)

    expect(configuredApplicationWindowMode()).toBe(expectedMode)
  })

  test("rejects an unsupported mode", () => {
    vi.stubEnv("PDFANTOM_E2E_WINDOW", "visble")

    expect(() => configuredApplicationWindowMode()).toThrow(
      'Unsupported PDFANTOM_E2E_WINDOW value "visble". Expected "background" or "visible".',
    )
  })
})
