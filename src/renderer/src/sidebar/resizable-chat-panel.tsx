import { MINIMUM_PANEL_WIDTH } from "../reader-workspace-layout"
import { ChatPanel } from "./chat-panel"
import { ResizablePanel } from "./resizable-panel"

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
      <ChatPanel />
    </ResizablePanel>
  )
}
