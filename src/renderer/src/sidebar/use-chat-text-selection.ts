import { useEffect, useState } from "react"

const MESSAGE_SELECTOR = "[data-message-id]"
const NOT_SELECTABLE_SELECTOR = '[data-chat-quote-selectable="false"]'

export type ChatTextSelection = {
  readonly text: string
  readonly messageId: string
  readonly rect: DOMRect
}

export function useChatTextSelection(viewportElement: HTMLElement | null) {
  const [selection, setSelection] = useState<ChatTextSelection | null>(null)

  useEffect(() => {
    if (!viewportElement) return

    let frame = 0

    const read = () => {
      frame = 0
      setSelection(readChatTextSelection(viewportElement))
    }

    const scheduleRead = () => {
      if (frame === 0) frame = requestAnimationFrame(read)
    }

    const handleSelectionChange = () => {
      const current = window.getSelection()
      if (!current || current.isCollapsed) setSelection(null)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelection(null)
    }

    const handleFocusIn = (event: FocusEvent) => {
      if (isTextField(event.target)) setSelection(null)
    }

    viewportElement.addEventListener("mouseup", scheduleRead)
    viewportElement.addEventListener("keyup", scheduleRead)
    viewportElement.addEventListener("scroll", scheduleRead, { passive: true })
    window.addEventListener("resize", scheduleRead)
    document.addEventListener("selectionchange", handleSelectionChange)
    document.addEventListener("keydown", handleKeyDown)
    document.addEventListener("focusin", handleFocusIn)

    return () => {
      if (frame !== 0) cancelAnimationFrame(frame)
      viewportElement.removeEventListener("mouseup", scheduleRead)
      viewportElement.removeEventListener("keyup", scheduleRead)
      viewportElement.removeEventListener("scroll", scheduleRead)
      window.removeEventListener("resize", scheduleRead)
      document.removeEventListener("selectionchange", handleSelectionChange)
      document.removeEventListener("keydown", handleKeyDown)
      document.removeEventListener("focusin", handleFocusIn)
    }
  }, [viewportElement])

  return selection
}

function readChatTextSelection(viewportElement: HTMLElement): ChatTextSelection | null {
  const current = window.getSelection()
  if (!current || current.isCollapsed || current.rangeCount === 0) return null

  const text = current.toString().trim()
  if (!text) return null

  const messageId = resolveSelectionMessageId(current, viewportElement)
  if (!messageId) return null

  return { text, messageId, rect: current.getRangeAt(0).getBoundingClientRect() }
}

function resolveSelectionMessageId(selection: Selection, viewportElement: HTMLElement) {
  const anchor = toElement(selection.anchorNode)
  const focus = toElement(selection.focusNode)
  if (!anchor || !focus) return null

  const message = anchor.closest(MESSAGE_SELECTOR)
  if (!message || message !== focus.closest(MESSAGE_SELECTOR)) return null
  if (!viewportElement.contains(message)) return null
  if (isExcluded(anchor, message) || isExcluded(focus, message)) return null

  return message.getAttribute("data-message-id")
}

function isExcluded(element: Element, message: Element) {
  const marker = element.closest(NOT_SELECTABLE_SELECTOR)

  return marker !== null && message.contains(marker)
}

function toElement(node: Node | null) {
  return node instanceof Element ? node : (node?.parentElement ?? null)
}

function isTextField(target: EventTarget | null) {
  return (
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLInputElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  )
}
