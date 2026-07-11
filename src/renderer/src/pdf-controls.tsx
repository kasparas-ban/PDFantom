import { Minus, Plus } from "lucide-react"

import { Button } from "./components/ui/button"
import { useAppConfig } from "./store/app-config-provider"

export function PDFControls() {
  const activePDF = useAppConfig((state) => state.activePDF)
  const zoom = useAppConfig((state) => state.zoom)
  const setZoom = useAppConfig((state) => state.setZoom)

  if (!activePDF) return null

  return (
    <header className="flex h-full w-full">
      <div className="grid h-full w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 border-b border-border/70 bg-background px-3">
        <div className="window-no-drag flex w-min min-w-0 items-center gap-2 pl-1">
          <h2 className="truncate text-[0.82rem] font-medium">{activePDF.name}</h2>
        </div>
        <div
          className="window-no-drag flex items-center rounded-lg border border-border/80 bg-muted/50 p-0.5 shadow-xs"
          aria-label="Zoom controls"
        >
          <Button
            aria-label="Zoom out"
            className="size-6 rounded-md"
            disabled={zoom <= 0.7}
            onClick={() => setZoom(Math.max(0.7, zoom - 0.15))}
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
            disabled={zoom >= 1.9}
            onClick={() => setZoom(Math.min(1.9, zoom + 0.15))}
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            <Plus />
          </Button>
        </div>
      </div>
    </header>
  )
}
