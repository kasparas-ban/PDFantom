import { expect, test } from "vitest"

import { isTextOnlyOutputModel } from "../../src/shared/chat-api"

test("accepts models whose only output modality is text", () => {
  expect(isTextOnlyOutputModel(["TEXT"])).toBe(true)
})

test("rejects models that combine text with another output modality", () => {
  expect(isTextOnlyOutputModel(["text", "audio"])).toBe(false)
  expect(isTextOnlyOutputModel(["text", "image"])).toBe(false)
})

test("rejects models whose output is not text", () => {
  expect(isTextOnlyOutputModel(["audio"])).toBe(false)
})

test("rejects models without declared output modalities", () => {
  expect(isTextOnlyOutputModel()).toBe(false)
  expect(isTextOnlyOutputModel(null)).toBe(false)
  expect(isTextOnlyOutputModel([])).toBe(false)
})
