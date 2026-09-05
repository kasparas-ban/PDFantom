import { expect, test } from "@playwright/test"

import { installPDFRenderingGate } from "../../src/renderer/src/reader/pdf-rendering-gate"

test("the PDF rendering gate suspends, resumes and restores its queue", () => {
  const calls: string[] = []
  const visiblePriority = {}
  const hiddenPriority = {}
  const resumedPriority = {}
  const visibleView = {}
  const hiddenView = {}
  const resumedView = {}
  const queue = {
    renderHighestPriority: (value: object) => {
      if (value === visiblePriority) calls.push("priority:visible")
      if (value === resumedPriority) calls.push("priority:resumed")
    },
    renderView: (value: object) => {
      if (value === visibleView) calls.push("view:visible")
      if (value === resumedView) calls.push("view:resumed")
      return true
    },
  }
  const originalPriority = queue.renderHighestPriority
  const originalView = queue.renderView
  const gate = installPDFRenderingGate({ renderingQueue: queue })

  queue.renderHighestPriority(visiblePriority)
  expect(queue.renderView(visibleView)).toBe(true)
  gate.setActive(false)
  queue.renderHighestPriority(hiddenPriority)
  expect(queue.renderView(hiddenView)).toBe(false)
  gate.setActive(true)
  queue.renderHighestPriority(resumedPriority)
  expect(queue.renderView(resumedView)).toBe(true)
  gate.dispose()

  expect(calls).toEqual(["priority:visible", "view:visible", "priority:resumed", "view:resumed"])
  expect(queue.renderHighestPriority).toBe(originalPriority)
  expect(queue.renderView).toBe(originalView)
})

test("the PDF rendering gate requires a queue", () => {
  expect(() => installPDFRenderingGate({})).toThrow("PDF.js did not provide a rendering queue.")
})
