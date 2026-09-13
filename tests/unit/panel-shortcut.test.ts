import { describe, expect, test } from "vitest"

import {
  getPanelShortcut,
  type PanelShortcutEvent,
} from "../../src/renderer/src/hooks/panel-shortcut"

type TestShortcutEvent = PanelShortcutEvent & Pick<KeyboardEvent, "key">

const shortcut = (overrides: Partial<TestShortcutEvent> = {}): TestShortcutEvent => ({
  altKey: false,
  code: "KeyB",
  ctrlKey: false,
  defaultPrevented: false,
  key: "b",
  metaKey: true,
  shiftKey: false,
  ...overrides,
})

describe("panel shortcuts", () => {
  test("recognizes Option-Command-B when macOS translates the key", () => {
    expect(getPanelShortcut(shortcut({ altKey: true, key: "∫" }))).toBe("chat")
  })
})
