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

describe("pinch gesture policies", () => {
  test("recognize large-delta pinches on macOS", () => {
    expect(macPinchGesturePolicy.isPinch(pinch({ deltaY: -11 }), false)).toBe(true)
  })

  test("ignore a physically held Control key", () => {
    expect(macPinchGesturePolicy.isPinch(pinch(), true)).toBe(false)
    expect(standardPinchGesturePolicy.isPinch(pinch(), true)).toBe(false)
  })

  test("leave regular scrolling alone", () => {
    expect(macPinchGesturePolicy.isPinch(pinch({ ctrlKey: false }), false)).toBe(false)
    expect(macPinchGesturePolicy.isPinch(pinch({ deltaY: 0 }), false)).toBe(false)
  })

  test("resolve macOS to the macOS policy and everything else to standard", () => {
    expect(resolvePinchGesturePolicy("MacIntel")).toBe(macPinchGesturePolicy)
    expect(resolvePinchGesturePolicy("Win32")).toBe(standardPinchGesturePolicy)
  })
})
