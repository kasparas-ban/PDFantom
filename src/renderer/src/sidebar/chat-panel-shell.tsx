import type { ReactNode } from "react"

import { useChatPanelMode } from "./chat-session"

type ChatPanelShellProps = {
  readonly children?: ReactNode
}

export function ChatPanelShell({ children }: ChatPanelShellProps) {
  const isSide = useChatPanelMode() === "side"

  return (
    <aside
      aria-label={isSide ? "Side chat panel" : "Chat panel"}
      className="flex h-full min-h-0 flex-col border-l border-sidebar-border bg-sidebar text-sidebar-foreground"
      id={isSide ? "side-chat-panel" : "chat-panel"}
    >
      {children}
    </aside>
  )
}
