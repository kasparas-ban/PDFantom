import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
} from "react"

import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

const KEYBOARD_RESIZE_STEP = 16

type ResizablePanelProps = {
  readonly children: ReactNode
  readonly maximumWidth: number
  readonly minimumWidth: number
  readonly onWidthChange: (width: number) => void
  readonly resizeHandleLabel: string
  readonly side: "left" | "right"
  readonly width: number
}

type PanelResizeHandleProps = Pick<
  ResizablePanelProps,
  | "maximumWidth"
  | "minimumWidth"
  | "onWidthChange"
  | "resizeHandleLabel"
  | "side"
  | "width"
>

export function ResizablePanel({
  children,
  maximumWidth,
  minimumWidth,
  onWidthChange,
  resizeHandleLabel,
  side,
  width,
}: ResizablePanelProps) {
  return (
    <div className="relative h-full shrink-0" style={{ width }}>
      {children}
      <PanelResizeHandle
        maximumWidth={maximumWidth}
        minimumWidth={minimumWidth}
        onWidthChange={onWidthChange}
        resizeHandleLabel={resizeHandleLabel}
        side={side}
        width={width}
      />
    </div>
  )
}

function PanelResizeHandle({
  maximumWidth,
  minimumWidth,
  onWidthChange,
  resizeHandleLabel,
  side,
  width,
}: PanelResizeHandleProps) {
  const bodyStylesBeforeResize = useRef<{ cursor: string; userSelect: string } | null>(null)
  const resizeStart = useRef<{ pointerX: number; width: number } | null>(null)
  const restoreBodyStyles = useCallback(() => {
    const previousStyles = bodyStylesBeforeResize.current
    if (!previousStyles) return

    document.body.style.cursor = previousStyles.cursor
    document.body.style.userSelect = previousStyles.userSelect
    bodyStylesBeforeResize.current = null
  }, [])

  useEffect(() => restoreBodyStyles, [restoreBodyStyles])

  const resizeTo = (nextWidth: number) =>
    onWidthChange(clampWidth(nextWidth, minimumWidth, maximumWidth))

  const startResize = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0) return

    bodyStylesBeforeResize.current ??= {
      cursor: document.body.style.cursor,
      userSelect: document.body.style.userSelect,
    }
    resizeStart.current = { pointerX: event.clientX, width }
    event.currentTarget.setPointerCapture(event.pointerId)
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
  }

  const finishResize = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    resizeStart.current = null
    restoreBodyStyles()
  }

  const resize = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    const start = resizeStart.current
    if (!start) return

    const direction = side === "left" ? 1 : -1
    resizeTo(start.width + direction * (event.clientX - start.pointerX))
  }

  const resizeWithKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    let nextWidth: number

    switch (event.key) {
      case "ArrowLeft":
        nextWidth = width + (side === "left" ? -KEYBOARD_RESIZE_STEP : KEYBOARD_RESIZE_STEP)
        break
      case "ArrowRight":
        nextWidth = width + (side === "left" ? KEYBOARD_RESIZE_STEP : -KEYBOARD_RESIZE_STEP)
        break
      case "Home":
        nextWidth = minimumWidth
        break
      case "End":
        nextWidth = maximumWidth
        break
      default:
        return
    }

    event.preventDefault()
    resizeTo(nextWidth)
  }

  return (
    <Separator
      aria-label={resizeHandleLabel}
      aria-orientation="vertical"
      aria-valuemax={maximumWidth}
      aria-valuemin={minimumWidth}
      aria-valuenow={width}
      className={cn(
        "window-no-drag absolute inset-y-0 z-30 m-0 h-full cursor-col-resize touch-none border-0 bg-transparent outline-none after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-transparent after:transition-colors hover:after:bg-sidebar-ring focus-visible:after:bg-sidebar-ring data-vertical:w-2",
        side === "left" ? "-right-1" : "-left-1",
      )}
      onKeyDown={resizeWithKeyboard}
      onLostPointerCapture={restoreBodyStyles}
      onPointerCancel={finishResize}
      onPointerDown={startResize}
      onPointerMove={resize}
      onPointerUp={finishResize}
      orientation="vertical"
      tabIndex={0}
    />
  )
}

function clampWidth(width: number, minimumWidth: number, maximumWidth: number) {
  return Math.min(maximumWidth, Math.max(minimumWidth, width))
}
