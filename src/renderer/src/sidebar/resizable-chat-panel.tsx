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
  readonly onOpenDocument: () => void
  readonly onWidthChange: (width: number) => void
  readonly width: number
}

export function ResizableChatPanel({
  maximumWidth,
  onOpenDocument,
  onWidthChange,
  width,
}: ResizableChatPanelProps) {
  const session = useChatSession()

  return (
    <ResizablePanel
      maximumWidth={maximumWidth}
      minimumWidth={MINIMUM_PANEL_WIDTH}
      onWidthChange={onWidthChange}
      resizeHandleLabel="Resize chat panel"
      side="right"
      width={width}
    >
      {session ? (
        <Suspense fallback={<ChatPanelShell />}>
          <ChatPanel client={session.client} onOpenDocument={onOpenDocument} />
        </Suspense>
      ) : (
        <ChatPanelShell />
      )}
    </ResizablePanel>
  )
}
