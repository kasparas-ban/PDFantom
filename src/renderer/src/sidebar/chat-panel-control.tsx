import { MessageCircleIcon, PanelRightClose, SettingsIcon } from "lucide-react"
import { Link } from "react-router"

import { Button, buttonVariants } from "@/components/ui/button"
import { useAppConfig } from "../store/app-config-provider"

export function ChatPanelControl() {
  const isChatPanelOpen = useAppConfig((state) => state.isChatPanelOpen)
  const toggleChatPanel = useAppConfig((state) => state.toggleChatPanel)
  const label = `${isChatPanelOpen ? "Hide" : "Show"} chat panel`

  return (
    <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-0.5">
      {isChatPanelOpen && (
        <Link
          to="/settings/general"
          className={buttonVariants({
            className: "window-no-drag text-muted-foreground",
            variant: "ghost",
            size: "icon-sm",
          })}
          aria-label="Open settings"
          title="Settings"
        >
          <SettingsIcon />
        </Link>
      )}
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
