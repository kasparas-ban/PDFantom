import { PanelLeftClose } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useIsFullScreen } from "./hooks/useIsFullScreen"
import { cn } from "./lib/utils"
import { useAppConfig } from "./store/app-config-provider"

export function TopControl() {
  const isFullScreen = useIsFullScreen()

  return (
    <div className={cn("absolute top-2.5 left-22", isFullScreen && "left-2.5")}>
      <TopControlContents />
    </div>
  )
}

function TopControlContents() {
  const toggleSidePanel = useAppConfig((state) => state.toggleSidePanel)

  return (
    <Button
      aria-label="Hide sidebar"
      className="window-no-drag text-muted-foreground"
      onClick={toggleSidePanel}
      size="icon-sm"
      title="Hide sidebar"
      type="button"
      variant="ghost"
    >
      <PanelLeftClose />
    </Button>
  )
}
