import { PanelLeftClose } from "lucide-react"

import { Button } from "@/components/ui/button"

export function TopControl({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  return (
    <div className="absolute top-2.5 left-20">
      <TopControlContents onToggleSidebar={onToggleSidebar} />
    </div>
  )
}

function TopControlContents({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  return (
    <Button
      aria-label="Hide sidebar"
      className="window-no-drag text-muted-foreground"
      onClick={onToggleSidebar}
      size="icon-sm"
      title="Hide sidebar"
      type="button"
      variant="ghost"
    >
      <PanelLeftClose />
    </Button>
  )
}
