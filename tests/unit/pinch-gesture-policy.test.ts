import { describe, expect, test } from "vitest"

import {
  macPinchGesturePolicy,
  resolvePinchGesturePolicy,
  standardPinchGesturePolicy,
  type PinchWheelGesture,
} from "../../src/renderer/src/reader/pinch-gesture-policy"

const pinch = (overrides: Partial<PinchWheelGesture> = {}): PinchWheelGesture => ({
  ctrlKey: true,
  deltaMode: 0,
  deltaX: 0,
  deltaY: -3,
  deltaZ: 0,
  ...overrides,
})

describe("macOS pinch gesture policy", () => {
  test("recognizes fast pinches with large deltas", () => {
    expect(macPinchGesturePolicy.isPinch(pinch({ deltaY: -11 }), false)).toBe(true)
    expect(macPinchGesturePolicy.isPinch(pinch({ deltaY: 8 }), false)).toBe(true)
  })

  test("ignores a physically held Control key", () => {
    expect(macPinchGesturePolicy.isPinch(pinch(), true)).toBe(false)
  })

  test("leaves regular scrolling alone", () => {
    expect(macPinchGesturePolicy.isPinch(pinch({ ctrlKey: false }), false)).toBe(false)
    expect(macPinchGesturePolicy.isPinch(pinch({ deltaMode: 1 }), false)).toBe(false)
    expect(macPinchGesturePolicy.isPinch(pinch({ deltaY: 0 }), false)).toBe(false)
    expect(macPinchGesturePolicy.isPinch(pinch({ deltaZ: 1 }), false)).toBe(false)
  })
})

describe("standard pinch gesture policy", () => {
  test("recognizes small strictly vertical pinches", () => {
    expect(standardPinchGesturePolicy.isPinch(pinch({ deltaY: -3 }), false)).toBe(true)
  })

  test("rejects large or horizontal deltas", () => {
    expect(standardPinchGesturePolicy.isPinch(pinch({ deltaY: -11 }), false)).toBe(false)
    expect(standardPinchGesturePolicy.isPinch(pinch({ deltaX: 2 }), false)).toBe(false)
  })

  test("ignores a physically held Control key", () => {
    expect(standardPinchGesturePolicy.isPinch(pinch(), true)).toBe(false)
  })
})

describe("pinch gesture policy resolution", () => {
  test.each([["MacIntel"], ["macOS"], ["MacPPC"]])("resolves %s to macOS", (platform) => {
    expect(resolvePinchGesturePolicy(platform)).toBe(macPinchGesturePolicy)
  })

  test.each([["Win32"], ["Windows"], ["Linux x86_64"], [""]])(
    "resolves %s to the standard policy",
    (platform) => {
      expect(resolvePinchGesturePolicy(platform)).toBe(standardPinchGesturePolicy)
    },
  )
})
