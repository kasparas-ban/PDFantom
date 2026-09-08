import { expect, test } from "vitest"

import {
  MINIMUM_PANEL_WIDTH,
  resolveReaderWorkspaceLayout,
} from "../../src/renderer/src/reader/reader-workspace-layout"

const panels = (documents: number | null, chat: number | null, sideChat: number | null) => ({
  documents: { isOpen: documents !== null, preferredWidth: documents ?? 256 },
  chat: { isOpen: chat !== null, preferredWidth: chat ?? 360 },
  "side-chat": { isOpen: sideChat !== null, preferredWidth: sideChat ?? 360 },
})

const widths = (layout: ReturnType<typeof resolveReaderWorkspaceLayout>) => ({
  documents: layout.documents.width,
  chat: layout.chat.width,
  sideChat: layout["side-chat"].width,
})

test("panels keep their preferred widths while the reader keeps its minimum", () => {
  const layout = resolveReaderWorkspaceLayout({
    panels: panels(256, 360, 360),
    lastResizedPanel: null,
    viewportWidth: 1600,
  })

  expect(widths(layout)).toEqual({ documents: 256, chat: 360, sideChat: 360 })
  expect(layout.chat.maximumWidth).toBe(1600 - 320 - 2 * MINIMUM_PANEL_WIDTH)
})

test("three open panels share the budget proportionally when none was resized last", () => {
  const layout = resolveReaderWorkspaceLayout({
    panels: panels(400, 600, 600),
    lastResizedPanel: null,
    viewportWidth: 1280,
  })

  expect(widths(layout)).toEqual({ documents: 278, chat: 341, sideChat: 341 })
})

test("the most recently resized panel keeps its width and the others give way", () => {
  const layout = resolveReaderWorkspaceLayout({
    panels: panels(400, 600, 500),
    lastResizedPanel: "side-chat",
    viewportWidth: 1280,
  })

  expect(widths(layout)).toEqual({ documents: 221, chat: 239, sideChat: 500 })
})

test("a closed panel takes no budget even when it was resized last", () => {
  const layout = resolveReaderWorkspaceLayout({
    panels: panels(300, 700, null),
    lastResizedPanel: "side-chat",
    viewportWidth: 1000,
  })

  expect(widths(layout)).toEqual({ documents: 274, chat: 406, sideChat: 360 })
})
