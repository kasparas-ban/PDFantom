import { afterEach, expect, test, vi } from "vitest"

import { rendererEntryUrl } from "./renderer-entry"

afterEach(() => vi.unstubAllGlobals())

test("uses the development renderer URL provided by Electron Forge", () => {
  vi.stubGlobal("MAIN_WINDOW_VITE_DEV_SERVER_URL", "http://localhost:5173")

  expect(rendererEntryUrl()).toBe("http://localhost:5173")
})
