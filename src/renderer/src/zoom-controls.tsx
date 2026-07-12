import { Minus, Plus } from "lucide-react"

import { Button } from "./components/ui/button"
import { MAX_PDF_SCALE, MIN_PDF_SCALE } from "./pdf-reader-runtime"
import { useReaderSession } from "./store/reader-session-provider"

export function ZoomControls() {
  const zoom = useReaderSession((state) => state.zoom)
  const setZoom = useReaderSession((state) => state.setZoom)

  return (
    <div
      className="flex items-center rounded-lg border border-border/80 bg-muted/50 p-0.5 shadow-xs"
      aria-label="Zoom controls"
    >
      <Button
        aria-label="Zoom out"
        className="size-6 rounded-md"
        disabled={zoom <= MIN_PDF_SCALE}
        onClick={() => setZoom(Math.max(MIN_PDF_SCALE, zoom - 0.15))}
        size="icon-xs"
        type="button"
        variant="ghost"
      >
        <Minus />
      </Button>
      <output
        className="min-w-11 text-center text-[0.72rem] tabular-nums"
        aria-label="Zoom level"
      >
        {Math.round(zoom * 100)}%
      </output>
      <Button
        aria-label="Zoom in"
        className="size-6 rounded-md"
        disabled={zoom >= MAX_PDF_SCALE}
        onClick={() => setZoom(Math.min(MAX_PDF_SCALE, zoom + 0.15))}
        size="icon-xs"
        type="button"
        variant="ghost"
      >
        <Plus />
      </Button>
    </div>
  )
}
