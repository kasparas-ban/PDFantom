import { lazy, Suspense } from "react"

import { MINIMUM_PANEL_WIDTH } from "../reader/reader-workspace-layout"
import { ChatPanelShell } from "./chat-panel-shell"
import {
  ChatPanelModeContext,
  useChatPanelMode,
  useChatSession,
  type ChatPanelMode,
} from "./chat-session"
import { ResizablePanel } from "./resizable-panel"

const ChatPanel = lazy(() =>
  import("./chat-panel").then((module) => ({ default: module.ChatPanel })),
)

type ResizableChatPanelProps = {
  readonly maximumWidth: number
  readonly mode?: ChatPanelMode
  readonly onOpenDocument: () => void
  readonly onWidthChange: (width: number) => void
  readonly width: number
}

export function ResizableChatPanel({ mode = "main", ...props }: ResizableChatPanelProps) {
  return (
    <ChatPanelModeContext value={mode}>
      <ChatPanelContent {...props} />
    </ChatPanelModeContext>
  )
}

function ChatPanelContent({
  maximumWidth,
  onOpenDocument,
  onWidthChange,
  width,
}: Omit<ResizableChatPanelProps, "mode">) {
  const session = useChatSession()
  const isSide = useChatPanelMode() === "side"

  return (
    <ResizablePanel
      maximumWidth={maximumWidth}
      minimumWidth={MINIMUM_PANEL_WIDTH}
      onWidthChange={onWidthChange}
      resizeHandleLabel={isSide ? "Resize side chat panel" : "Resize chat panel"}
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
