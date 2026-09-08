type LayoutRect = {
  readonly top: number
  readonly left: number
  readonly width: number
  readonly height: number
}

export type LayoutSize = {
  readonly width: number
  readonly height: number
}

type ResolveSelectionToolbarPositionInput = {
  readonly selectionRect: LayoutRect
  readonly boundsRect: LayoutRect
  readonly toolbarSize: LayoutSize
}

const GAP = 8
const MARGIN = 8

export function resolveSelectionToolbarPosition({
  selectionRect,
  boundsRect,
  toolbarSize,
}: ResolveSelectionToolbarPositionInput) {
  if (!intersects(selectionRect, boundsRect)) return null

  const minLeft = boundsRect.left + MARGIN
  const maxLeft = boundsRect.left + boundsRect.width - MARGIN - toolbarSize.width
  const centredLeft = selectionRect.left + selectionRect.width / 2 - toolbarSize.width / 2
  const left = Math.max(minLeft, Math.min(maxLeft, centredLeft))

  const minTop = boundsRect.top + MARGIN
  const maxTop = boundsRect.top + boundsRect.height - MARGIN - toolbarSize.height
  const aboveTop = selectionRect.top - GAP - toolbarSize.height
  const belowTop = selectionRect.top + selectionRect.height + GAP

  if (aboveTop >= minTop) return { top: aboveTop, left }
  if (belowTop <= maxTop) return { top: belowTop, left }

  return { top: Math.max(minTop, Math.min(maxTop, aboveTop)), left }
}

function intersects(a: LayoutRect, b: LayoutRect) {
  return (
    a.left < b.left + b.width &&
    a.left + a.width > b.left &&
    a.top < b.top + b.height &&
    a.top + a.height > b.top
  )
}
