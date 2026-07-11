import { PanelLeftClose } from "lucide-react"

import { Button } from "@/components/ui/button"

export function CollapsedSidebarToggle({ onShowSidebar }: { onShowSidebar: () => void }) {
  return (
    <Button
      aria-label="Show sidebar"
      className="window-no-drag ml-17 text-muted-foreground"
      onClick={onShowSidebar}
      size="icon-sm"
      type="button"
      variant="ghost"
    >
      <PanelLeftClose className="rotate-180" />
    </Button>
  )
}
