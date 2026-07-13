import {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

import { Separator } from "@/components/ui/separator"
import { useAppConfig } from "@/store/app-config-provider"
import { AppSidebar } from "./app-sidebar"

const MINIMUM_WIDTH = 200
const MAXIMUM_WIDTH = 480
const MINIMUM_READER_WIDTH = 320
const KEYBOARD_RESIZE_STEP = 16

type ResizableAppSidebarProps = {
  readonly onActivateDocument: (documentId: string) => void
  readonly onOpenDocument: () => void
}

type SidebarResizeHandleProps = {
  readonly maximumWidth: number
  readonly onResize: (width: number) => void
  readonly width: number
}

export function ResizableAppSidebar({
  onActivateDocument,
  onOpenDocument,
}: ResizableAppSidebarProps) {
  const storedWidth = useAppConfig((state) => state.sidePanelWidth)
  const setWidth = useAppConfig((state) => state.setSidePanelWidth)
  const [maximumWidth, setMaximumWidth] = useState(getMaximumWidth)
  const width = clampWidth(storedWidth, maximumWidth)

  useEffect(() => {
    const resizeForWindow = () => {
      setMaximumWidth(getMaximumWidth())
    }

    window.addEventListener("resize", resizeForWindow)
    return () => window.removeEventListener("resize", resizeForWindow)
  }, [])

  useEffect(() => {
    if (storedWidth !== width) setWidth(width)
  }, [setWidth, storedWidth, width])

  return (
    <div className="relative h-full shrink-0" style={{ width }}>
      <AppSidebar
        onActivateDocument={onActivateDocument}
        onOpenDocument={onOpenDocument}
      />
      <SidebarResizeHandle maximumWidth={maximumWidth} onResize={setWidth} width={width} />
    </div>
  )
}

function SidebarResizeHandle({ maximumWidth, onResize, width }: SidebarResizeHandleProps) {
  const bodyStylesBeforeResize = useRef<{ cursor: string; userSelect: string } | null>(null)
  const restoreBodyStyles = useCallback(() => {
    const previousStyles = bodyStylesBeforeResize.current
    if (!previousStyles) return

    document.body.style.cursor = previousStyles.cursor
    document.body.style.userSelect = previousStyles.userSelect
    bodyStylesBeforeResize.current = null
  }, [])

  useEffect(() => restoreBodyStyles, [restoreBodyStyles])

  const resizeTo = (nextWidth: number) => onResize(clampWidth(nextWidth, maximumWidth))

  const startResize = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0) return

    bodyStylesBeforeResize.current ??= {
      cursor: document.body.style.cursor,
      userSelect: document.body.style.userSelect,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
  }

  const finishResize = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    restoreBodyStyles()
  }

  const resize = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    resizeTo(event.clientX)
  }

  const resizeWithKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    let nextWidth: number

    switch (event.key) {
      case "ArrowLeft":
        nextWidth = width - KEYBOARD_RESIZE_STEP
        break
      case "ArrowRight":
        nextWidth = width + KEYBOARD_RESIZE_STEP
        break
      case "Home":
        nextWidth = MINIMUM_WIDTH
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
      aria-label="Resize sidebar"
      aria-orientation="vertical"
      aria-valuemax={maximumWidth}
      aria-valuemin={MINIMUM_WIDTH}
      aria-valuenow={width}
      className="window-no-drag absolute inset-y-0 -right-1 z-30 m-0 h-full cursor-col-resize touch-none border-0 bg-transparent outline-none after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-transparent after:transition-colors hover:after:bg-sidebar-ring focus-visible:after:bg-sidebar-ring data-vertical:w-2"
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

function getMaximumWidth() {
  return Math.max(MINIMUM_WIDTH, Math.min(MAXIMUM_WIDTH, window.innerWidth - MINIMUM_READER_WIDTH))
}

function clampWidth(width: number, maximumWidth: number) {
  return Math.min(maximumWidth, Math.max(MINIMUM_WIDTH, width))
}
