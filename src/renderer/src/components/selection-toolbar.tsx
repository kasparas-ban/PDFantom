import { useLayoutEffect, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"

import { resolveSelectionToolbarPosition, type LayoutSize } from "./selection-toolbar-layout"

const ESTIMATED_TOOLBAR_SIZE: LayoutSize = { width: 240, height: 36 }

type SelectionToolbarProps = {
  readonly selectionRect: DOMRect
  readonly boundsRect: DOMRect
  readonly slot: string
  readonly children: ReactNode
}

export function SelectionToolbar({
  selectionRect,
  boundsRect,
  slot,
  children,
}: SelectionToolbarProps) {
  const [toolbarElement, setToolbarElement] = useState<HTMLDivElement | null>(null)
  const [toolbarSize, setToolbarSize] = useState(ESTIMATED_TOOLBAR_SIZE)

  useLayoutEffect(() => {
    if (!toolbarElement) return

    const { width, height } = toolbarElement.getBoundingClientRect()
    setToolbarSize((size) =>
      size.width === width && size.height === height ? size : { width, height },
    )
  }, [toolbarElement])

  const position = resolveSelectionToolbarPosition({ selectionRect, boundsRect, toolbarSize })
  if (!position) return null

  return createPortal(
    <div
      aria-label="Selection actions"
      className="fixed z-50 flex items-center gap-0.5 rounded-xl bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
      data-slot={slot}
      onMouseDown={(event) => event.preventDefault()}
      ref={setToolbarElement}
      role="toolbar"
      style={position}
      tabIndex={-1}
    >
      {children}
    </div>,
    document.body,
  )
}
