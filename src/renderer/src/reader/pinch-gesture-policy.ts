export type PinchWheelGesture = Pick<
  WheelEvent,
  "ctrlKey" | "deltaMode" | "deltaX" | "deltaY" | "deltaZ"
>

export type PinchGesturePolicy = {
  readonly isPinch: (gesture: PinchWheelGesture, physicalCtrlHeld: boolean) => boolean
}

const DOM_DELTA_PIXEL = 0

const isPixelScrollWithoutPhysicalCtrl = (gesture: PinchWheelGesture, physicalCtrlHeld: boolean) =>
  gesture.ctrlKey &&
  !physicalCtrlHeld &&
  gesture.deltaMode === DOM_DELTA_PIXEL &&
  gesture.deltaY !== 0 &&
  gesture.deltaZ === 0

export const macPinchGesturePolicy: PinchGesturePolicy = {
  isPinch: (gesture, physicalCtrlHeld) =>
    isPixelScrollWithoutPhysicalCtrl(gesture, physicalCtrlHeld),
}

export const standardPinchGesturePolicy: PinchGesturePolicy = {
  isPinch: (gesture, physicalCtrlHeld) => {
    if (!isPixelScrollWithoutPhysicalCtrl(gesture, physicalCtrlHeld)) return false
    if (gesture.deltaX !== 0) return false

    const scaleFactor = Math.exp(-gesture.deltaY / 100)

    return Math.abs(scaleFactor - 1) < 0.05
  },
}

export const resolvePinchGesturePolicy = (platform: string) =>
  /mac/i.test(platform) ? macPinchGesturePolicy : standardPinchGesturePolicy

const readPlatform = () => {
  if (typeof navigator === "undefined") return ""

  const userAgentData = (navigator as Navigator & { userAgentData?: { platform?: string } })
    .userAgentData

  return userAgentData?.platform || navigator.platform || ""
}

export const defaultPinchGesturePolicy = () => resolvePinchGesturePolicy(readPlatform())
