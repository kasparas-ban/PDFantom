import type { ReactNode } from "react"

type ChatPanelShellProps = {
  readonly children?: ReactNode
}

export function ChatPanelShell({ children }: ChatPanelShellProps) {
  return (
    <aside
      aria-label="Chat panel"
      className="flex h-full min-h-0 flex-col border-l border-sidebar-border bg-sidebar text-sidebar-foreground"
      id="chat-panel"
    >
      {children}
    </aside>
  )
}
