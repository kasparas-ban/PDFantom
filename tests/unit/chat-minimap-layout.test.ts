import type { ThreadMessage } from "@assistant-ui/react"
import { describe, expect, test } from "vitest"

import {
  resolveChatMinimapIndexFromPointer,
  resolveChatMinimapItemTopPercent,
  resolveChatMinimapPreview,
  resolveChatMinimapPreviewTranslate,
  resolveChatMinimapTurnIds,
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

describe("minimap turns", () => {
  test("map one dash per Student turn", () => {
    const turnIds = resolveChatMinimapTurnIds([
      userMessage("u1", "What is on page two?"),
      assistantMessage("a1", "A summary of the method."),
      userMessage("u2", "And page three?"),
    ])

    expect(turnIds).toEqual(["u1", "u2"])
  })
})

describe("turn preview", () => {
  test("show the question and the turn's final Assistant Message", () => {
    const messages = [
      userMessage("u1", "Explain this."),
      assistantMessage("a1", "Thinking aloud."),
      assistantMessage("a2", "The settled answer."),
      userMessage("u2", "Thanks."),
      assistantMessage("a3", "Belongs to the second turn."),
    ]

    expect(resolveChatMinimapPreview(messages, "u1")).toEqual({
      userText: "Explain this.",
      assistantText: "The settled answer.",
    })
    expect(resolveChatMinimapPreview(messages, "u2")?.assistantText).toBe(
      "Belongs to the second turn.",
    )
  })

  test("leave a turn without a reply unpreviewed", () => {
    const messages = [userMessage("u1", "Hello"), userMessage("u2", "   ")]

    expect(resolveChatMinimapPreview(messages, "u1")?.assistantText).toBeNull()
    expect(resolveChatMinimapPreview(messages, "u2")?.userText).toBeNull()
  })

  test("collapse whitespace", () => {
    const messages = [userMessage("u1", "  many\n\nlines  ")]

    expect(resolveChatMinimapPreview(messages, "u1")?.userText).toBe("many lines")
  })

  test("preview nothing for a turn that is no longer in the Conversation", () => {
    expect(resolveChatMinimapPreview([userMessage("u1", "Hello")], "gone")).toBeNull()
  })
})

describe("rail geometry", () => {
  test("space dashes evenly along the rail", () => {
    expect(resolveChatMinimapItemTopPercent(0, 3)).toBe(0)
    expect(resolveChatMinimapItemTopPercent(1, 3)).toBe(50)
    expect(resolveChatMinimapItemTopPercent(2, 3)).toBe(100)
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
})

describe("preview placement", () => {
  test("hold the preview inside the viewport at either end of the rail", () => {
    expect(resolveChatMinimapPreviewTranslate(0, 4)).toBe("0%")
    expect(resolveChatMinimapPreviewTranslate(1, 4)).toBe("-50%")
    expect(resolveChatMinimapPreviewTranslate(3, 4)).toBe("-100%")
  })
})
