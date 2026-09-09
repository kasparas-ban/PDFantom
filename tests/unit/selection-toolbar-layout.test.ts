import { describe, expect, test } from "vitest"

import { resolveSelectionToolbarPosition } from "../../src/renderer/src/components/selection-toolbar-layout"

const bounds = { top: 100, left: 600, width: 400, height: 700 }
const toolbar = { width: 220, height: 36 }

describe("selection toolbar position", () => {
  test("centres above the selection with a gap", () => {
    const position = resolveSelectionToolbarPosition({
      selectionRect: { top: 400, left: 700, width: 100, height: 20 },
      boundsRect: bounds,
      toolbarSize: toolbar,
    })

    expect(position).toEqual({ top: 400 - 8 - 36, left: 750 - 110 })
  })

  test("clamps horizontally inside the bounds", () => {
    const nearLeft = resolveSelectionToolbarPosition({
      selectionRect: { top: 400, left: 605, width: 20, height: 20 },
      boundsRect: bounds,
      toolbarSize: toolbar,
    })
    const nearRight = resolveSelectionToolbarPosition({
      selectionRect: { top: 400, left: 980, width: 15, height: 20 },
      boundsRect: bounds,
      toolbarSize: toolbar,
    })

    expect(nearLeft?.left).toBe(608)
    expect(nearRight?.left).toBe(1000 - 8 - 220)
  })

  test("flips below when there is no room above", () => {
    const position = resolveSelectionToolbarPosition({
      selectionRect: { top: 120, left: 700, width: 100, height: 20 },
      boundsRect: bounds,
      toolbarSize: toolbar,
    })

    expect(position?.top).toBe(120 + 20 + 8)
  })

  test("stays inside the bounds when neither side has room", () => {
    const position = resolveSelectionToolbarPosition({
      selectionRect: { top: 90, left: 700, width: 100, height: 700 },
      boundsRect: bounds,
      toolbarSize: toolbar,
    })

    expect(position?.top).toBe(108)
  })

  test("hides when the selection is scrolled out of the bounds", () => {
    expect(
      resolveSelectionToolbarPosition({
        selectionRect: { top: 20, left: 700, width: 100, height: 20 },
        boundsRect: bounds,
        toolbarSize: toolbar,
      }),
    ).toBeNull()
  })
})
