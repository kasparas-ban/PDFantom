import { PanelLeftClose } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useAppConfig } from "./store/app-config-provider"

export function TopControl() {
  return (
    <div className="absolute top-2.5 left-20">
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
