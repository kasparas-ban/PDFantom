import { PanelLeftClose, PanelLeftOpen } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useIsFullScreen } from "./hooks/useIsFullScreen"
import { cn } from "./lib/utils"
import { useAppConfig } from "./store/app-config-provider"

export function DocumentsPanelControl() {
  const isFullScreen = useIsFullScreen()

  return (
    <div className={cn("absolute top-2.5 left-22", isFullScreen && "left-2.5")}>
      <DocumentsPanelControlContents />
    </div>
  )
}

function DocumentsPanelControlContents() {
  const isDocumentsPanelOpen = useAppConfig((state) => state.isDocumentsPanelOpen)
  const toggleDocumentsPanel = useAppConfig((state) => state.toggleDocumentsPanel)
  const label = `${isDocumentsPanelOpen ? "Hide" : "Show"} documents panel`

  return (
    <Button
      aria-controls="documents-panel"
      aria-expanded={isDocumentsPanelOpen}
      aria-label={label}
      className="window-no-drag text-muted-foreground"
      onClick={toggleDocumentsPanel}
      size="icon-sm"
      title={label}
      type="button"
      variant="ghost"
    >
      {isDocumentsPanelOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
    </Button>
  )
}
