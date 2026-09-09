import { expect, test } from "vitest"

import { normalizeDocumentSelectionText } from "../../src/renderer/src/reader/document-text-selection"

test("collapses PDF line wraps and runs of whitespace into one paragraph", () => {
  expect(
    normalizeDocumentSelectionText(
      "\nAn ecosystem is a community of organisms interacting with one another\nand with the nonliving world  \n\naround them.\n",
    ),
  ).toBe(
    "An ecosystem is a community of organisms interacting with one another and with the nonliving world around them.",
  )
})

test("leaves end-of-line hyphens alone", () => {
  expect(normalizeDocumentSelectionText("eco-\nsystem")).toBe("eco- system")
})
