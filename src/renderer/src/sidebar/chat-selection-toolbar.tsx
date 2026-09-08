import { useLayoutEffect, useState } from "react"
import { useAui, type AssistantClient } from "@assistant-ui/react"
import { createPortal } from "react-dom"

import { Button } from "@/components/ui/button"
import { useAppConfig } from "../store/app-config-provider"
import { createQuoteAttachment, hasQuote, type ChatQuote } from "./chat-quote"
import { resolveSelectionToolbarPosition, type LayoutSize } from "./chat-selection-toolbar-layout"
import { useChatPanelMode, useChatThreadStore } from "./chat-session"
import { useChatTextSelection } from "./use-chat-text-selection"

const ESTIMATED_TOOLBAR_SIZE: LayoutSize = { width: 240, height: 36 }

type ChatSelectionToolbarProps = {
  readonly viewportElement: HTMLElement | null
}

export function addQuoteToComposer(aui: AssistantClient, quote: ChatQuote) {
  if (hasQuote(aui.composer.getState().attachments, quote)) return

  void aui.composer.addAttachment(createQuoteAttachment(quote))
}

export function ChatSelectionToolbar({ viewportElement }: ChatSelectionToolbarProps) {
  const aui = useAui()
  const threadStore = useChatThreadStore()
  const isMain = useChatPanelMode() === "main"
  const openSideChatPanel = useAppConfig((state) => state.openSideChatPanel)
  const selection = useChatTextSelection(viewportElement)
  const [toolbarElement, setToolbarElement] = useState<HTMLDivElement | null>(null)
  const [toolbarSize, setToolbarSize] = useState(ESTIMATED_TOOLBAR_SIZE)

  useLayoutEffect(() => {
    if (!toolbarElement) return

    const { width, height } = toolbarElement.getBoundingClientRect()
    setToolbarSize((size) =>
      size.width === width && size.height === height ? size : { width, height },
    )
  }, [toolbarElement])

  if (!selection || !viewportElement) return null

  const position = resolveSelectionToolbarPosition({
    selectionRect: selection.rect,
    boundsRect: viewportElement.getBoundingClientRect(),
    toolbarSize,
  })
  if (!position) return null

  const quote = { text: selection.text, messageId: selection.messageId }

  const addToChat = () => {
    addQuoteToComposer(aui, quote)
    window.getSelection()?.removeAllRanges()
    viewportElement.querySelector("textarea")?.focus()
  }

  const askInSideChat = () => {
    threadStore.getState().askInSideChat(quote)
    openSideChatPanel()
    window.getSelection()?.removeAllRanges()
  }

  return createPortal(
    <div
      aria-label="Selection actions"
      className="fixed z-50 flex items-center gap-0.5 rounded-xl bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
      data-slot="chat-selection-toolbar"
      onMouseDown={(event) => event.preventDefault()}
      ref={setToolbarElement}
      role="toolbar"
      style={position}
      tabIndex={-1}
    >
      <Button onClick={addToChat} size="sm" type="button" variant="ghost">
        Add to chat
      </Button>
      {isMain && (
        <>
          <span aria-hidden="true" className="h-4 w-px bg-border" />
          <Button onClick={askInSideChat} size="sm" type="button" variant="ghost">
            Ask in side chat
          </Button>
        </>
      )}
    </div>,
    document.body,
  )
}
