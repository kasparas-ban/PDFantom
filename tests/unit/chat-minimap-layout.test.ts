import type { ThreadMessage } from "@assistant-ui/react"
import { describe, expect, test } from "vitest"

import {
  deriveChatMinimapItems,
  resolveChatMinimapIndexFromPointer,
  resolveChatMinimapItemTopPercent,
  resolveChatMinimapLane,
  resolveChatMinimapPreviewTranslate,
  resolveChatMinimapRailHeight,
} from "../../src/renderer/src/sidebar/chat-minimap-layout"

const userMessage = (id: string, text: string): ThreadMessage => ({
  id,
  attachments: [],
  content: [{ type: "text", text }],
  createdAt: new Date(0),
  metadata: { custom: {} },
  role: "user",
})

const assistantMessage = (id: string, text: string): ThreadMessage => ({
  id,
  content: [{ type: "text", text }],
  createdAt: new Date(0),
  metadata: {
    custom: {},
    steps: [],
    unstable_annotations: [],
    unstable_data: [],
    unstable_state: null,
  },
  role: "assistant",
  status: { type: "complete", reason: "stop" },
})

describe("minimap items", () => {
  test("map one dash per Student turn", () => {
    const items = deriveChatMinimapItems([
      userMessage("u1", "What is on page two?"),
      assistantMessage("a1", "A summary of the method."),
      userMessage("u2", "And page three?"),
    ])

    expect(items.map((item) => item.id)).toEqual(["u1", "u2"])
    expect(items[0].userText).toBe("What is on page two?")
  })

  test("preview the turn's final Assistant Message", () => {
    const items = deriveChatMinimapItems([
      userMessage("u1", "Explain this."),
      assistantMessage("a1", "Thinking aloud."),
      assistantMessage("a2", "The settled answer."),
      userMessage("u2", "Thanks."),
      assistantMessage("a3", "Belongs to the second turn."),
    ])

    expect(items[0].assistantText).toBe("The settled answer.")
    expect(items[1].assistantText).toBe("Belongs to the second turn.")
  })

  test("leave a turn without a reply unpreviewed", () => {
    const items = deriveChatMinimapItems([userMessage("u1", "Hello"), userMessage("u2", "   ")])

    expect(items[0].assistantText).toBeNull()
    expect(items[1].userText).toBeNull()
  })

  test("collapse whitespace and cap the text a preview can show", () => {
    const items = deriveChatMinimapItems([
      userMessage("u1", "  many\n\nlines  "),
      assistantMessage("a1", "x".repeat(500)),
      userMessage("u2", "next"),
    ])

    expect(items[0].userText).toBe("many lines")
    expect(items[0].assistantText).toHaveLength(240)
  })
})

describe("rail geometry", () => {
  test("space dashes evenly and centre the rail on the viewport", () => {
    expect(resolveChatMinimapItemTopPercent(0, 3)).toBe(0)
    expect(resolveChatMinimapItemTopPercent(1, 3)).toBe(50)
    expect(resolveChatMinimapItemTopPercent(2, 3)).toBe(100)
  })

  test("clamp an index that outruns the item count", () => {
    expect(resolveChatMinimapItemTopPercent(9, 3)).toBe(100)
    expect(resolveChatMinimapItemTopPercent(0, 1)).toBe(0)
  })

  test("grow the rail with the Conversation but never past the composer", () => {
    expect(resolveChatMinimapRailHeight(3)).toBe("max(1px, min(16px, calc(100% - 16rem)))")
  })
})

describe("pointer targeting", () => {
  const rail = { itemCount: 5, railHeight: 32, railTop: 100 }

  test("pick the dash nearest the pointer", () => {
    expect(resolveChatMinimapIndexFromPointer({ ...rail, pointerY: 100 })).toBe(0)
    expect(resolveChatMinimapIndexFromPointer({ ...rail, pointerY: 116 })).toBe(2)
    expect(resolveChatMinimapIndexFromPointer({ ...rail, pointerY: 132 })).toBe(4)
  })

  test("clamp a pointer that has left the rail", () => {
    expect(resolveChatMinimapIndexFromPointer({ ...rail, pointerY: -40 })).toBe(0)
    expect(resolveChatMinimapIndexFromPointer({ ...rail, pointerY: 900 })).toBe(4)
  })

  test("target nothing without a rail to aim at", () => {
    expect(resolveChatMinimapIndexFromPointer({ ...rail, itemCount: 0, pointerY: 100 })).toBeNull()
    expect(resolveChatMinimapIndexFromPointer({ ...rail, railHeight: 0, pointerY: 100 })).toBeNull()
  })
})

describe("lane beside the message column", () => {
  test("keep the strip inside the padding of a narrow panel", () => {
    expect(resolveChatMinimapLane(360).hitStripWidth).toBe(12)
    expect(resolveChatMinimapLane(360).isPersistent).toBe(false)
  })

  test("widen the strip as the centred column leaves a gutter", () => {
    expect(resolveChatMinimapLane(800).hitStripWidth).toBe(31)
    expect(resolveChatMinimapLane(1400).hitStripWidth).toBe(40)
  })

  test("show the rail unprompted once the gutter can hold it", () => {
    expect(resolveChatMinimapLane(832).isPersistent).toBe(false)
    expect(resolveChatMinimapLane(836).isPersistent).toBe(true)
  })

  test("fit the preview to the panel", () => {
    expect(resolveChatMinimapLane(200).previewWidth).toBe(164)
    expect(resolveChatMinimapLane(300).previewWidth).toBe(264)
    expect(resolveChatMinimapLane(1400).previewWidth).toBe(320)
  })

  test("go inert for a viewport that has not been measured yet", () => {
    expect(resolveChatMinimapLane(0)).toEqual({
      hitStripWidth: 0,
      isPersistent: false,
      previewWidth: 0,
    })
    expect(resolveChatMinimapLane(Number.NaN).previewWidth).toBe(0)
  })
})

describe("preview placement", () => {
  test("hold the preview inside the viewport at either end of the rail", () => {
    expect(resolveChatMinimapPreviewTranslate(0, 4)).toBe("0%")
    expect(resolveChatMinimapPreviewTranslate(1, 4)).toBe("-50%")
    expect(resolveChatMinimapPreviewTranslate(3, 4)).toBe("-100%")
  })
})
