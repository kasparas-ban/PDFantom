import { MessageCircleIcon, PanelRightClose } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useAppConfig } from "./store/app-config-provider"

export function ChatPanelControl() {
  const isChatPanelOpen = useAppConfig((state) => state.isChatPanelOpen)
  const toggleChatPanel = useAppConfig((state) => state.toggleChatPanel)
  const label = `${isChatPanelOpen ? "Hide" : "Show"} chat panel`

  return (
    <div className="absolute top-2.5 right-2.5 z-20">
      <Button
        aria-controls="chat-panel"
        aria-expanded={isChatPanelOpen}
        aria-label={label}
        className="window-no-drag text-muted-foreground"
        onClick={toggleChatPanel}
        size="icon-sm"
        title={label}
        type="button"
        variant="ghost"
      >
        {isChatPanelOpen ? <PanelRightClose /> : <MessageCircleIcon />}
      </Button>
    </div>
  )
}
