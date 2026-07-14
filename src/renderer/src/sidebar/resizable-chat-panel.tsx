import { lazy, Suspense } from "react"

import { MINIMUM_PANEL_WIDTH } from "../reader-workspace-layout"
import { ChatPanelShell } from "./chat-panel-shell"
import { ResizablePanel } from "./resizable-panel"

const ChatPanel = lazy(() =>
  import("./chat-panel").then(({ ChatPanel: LoadedChatPanel }) => ({
    default: LoadedChatPanel,
  })),
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
  return (
    <ResizablePanel
      maximumWidth={maximumWidth}
      minimumWidth={MINIMUM_PANEL_WIDTH}
      onWidthChange={onWidthChange}
      resizeHandleLabel="Resize chat panel"
      side="right"
      width={width}
    >
      <Suspense fallback={<ChatPanelShell />}>
        <ChatPanel />
      </Suspense>
    </ResizablePanel>
  )
}
