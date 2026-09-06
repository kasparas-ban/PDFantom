import { lazy, Suspense } from "react"

import { MINIMUM_PANEL_WIDTH } from "../reader/reader-workspace-layout"
import { ChatPanelShell } from "./chat-panel-shell"
import { useChatSession } from "./chat-session"
import { ResizablePanel } from "./resizable-panel"

const ChatPanel = lazy(() =>
  import("./chat-panel").then((module) => ({ default: module.ChatPanel })),
)

type ResizableChatPanelProps = {
  readonly maximumWidth: number
  readonly onWidthChange: (width: number) => void
  readonly width: number
}

export function ResizableChatPanel({
  maximumWidth,
  onWidthChange,
  width,
}: ResizableChatPanelProps) {
  const client = useChatSession()

  return (
    <ResizablePanel
      maximumWidth={maximumWidth}
      minimumWidth={MINIMUM_PANEL_WIDTH}
      onWidthChange={onWidthChange}
      resizeHandleLabel="Resize chat panel"
      side="right"
      width={width}
    >
      {client ? (
        <Suspense fallback={<ChatPanelShell />}>
          <ChatPanel client={client} />
        </Suspense>
      ) : (
        <ChatPanelShell />
      )}
    </ResizablePanel>
  )
}
