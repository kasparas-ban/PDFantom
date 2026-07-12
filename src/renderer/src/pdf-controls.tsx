import { Minus, Plus } from "lucide-react"

import { Button } from "./components/ui/button"
import { useIsFullScreen } from "./hooks/useIsFullScreen"
import { cn } from "./lib/utils"
import { PageControls } from "./page-controls"
import { PageFitControl } from "./page-fit-control"
import { PageViewControl } from "./page-view-control"
import { MAX_PDF_SCALE, MIN_PDF_SCALE } from "./pdf-reader-runtime"
import { useAppConfig } from "./store/app-config-provider"
import { useReaderSession } from "./store/reader-session-provider"

export function PDFControls() {
  const zoom = useReaderSession((state) => state.zoom)
  const setZoom = useReaderSession((state) => state.setZoom)
  const activeDocument = useReaderSession((state) => state.activeDocument)
  const isSidePanelOpen = useAppConfig((state) => state.isSidePanelOpen)
  const isFullScreen = useIsFullScreen()

  if (!activeDocument) return null

  return (
    <header className="flex h-full w-full">
      <div
        className={cn(
          "grid h-full w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 border-b border-border/70 bg-background px-3",
          !isSidePanelOpen && (isFullScreen ? "pl-11" : "pl-30"),
        )}
      >
        <div className="window-no-drag flex w-min min-w-0 items-center gap-2 pl-1">
          {!isSidePanelOpen && <div className="mr-1.5 h-5 w-px bg-gray-300" />}
          <h2 className="truncate text-[0.82rem] font-medium">{activeDocument.name}</h2>
        </div>

        <div className="window-no-drag flex items-center gap-2 justify-self-center">
          <PageControls />

          <PageViewControl />

          <PageFitControl />

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
        </div>
      </div>
    </header>
  )
}
