import { useAui, type AssistantClient } from "@assistant-ui/react"

import { SelectionToolbar } from "@/components/selection-toolbar"
import { Button } from "@/components/ui/button"
import { useTextSelection } from "@/components/use-text-selection"
import type { ChatThreadQuote } from "../../../shared/chat-thread-api"
import { useAppConfig } from "../store/app-config-provider"
import { createQuoteAttachment, hasQuote } from "./chat-quote"
import { useChatPanelMode, useChatThreadStore } from "./chat-session"
import { readChatTextSelection } from "./chat-text-selection"

type ChatSelectionToolbarProps = {
  readonly viewportElement: HTMLElement | null
}

export function addQuoteToComposer(aui: AssistantClient, quote: ChatThreadQuote) {
  if (hasQuote(aui.composer.getState().attachments, quote)) return

  void aui.composer.addAttachment(createQuoteAttachment(quote))
}

export function ChatSelectionToolbar({ viewportElement }: ChatSelectionToolbarProps) {
  const aui = useAui()
  const threadStore = useChatThreadStore()
  const isMain = useChatPanelMode() === "main"
  const openSideChatPanel = useAppConfig((state) => state.openSideChatPanel)
  const selection = useTextSelection(viewportElement, readChatTextSelection)
  if (!selection || !viewportElement) return null

  const quote: ChatThreadQuote = {
    text: selection.text,
    source: { type: "message", messageId: selection.messageId },
  }

  const addToChat = () => {
    addQuoteToComposer(aui, quote)
    window.getSelection()?.removeAllRanges()
    viewportElement.querySelector("textarea")?.focus()
  }

  const askInSideChat = () => {
    threadStore.getState().askInChat(quote, "side")
    openSideChatPanel()
    window.getSelection()?.removeAllRanges()
  }

  return (
    <SelectionToolbar
      boundsRect={viewportElement.getBoundingClientRect()}
      selectionRect={selection.rect}
      slot="chat-selection-toolbar"
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
    </SelectionToolbar>
  )
}
