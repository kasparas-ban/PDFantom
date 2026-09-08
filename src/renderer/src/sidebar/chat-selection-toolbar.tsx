import { useLayoutEffect, useState } from "react"
import { createPortal } from "react-dom"
import { useAui } from "@assistant-ui/react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { createQuoteAttachment, hasQuote } from "./chat-quote"
import { resolveSelectionToolbarPosition, type LayoutSize } from "./chat-selection-toolbar-layout"
import { useChatTextSelection } from "./use-chat-text-selection"

const ESTIMATED_TOOLBAR_SIZE: LayoutSize = { width: 240, height: 36 }

type ChatSelectionToolbarProps = {
  readonly viewportElement: HTMLElement | null
}

export function ChatSelectionToolbar({ viewportElement }: ChatSelectionToolbarProps) {
  const aui = useAui()
  const selection = useChatTextSelection(viewportElement)
  const [toolbarElement, setToolbarElement] = useState<HTMLDivElement | null>(null)
  const [toolbarSize, setToolbarSize] = useState(ESTIMATED_TOOLBAR_SIZE)

  useLayoutEffect(() => {
    if (!toolbarElement) return

    const { width, height } = toolbarElement.getBoundingClientRect()
    setToolbarSize((size) => (size.width === width && size.height === height ? size : { width, height }))
  }, [toolbarElement])

  if (!selection || !viewportElement) return null

  const position = resolveSelectionToolbarPosition({
    selectionRect: selection.rect,
    boundsRect: viewportElement.getBoundingClientRect(),
    toolbarSize,
  })
  if (!position) return null

  const addToChat = () => {
    const quote = { text: selection.text, messageId: selection.messageId }
    if (!hasQuote(aui.composer.getState().attachments, quote)) {
      void aui.composer.addAttachment(createQuoteAttachment(quote))
    }

    window.getSelection()?.removeAllRanges()
    viewportElement.querySelector("textarea")?.focus()
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
      <span aria-hidden="true" className="h-4 w-px bg-border" />
      <Tooltip delay={300}>
        <TooltipTrigger
          render={
            <Button
              className="text-muted-foreground aria-disabled:opacity-60"
              focusableWhenDisabled
              size="sm"
              type="button"
              variant="ghost"
              disabled
            />
          }
        >
          Ask in side chat
        </TooltipTrigger>
        <TooltipContent>Coming soon</TooltipContent>
      </Tooltip>
    </div>,
    document.body,
  )
}
