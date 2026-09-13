import { describe, expect, test } from "vitest"

import { normalizeChatSearchText } from "../../src/renderer/src/sidebar/chat-search-runtime"

describe("Chat Search text normalization", () => {
  test("folds case and diacritics and collapses whitespace", () => {
    expect(normalizeChatSearchText("CAFÉ\t  au\nLAIT")).toEqual({
      text: "cafe au lait",
      starts: [0, 1, 2, 3, 4, 7, 8, 9, 10, 11, 12, 13],
      ends: [1, 2, 3, 4, 7, 8, 9, 10, 11, 12, 13, 14],
    })
  })

  test("maps a decomposed diacritic back to the complete source grapheme", () => {
    expect(normalizeChatSearchText("Cafe\u0301")).toEqual({
      text: "cafe",
      starts: [0, 1, 2, 3],
      ends: [1, 2, 3, 5],
    })
  })

  test("keeps UTF-16 offsets for characters outside the basic multilingual plane", () => {
    expect(normalizeChatSearchText("A😀B")).toEqual({
      text: "a😀b",
      starts: [0, 1, 1, 3],
      ends: [1, 3, 3, 4],
    })
  })
})
