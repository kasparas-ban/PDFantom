import { useIsFullScreen } from "./hooks/useIsFullScreen"
import { cn } from "./lib/utils"
import { PageControls } from "./page-controls"
import { PageFitControl } from "./page-fit-control"
import { PageViewControl } from "./page-view-control"
import { useAppConfig } from "./store/app-config-provider"
import { useReaderSession } from "./store/reader-session-provider"
import { ZoomControls } from "./zoom-controls"

export function PDFControls() {
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

          <ZoomControls />
        </div>
      </div>
    </header>
  )
}
